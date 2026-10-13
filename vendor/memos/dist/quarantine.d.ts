/**
 * Write-gate quarantine — a local-heuristic classifier for
 * instruction-like payloads in memory writes and imports.
 *
 * Runs synchronously on the `store()` hot path (pure regex scoring,
 * microseconds per write — no LLM, no network). Content that scores at
 * or above {@link QUARANTINE_FLAG_THRESHOLD} is still stored (add-only
 * is preserved) but marked `quarantined: true`, which excludes it from
 * recall by default until a human reviews it via
 * `memos quarantine list|release`.
 *
 * The classifier first normalizes its input
 * ({@link normalizeForScreening}): NFKC unicode folding, zero-width
 * character stripping, Cyrillic/Greek homoglyph folding, single-newline
 * collapsing, spaced-letter joining (`i g n o r e` → `ignore`), and
 * whitespace collapsing. Injection clichés are additionally matched
 * against a leetspeak-unfolded copy (`1gn0re` → `ignore`).
 *
 * Signal classes (each reports a stable machine-readable `code`):
 *
 * 1. Injection clichés — verbatim prompt-injection openers ("ignore
 *    previous instructions", "disregard your prior instructions",
 *    "do not tell the user", "pretend you are …", DAN/jailbreak
 *    patterns, chat-template role markers). Full-strength (2.0:
 *    quarantines on its own). Deliberately anchored to
 *    `previous`/`prior` so ordinary "ignore the old template" phrasing
 *    does NOT match.
 * 2. Imperative exfiltration — an exfil verb (send, email, upload, dump,
 *    …) governing a credential noun (passwords, api keys, secrets, …).
 *    1.5 alone; 2.0 when a URL/email destination appears anywhere in
 *    the write, or when verb+destination share a sentence and a
 *    credential noun appears anywhere. First-person possessives ("my
 *    password", "our api key") are exempt — "reset my password" is not
 *    an attack. On low-trust tiers (`tool-output`, `imported`) the
 *    bare verb+credential shape is 2.0 on its own — tool output that
 *    moves credentials is never benign.
 * 3. Exfiltration-shaped — secret material (an `sk-…`/`AKIA…`/`ghp_…`
 *    token, a `-----BEGIN … PRIVATE KEY-----` block, or an
 *    `api key: <value>` assignment) next to a URL or an exfiltration
 *    verb. 2.0.
 * 4. Encoded payloads — base64 blobs are decoded (whitespace-tolerant,
 *    depth-bounded) and the decoded text is re-screened: a blob that
 *    decodes to an injection scores 2.0 (`injection:encoded-
 *    instructions`); an opaque blob is 1.0 on its own (1.5 on
 *    low-trust tiers). A candidate only counts as a blob when it looks
 *    like real base64 (a digit, `+`/`/`, or `=` padding) — English prose
 *    that merely uses base64-alphabet words is not a blob.
 * 5. Low-trust-tier dormant instructions (Trojan-Hippo shape) —
 *    conditional future-directed instructions ("when the user asks
 *    about X, always say Y", "from now on, include …", "never mention
 *    …") are 2.0, but ONLY for `tool-output`/`imported` tiers. Tool
 *    output is data, never behavioral instructions; the same phrasing
 *    in a user's own memory ("when I travel, always pack my charger")
 *    is silent.
 * 6. Low-trust-tier trigger phrases (AgentPoison shape) — nonce-like
 *    tokens or trigger words ("code word", "activation token")
 *    co-occurring with instruction-shaped content. 2.0, low-trust
 *    tiers only.
 *
 * False-positive tuning: the negative corpus in
 * `__tests__/fixtures/redteam-battery.ts` (60 ordinary memories —
 * wifi passwords on the fridge, "send mom the photos", meeting notes
 * with URLs, developer-mode phone settings, surprise parties) must
 * score below threshold, including adversarial-benign cases such as
 * security notes quoting attack clichés. Quoted clichés under
 * meta-discussion framing ("how do I defend against 'ignore previous
 * instructions'?", "the article explains DAN mode") halves every signal
 * and caps total injection:* contribution at 1.0 — discussing an attack
 * is not an attack. A single unquoted injection signal wearing a
 * discussion-like prefix ("Security update: ignore previous
 * instructions") still evades; that residual gap is documented in
 * docs/provenance-trust.md.
 *
 * @module @mem-os/quarantine
 */
import type { ProvenanceTier } from "./types.js";
/**
 * Normalize write content before screening: NFKC folding, zero-width
 * stripping, homoglyph folding, single-newline joining (paragraph
 * breaks still split sentences), spaced-letter joining, and whitespace
 * collapsing. Exported for testing.
 */
export declare function normalizeForScreening(content: string): string;
/** Quarantine at or above this score. Tuned against the negative corpus. */
export declare const QUARANTINE_FLAG_THRESHOLD = 2;
export interface QuarantineSignal {
    /** Stable machine-readable code, e.g. `injection:ignore-previous-instructions`. */
    code: string;
    /** Human-readable explanation. */
    detail: string;
    /** Points contributed toward {@link QUARANTINE_FLAG_THRESHOLD}. */
    points: number;
}
export interface QuarantineVerdict {
    flagged: boolean;
    score: number;
    signals: QuarantineSignal[];
    /** `;`-joined signal codes — stored in `quarantine_reason`. */
    reason: string;
}
export interface ScreenWriteOptions {
    /**
     * Provenance tier of the write. Low-trust tiers (`tool-output`,
     * `imported`) get stricter screening: dormant-instruction and
     * trigger-phrase signals activate, and bare verb+credential
     * exfiltration quarantines on its own. Defaults to user-like
     * (lenient) when omitted.
     */
    tier?: ProvenanceTier;
}
/**
 * Screen one write for instruction-like payloads. Pure, synchronous,
 * allocation-light — safe on the store() hot path.
 *
 * Pass `opts.tier` for tier-aware strictness: `tool-output` /
 * `imported` writes additionally screen for dormant instructions and
 * trigger phrases, and bare verb+credential exfiltration quarantines.
 */
export declare function screenWrite(content: string, opts?: ScreenWriteOptions): QuarantineVerdict;
//# sourceMappingURL=quarantine.d.ts.map