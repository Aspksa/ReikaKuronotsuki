/**
 * Confidence score state machine for MemOS memory nodes.
 *
 * Implements the reinforce/revise/supersede pattern described in
 * Mem0's "AI Memory Confidence Score" blog post, adapted for MemOS's
 * local-first architecture.
 *
 * Every memory node carries a `confidence` [0,1] and `evidenceCount`
 * in its metadata. When a new observation touches an existing memory,
 * the confidence score is adjusted:
 *
 * - CONFIRMED (new evidence agrees) → confidence increases (diminishing returns)
 * - PARTIAL_CONFLICT (new evidence partially conflicts) → confidence decreases
 * - CONTRADICTED (new evidence clearly replaces) → supersede old memory
 *
 * The confidence score feeds into the trust-weighted hybrid search,
 * so lower-confidence memories rank lower in retrieval results.
 */
/** Default confidence floor — memories below this get flagged for review. */
export declare const CONFIDENCE_FLOOR = 0.3;
/** Initial confidence for a new memory before any evidence. */
export declare const INITIAL_CONFIDENCE = 0.5;
/** Maximum confidence cap. */
export declare const CONFIDENCE_CAP = 1;
/**
 * Keyword signals that mark new content as a negation/update of an
 * existing fact ("no longer", "moved", …). Exported so the store-path
 * evidence wiring (src/memory.ts) uses the SAME word list as
 * {@link classifyEvidence} instead of duplicating it.
 */
export declare const CONTRADICTION_SIGNALS: readonly ["not", "never", "no longer", "changed", "moved", "left", "different"];
/**
 * The outcome of comparing a new observation against an existing memory.
 */
export type EvidenceOutcome = "confirmed" | "partial_conflict" | "contradicted";
/**
 * The result of applying evidence to a memory's confidence score.
 */
export interface ConfidenceUpdate {
    /** New confidence score in [0, 1]. */
    confidence: number;
    /** New evidence count (total reinforce + revise events). */
    evidenceCount: number;
    /** Whether the memory was superseded (i.e. should be marked historical). */
    superseded: boolean;
    /** Whether the memory is now below the confidence floor (flagged for review). */
    flaggedForReview: boolean;
}
/**
 * Apply a single evidence event to a memory's confidence score.
 *
 * Uses a diminishing-returns formula for reinforcement:
 *   confidence += (CAP - confidence) * REINFORCE_RATE
 *
 * For partial conflicts (down-adjust):
 *   confidence -= confidence * REVISE_RATE
 *
 * @param currentConfidence — Current confidence score [0, 1].
 * @param currentEvidence — Current evidence count.
 * @param outcome — The evidence outcome from comparing new observation.
 * @returns Updated ConfidenceUpdate.
 */
export declare function applyEvidence(currentConfidence: number, currentEvidence: number, outcome: EvidenceOutcome): ConfidenceUpdate;
/**
 * Compare a new observation against an existing memory to determine
 * the evidence outcome.
 *
 * This is a simple heuristic-based classifier. For production use,
 * you may want to replace this with an LLM-based classifier.
 *
 * @param existingContent — The existing memory's content.
 * @param newContent — The new observation's content.
 * @param similarity — Semantic similarity between the two (0-1).
 * @returns The EvidenceOutcome.
 */
export declare function classifyEvidence(existingContent: string, newContent: string, similarity: number): EvidenceOutcome;
/**
 * Do two texts talk about the same SUBJECT?
 *
 * Guard used by the store-path evidence wiring before a contradiction is
 * allowed to supersede a memory: the texts must share at least one
 * meaningful content word (length > 2, not a stop word). This prevents
 * "User no longer drinks coffee" from nuking an unrelated memory that
 * merely happens to contain a signal word.
 */
export declare function sharesSubject(a: string, b: string): boolean;
/**
 * Get the effective retrieval weight for a memory, combining
 * trust and confidence scores.
 *
 * Higher trust (source) + higher confidence → higher weight.
 * Memories below the confidence floor get suppressed.
 *
 * @param trustScore — The static trust score [0, 1] from provenance.
 * @param confidence — The dynamic confidence score [0, 1].
 * @returns Combined weight multiplier in [0, 1].
 */
export declare function confidenceWeight(trustScore: number, confidence?: number): number;
//# sourceMappingURL=confidence-machine.d.ts.map