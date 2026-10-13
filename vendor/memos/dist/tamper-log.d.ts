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
import type { MemoryNode, StorageAdapter, TamperOp } from "./types.js";
/** Fixed `prevHash` for the first entry — a domain-separated constant. */
export declare const GENESIS_PREV: string;
export declare function sha256hex(s: string): string;
/**
 * Canonical JSON: object keys sorted recursively, arrays in order.
 * Two equal states always serialize to the same string regardless of
 * insertion order — required for a stable hash.
 */
export declare function canonicalJson(value: unknown): string;
/**
 * Hash of a node's full mutable state at mutation time. Covers content,
 * summary, type, tags (sorted), importance, namespace, metadata,
 * provenance/source, validity window, TTL, and creation/update
 * timestamps — everything a mutation could change. Deliberately excludes
 * `accessCount`/`lastAccessed`: reads bump those without a log entry,
 * so hashing them would false-positive on every retrieval.
 */
export declare function nodeHash(node: MemoryNode): string;
/**
 * Hash of one log entry. The chain position `seq` is bound into the
 * hash, so an entry cannot be replayed at a different position without
 * invalidating it. Canonical field order and a versioned prefix make
 * the serialization unambiguous — no JSON key-ordering games.
 */
export declare function entryHash(e: {
    seq: number;
    ts: number;
    op: TamperOp;
    nodeId: string;
    nodeHash: string;
    prevHash: string;
}): string;
/**
 * Append one mutation to the log. Fail-open: when the storage adapter
 * doesn't implement the log, or the write fails, the mutation itself
 * is never blocked — the log is evidence, not a gate. The adapter
 * assigns the chain position atomically (tip lookup, seq allocation,
 * hash, insert in one transaction).
 */
export declare function appendTamperEntry(storage: StorageAdapter, op: TamperOp, node: MemoryNode, ts?: number): Promise<void>;
export interface TamperVerifyIssue {
    kind: "broken_chain" | "content_mismatch" | "deleted_without_log" | "resurrected" | "tip_mismatch";
    seq?: number;
    nodeId?: string;
    detail: string;
}
export interface TamperVerifyResult {
    ok: boolean;
    supported: boolean;
    entriesChecked: number;
    /** Nodes that exist but predate the log (no entries) — informational. */
    unloggedNodes: number;
    /**
     * Entries written by the first-day content-only format (v1). Their
     * chain linkage is verified and their content cross-checked, but
     * they predate full-state hashing — informational.
     */
    legacyEntries: number;
    issues: TamperVerifyIssue[];
    tipHash: string | null;
}
/**
 * Verify the log: chain integrity (seq continuity, prev-hash linkage,
 * entry-hash recomputation) plus a deep cross-check of every node's
 * current content against its latest log entry.
 *
 * `expectTip` anchors the chain to an externally recorded checkpoint:
 * verification fails unless the current tip hash equals it.
 */
export declare function verifyTamperLog(storage: StorageAdapter, opts?: {
    expectTip?: string;
}): Promise<TamperVerifyResult>;
//# sourceMappingURL=tamper-log.d.ts.map