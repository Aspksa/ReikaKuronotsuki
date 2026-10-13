/**
 * Semantic (embedding) tier for the provenance-trust write gate.
 *
 * The tier-1 screen in `src/quarantine.ts` is pure regex: microseconds per
 * write, but blind to paraphrase ("novel phrasings outside the cliché list
 * don't match"). This module is the intent-level backstop: it embeds the
 * write with the already-configured embedding provider (fastembed by
 * default) and measures cosine similarity against a fixed set of
 * canonical attack-shape anchors. A write that *means* the same thing as
 * a known attack — even in entirely different words — scores high.
 *
 * Cost model (measured, bge-small-en-v1.5 on CPU):
 * - anchor embeddings: computed once, cached for the process lifetime.
 * - per screened write: one `embed()` call (~7ms warm) + N cosine
 *   products (negligible). The tier only runs for gray-zone writes
 *   (tier-1 score in [1.0, 2.0)) and low-trust-tier writes — ordinary
 *   user writes never pay it. See `maybeSemanticScreen` in
 *   `src/memory.ts`.
 *
 * No LLM anywhere: this is a frozen embedding model + arithmetic.
 * When embeddings are disabled or the provider falls back to the
 * deterministic local hash, the tier disables itself (hash-space cosine
 * is meaningless) — see {@link SemanticScreen.available}.
 *
 * @module @mem-os/semantic-screen
 */
import type { EmbeddingProvider, EmbeddingVector } from "./types.js";
/**
 * Canonical attack-shape anchors. Each is a short, plain-English
 * exemplar of one attack family the gate defends against. Writes are
 * compared against ALL of these; the maximum cosine similarity is the
 * write's attack-shape score.
 *
 * Kept deliberately small (26): the per-write cost is one cosine per
 * anchor, and the set must stay curated — every anchor should read like
 * something an attacker would actually plant.
 */
export declare const ATTACK_ANCHORS: readonly string[];
/**
 * Cosine similarity of two vectors. Pure arithmetic — unit-testable
 * without any model. Returns 0 for zero vectors or length mismatch.
 */
export declare function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number;
/**
 * Write-time attack-shape score that the semantic tier stamps into
 * `metadata.semanticAttackSim` whenever it runs. The retrieval-time
 * anomaly stage (`applyRetrievalAnomalyScoring` in `src/memory.ts`)
 * reads this back — a write-time measurement reused at read time, so
 * retrieval pays no embedding cost for stored memories.
 */
export declare const SEMANTIC_ATTACK_SIM_METADATA_KEY = "semanticAttackSim";
/**
 * Similarity at or above this adds the FULL escalation point (see
 * {@link semanticEscalationPoints}). Calibrated with
 * scripts/calibrate-semantic.ts against real fastembed embeddings
 * (bge-small-en-v1.5, 2026-09-25): 0.80 is the lowest bar with zero
 * false positives on the 61-case benign corpus (benign max = 0.770).
 * The same bar doubles as the standalone low-trust quarantine line —
 * on `tool-output`/`imported` tiers an intent match this strong
 * quarantines even without tier-1 signal (quarantine, never hard-block:
 * the memory is still stored and reviewable).
 */
export declare const SEMANTIC_HIGH_SIM_BAR = 0.8;
/**
 * Similarity below this contributes nothing: max-cosine against the
 * anchors sits around 0.55–0.60 for ordinary prose (benign median =
 * 0.574), so a floor below that would tax every write for noise.
 */
export declare const SEMANTIC_POINTS_FLOOR = 0.55;
/**
 * Semantic escalation points: how much the intent-level tier contributes
 * to the tier-1 score. Linear ramp from {@link SEMANTIC_POINTS_FLOOR}
 * (0 points) to {@link SEMANTIC_HIGH_SIM_BAR} (1.0 point), clamped.
 * A gray-zone write (tier-1 in [1.0, 2.0)) quarantines when
 * tier-1 score + points >= 2.0 — the semantic tier escalates partial
 * regex evidence, it never quarantines a clean-looking user write on
 * its own. Pure arithmetic, unit-testable without a model.
 */
export declare function semanticEscalationPoints(sim: number): number;
/**
 * Retrieval-time anomaly bar: a recalled memory whose write-time
 * attack-shape similarity is at or above this — while the *query's*
 * attack-shape similarity is below {@link QUERY_ATTACK_SIM_CAP} (i.e.
 * the user is not asking about attacks) — is flagged as a retrieval
 * anomaly and down-weighted. Set at 0.80 to match the benign-corpus
 * ceiling (max 0.770): the anomaly flag must not fire on ordinary
 * memories that merely discuss security topics.
 */
export declare const RETRIEVAL_ANOMALY_THRESHOLD = 0.8;
/**
 * Query-side cap for the topic-conditioned anomaly check: when the
 * query itself is attack-shaped (similarity at/above this), retrieved
 * attack-shaped memories are expected (security discussion, red-team
 * review) and the anomaly flag stays off.
 */
export declare const QUERY_ATTACK_SIM_CAP = 0.55;
/** Score multiplier applied to retrieval-anomaly results. */
export declare const RETRIEVAL_ANOMALY_PENALTY = 0.7;
/**
 * Intent-level screen over the shared embedding provider.
 *
 * Constructed per MemOS instance (cheap — anchors embed lazily on first
 * use and are cached). `available` is false when there is no usable
 * provider (embeddings disabled, or the local-hash fallback is active —
 * hash-space cosine carries no semantic meaning, so the tier refuses to
 * run on it rather than produce noise).
 */
export declare class SemanticScreen {
    private readonly provider;
    private anchorVecs;
    private anchorPromise;
    /**
     * Latched true once we learn the provider serves the deterministic
     * local-hash fallback (hash-space cosine is meaningless) — after that
     * the tier stays off for the process lifetime instead of re-probing
     * (and re-embedding anchors) on every gray-zone write.
     */
    private hashFallback;
    constructor(provider: EmbeddingProvider);
    /**
     * Whether the tier can produce meaningful scores. False once the
     * provider is known to serve the local-hash fallback (see
     * `getEmbeddingRuntimeInfo().fallbackActive`) — cosine similarity in
     * hash space is meaningless, so the tier disables itself instead of
     * generating false confidence. Before the first embedding the
     * fallback state is "not yet known" and `available` reports true;
     * the first `scoreText`/`scoreVector` call resolves it and latches
     * the outcome (see `hashFallback`).
     */
    get available(): boolean;
    /**
     * Embed the anchors once; concurrent callers share the one flight.
     * `batchEmbed` is optional on the provider interface — fall back to
     * per-text `embed` when it isn't implemented.
     */
    private embedAnchors;
    /** Embed the anchors once; concurrent callers share the one flight. */
    private ensureAnchors;
    /**
     * Maximum cosine similarity between `text` and any attack anchor.
     * Returns -1 when the tier is unavailable (caller keeps the tier-1
     * verdict).
     */
    scoreText(text: string): Promise<number>;
    /**
     * Score an already-embedded vector (e.g. the retrieval query vector)
     * against the anchors. Same -1 convention when unavailable.
     */
    scoreVector(vec: EmbeddingVector): Promise<number>;
    private scoreVectorAgainst;
}
//# sourceMappingURL=semantic-screen.d.ts.map