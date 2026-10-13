/**
 * Tamper-evident mutation log.
 *
 * Every memory mutation (store / import / update / forget) appends one
 * entry to an append-only, hash-chained log stored alongside the nodes
 * in the same database. `verifyTamperLog()` recomputes the chain and —
 * with the deep check — cross-checks each node's current full state
 * against the latest log entry, so it detects:
 *
 * - edited, deleted, or reordered log rows (chain linkage breaks),
 * - nodes edited/deleted directly in the DB without a log entry
 *   (state-hash mismatch / missing-entry mismatch),
 * - nodes resurrected after a `forget` entry.
 *
 * Honest threat model: the log is tamper-*evident*, not tamper-*proof*.
 * An attacker with full write access to the database file can rewrite
 * the entire chain from genesis and the log alone cannot tell. What
 * stops that is an externally anchored checkpoint: `memos log
 * checkpoint` prints the tip hash; write it down (paper, another
 * machine, a signed commit) and `memos log verify --expect <hash>`
 * later proves the chain still ends where you left it. Without an
 * external anchor, a full-chain rewrite is undetectable — by anyone,
 * with any local-only scheme.
 */
import { createHash } from "node:crypto";
/** Fixed `prevHash` for the first entry — a domain-separated constant. */
export const GENESIS_PREV = "memos-tamper-log-genesis-v1:" +
    createHash("sha256").update("memos-tamper-log-genesis-v1").digest("hex");
export function sha256hex(s) {
    return createHash("sha256").update(s, "utf8").digest("hex");
}
/**
 * Canonical JSON: object keys sorted recursively, arrays in order.
 * Two equal states always serialize to the same string regardless of
 * insertion order — required for a stable hash.
 */
export function canonicalJson(value) {
    if (value === null || value === undefined)
        return "null";
    if (Array.isArray(value))
        return `[${value.map(canonicalJson).join(",")}]`;
    if (typeof value === "object") {
        const keys = Object.keys(value).sort();
        return `{${keys
            .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
            .join(",")}}`;
    }
    return JSON.stringify(value) ?? "null";
}
/**
 * Hash of a node's full mutable state at mutation time. Covers content,
 * summary, type, tags (sorted), importance, namespace, metadata,
 * provenance/source, validity window, TTL, and creation/update
 * timestamps — everything a mutation could change. Deliberately excludes
 * `accessCount`/`lastAccessed`: reads bump those without a log entry,
 * so hashing them would false-positive on every retrieval.
 */
export function nodeHash(node) {
    // The SQLite adapter folds top-level `confidence`/`evidenceCount`
    // into the metadata JSON blob on write (and reads them back out of
    // it), so hash the folded form: that way the in-memory node passed
    // to the logger and the node read back from the DB hash identically.
    const metadata = { ...(node.metadata ?? {}) };
    if (node.confidence !== undefined && metadata.confidence === undefined) {
        metadata.confidence = node.confidence;
    }
    if (node.evidenceCount !== undefined &&
        metadata.evidenceCount === undefined) {
        metadata.evidenceCount = node.evidenceCount;
    }
    const state = [
        node.id,
        node.content,
        node.summary,
        node.type,
        [...(node.tags ?? [])].sort().join("\u0000"),
        String(node.importance),
        node.namespace ?? "",
        canonicalJson(metadata),
        String(node.source ?? ""),
        canonicalJson(node.provenance ?? null),
        String(node.validFrom ?? ""),
        String(node.validTo ?? ""),
        String(node.expiresAt ?? ""),
        String(node.createdAt),
        String(node.updatedAt),
    ].join("\u0001");
    return sha256hex("memos-node-state-v1:" + state);
}
/**
 * First-day entry hash (v1): content-only, seq not bound. Kept solely
 * to verify rows written before the full-state format; see the
 * migration in SQLiteStorage init.
 */
function legacyEntryHash(e) {
    return sha256hex([
        "memos-tamper-entry-v1",
        e.ts,
        e.op,
        e.nodeId,
        e.contentHash,
        e.prevHash,
    ].join("|"));
}
/** First-day content hash, for the legacy cross-check. */
function legacyContentHash(content) {
    return sha256hex("memos-node-content-v1:" + content);
}
/**
 * Hash of one log entry. The chain position `seq` is bound into the
 * hash, so an entry cannot be replayed at a different position without
 * invalidating it. Canonical field order and a versioned prefix make
 * the serialization unambiguous — no JSON key-ordering games.
 */
export function entryHash(e) {
    return sha256hex([
        "memos-tamper-entry-v2",
        String(e.seq),
        String(e.ts),
        e.op,
        e.nodeId,
        e.nodeHash,
        e.prevHash,
    ].join("|"));
}
/**
 * Append one mutation to the log. Fail-open: when the storage adapter
 * doesn't implement the log, or the write fails, the mutation itself
 * is never blocked — the log is evidence, not a gate. The adapter
 * assigns the chain position atomically (tip lookup, seq allocation,
 * hash, insert in one transaction).
 */
export async function appendTamperEntry(storage, op, node, ts = Date.now()) {
    if (!storage.appendTamperEntry || !storage.readTamperLog)
        return;
    try {
        await storage.appendTamperEntry({
            ts,
            op,
            nodeId: node.id,
            nodeHash: nodeHash(node),
        });
    }
    catch {
        // Fail-open: a logging failure must never break the write path.
    }
}
/**
 * Verify the log: chain integrity (seq continuity, prev-hash linkage,
 * entry-hash recomputation) plus a deep cross-check of every node's
 * current content against its latest log entry.
 *
 * `expectTip` anchors the chain to an externally recorded checkpoint:
 * verification fails unless the current tip hash equals it.
 */
