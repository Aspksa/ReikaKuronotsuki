/**
 * Retain pre-filter for MemOS memory writes (v1.6.26).
 *
 * Hermes-style signal gate (cf. NousResearch/hermes-agent #16834): a cheap
 * local classifier that decides whether a piece of content is worth storing in
 * long-term memory before the write happens. Without this, every turn —
 * including low-signal acknowledgements, chit-chat, and retries — enters
 * memory and later bloats context-packs, costing retrieval tokens and diluting
 * relevance ranking.
 *
 * Default mode is a ZERO-LLM-CALL local classifier (keeps MemOS fast and
 * local). The *decision* is conservative-first: a write is skipped only
 * on positive evidence of noise (empty content, pure acknowledgements,
 * fragments, near-duplicates of existing same-scope memories) — when in
 * doubt the memory is kept, because a false skip silently loses user
 * data. The *score* (0–1) separately estimates signal density from
 * length, entity/code presence, action verbs, and novelty, and is
 * reported for debugging/telemetry. An optional custom classifier can
 * be injected via `setRetainClassifier()`.
 *
 * @module @mem-os/sdk/retain-filter
 */
/** Inputs the retain gate uses to make its decision. */
export interface RetainInput {
    /** The content proposed for storage. */
    content: string;
    /**
     * Existing memory content in the same namespace (for novelty detection).
     * Optional; when absent, novelty is assumed maximal.
     */
    existingContent?: string[];
}
/** The gate's verdict plus the score that drove it. */
export interface RetainDecision {
    /** True = store the content. */
    retain: boolean;
    /** Signal-density score in [0, 1]. Higher = more worth storing. */
    score: number;
    /** Human-readable reason for the decision (for debugging). */
    reason: string;
}
/** Score at or above which content is retained. */
declare const RETAIN_THRESHOLD = 0.3;
/**
 * Does this content read as a correction of something already stored?
 *
 * The gate's near-duplicate rule exists to stop *identical restatements*
 * from re-entering memory. A negation/retraction ("user no longer lives in
 * Berlin", "switched from vim to neovim") is deliberately NOT a duplicate —
 * it is the update the confidence lifecycle exists to process, and it
 * arrives sharing most of its tokens with the memory it retracts (a
 * retraction necessarily names the same subject). Dropping it as a
 * "near-duplicate" is how a retraction silently never reaches the
 * confidence machine, leaving the old belief in place at full weight.
 * This check reuses the SAME signal list as `classifyEvidence` so the gate
 * and the state machine cannot drift apart.
 */
export declare function carriesContradictionSignal(content: string): boolean;
/**
 * Max token overlap of `content` against any entry of `existingContent`
 * (0–1). Tokens are lowercase alphanumeric words longer than 2 chars.
 */
export declare function maxTokenOverlap(content: string, existingContent: string[]): number;
/**
 * Default local classifier: scores content on signal density (0-1).
 *
 * Components:
 *  - Length floor: tiny content scores ~0.
 *  - Signal density: entities / code refs / numbers per 100 chars.
 *  - Action / preference verbs: factual statements score higher.
 *  - Low-signal penalty: pure acknowledgements score ~0.
 *  - Novelty: down-weight content that duplicates existing memory.
 *
 * No LLM call, no I/O — runs in well under 1ms.
 */
export declare function scoreRetain(input: RetainInput): number;
/**
 * Decide whether to retain (store) content. Default uses the local
 * classifier; callers can inject a custom classifier via
 * `setRetainClassifier()`.
 *
 * Conservative-first contract (the accuracy gate): a write is skipped
 * ONLY on positive evidence of noise —
 *   1. empty content,
 *   2. a pure acknowledgement ("ok", "thanks", "ok ok ok", …),
 *   3. a fragment with almost no alphanumeric content ("...", "k"),
 *   4. a near-duplicate of an existing same-scope memory.
 * Everything else is retained. When in doubt, keep the memory — a
 * false skip silently loses user data, while a false keep only costs a
 * little storage. `score` still reports the signal-density estimate
 * from `scoreRetain` for debugging/telemetry.
 */
export declare function shouldRetain(input: RetainInput): RetainDecision;
export declare function setRetainClassifier(classifier?: (input: RetainInput) => RetainDecision): void;
/** Decide whether to retain, using the custom classifier if installed. */
export declare function decideRetain(input: RetainInput): RetainDecision;
export { RETAIN_THRESHOLD };
//# sourceMappingURL=retain-filter.d.ts.map