export async function verifyTamperLog(storage, opts = {}) {
    const empty = {
        ok: true,
        supported: true,
        entriesChecked: 0,
        unloggedNodes: 0,
        legacyEntries: 0,
        issues: [],
        tipHash: null,
    };
    if (!storage.readTamperLog) {
        return { ...empty, supported: false };
    }
    let entries;
    try {
        entries = await storage.readTamperLog();
    }
    catch {
        return { ...empty, supported: false };
    }
    const result = {
        ...empty,
        entriesChecked: entries.length,
        tipHash: entries.length > 0 ? entries[entries.length - 1].entryHash : null,
    };
    const fail = (issue) => {
        result.ok = false;
        result.issues.push(issue);
    };
    // --- Chain integrity -------------------------------------------------
    let prev = GENESIS_PREV;
    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const expectedSeq = i + 1;
        if (e.seq !== expectedSeq) {
            fail({
                kind: "broken_chain",
                seq: e.seq,
                detail: `sequence break at row ${i + 1}: expected seq ${expectedSeq}, found ${e.seq} (rows deleted or reordered)`,
            });
            break;
        }
        if (e.prevHash !== prev) {
            fail({
                kind: "broken_chain",
                seq: e.seq,
                detail: `prevHash mismatch at seq ${e.seq}: chain was edited or reordered`,
            });
            break;
        }
        const recomputed = entryHash({
            seq: e.seq,
            ts: e.ts,
            op: e.op,
            nodeId: e.nodeId,
            nodeHash: e.nodeHash,
            prevHash: e.prevHash,
        });
        let legacy = false;
        if (recomputed !== e.entryHash) {
            // Fall back to the first-day v1 format (content-only, seq
            // unbound). A v2 row can never verify as v1 — the domain
            // prefixes differ — so this only ever matches genuine old rows.
            const legacyRecomputed = legacyEntryHash({
                ts: e.ts,
                op: e.op,
                nodeId: e.nodeId,
                contentHash: e.nodeHash,
                prevHash: e.prevHash,
            });
            if (legacyRecomputed === e.entryHash) {
                legacy = true;
                result.legacyEntries += 1;
            }
        }
        if (!legacy && recomputed !== e.entryHash) {
            fail({
                kind: "broken_chain",
                seq: e.seq,
                nodeId: e.nodeId,
                detail: `entry hash mismatch at seq ${e.seq}: row was edited in place`,
            });
            break;
        }
        prev = e.entryHash;
    }
    // --- Deep cross-check: DB state vs latest log entry per node ---------
    if (result.ok && typeof storage.queryNodes === "function") {
        const latest = new Map();
        const legacyNodes = new Set();
        // Re-derive legacy status per entry (same v1 fallback as above).
        for (const e of entries) {
            latest.set(e.nodeId, e);
            const v2 = entryHash({
                seq: e.seq,
                ts: e.ts,
                op: e.op,
                nodeId: e.nodeId,
                nodeHash: e.nodeHash,
                prevHash: e.prevHash,
            });
            if (v2 !== e.entryHash &&
                legacyEntryHash({
                    ts: e.ts,
                    op: e.op,
                    nodeId: e.nodeId,
                    contentHash: e.nodeHash,
                    prevHash: e.prevHash,
                }) === e.entryHash) {
                legacyNodes.add(e.nodeId);
            }
        }
        try {
            const rows = await storage.queryNodes({ limit: 100_000 });
            const live = new Map();
            for (const r of rows)
                live.set(r.node.id, r.node);
            for (const [nodeId, entry] of latest) {
                const node = live.get(nodeId);
                if (entry.op === "forget") {
                    if (node) {
                        fail({
                            kind: "resurrected",
                            seq: entry.seq,
                            nodeId,
                            detail: `node ${nodeId.slice(0, 8)} has a forget entry (seq ${entry.seq}) but still exists in the DB`,
                        });
                    }
                    continue;
                }
                if (!node) {
                    fail({
                        kind: "deleted_without_log",
                        seq: entry.seq,
                        nodeId,
                        detail: `node ${nodeId.slice(0, 8)} is gone from the DB but its latest log entry (seq ${entry.seq}, op ${entry.op}) is not a forget`,
                    });
                    continue;
                }
                // Legacy v1 rows recorded a content-only hash: cross-check
                // content, not full state.
                const expected = legacyNodes.has(nodeId)
                    ? legacyContentHash(node.content)
                    : nodeHash(node);
                if (expected !== entry.nodeHash) {
                    fail({
                        kind: "content_mismatch",
                        seq: entry.seq,
                        nodeId,
                        detail: `node ${nodeId.slice(0, 8)} state does not match its latest log entry (seq ${entry.seq}, op ${entry.op}): edited without logging`,
                    });
                }
            }
            for (const nodeId of live.keys()) {
                if (!latest.has(nodeId))
                    result.unloggedNodes += 1;
            }
        }
        catch {
            // Deep check is best-effort; chain verification above stands alone.
        }
    }
    // --- External checkpoint anchor --------------------------------------
    if (opts.expectTip && result.tipHash !== opts.expectTip) {
        fail({
            kind: "tip_mismatch",
            detail: `tip hash ${result.tipHash ?? "(empty log)"} does not match the expected checkpoint ${opts.expectTip}: the chain was rewritten after the checkpoint`,
        });
    }
    return result;
}
//# sourceMappingURL=tamper-log.js.map