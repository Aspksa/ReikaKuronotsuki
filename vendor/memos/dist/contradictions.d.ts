/**
 * Write-time contradiction candidate detection + read-time rule-based
 * resolution for MemOS.
 *
 * Background: MemOS is ADD-only — old facts are never deleted, they are
 * invalidated at read time. The gap this closes is *detection*: without
 * it, conflicting facts accumulate silently (the MemPalace failure mode
 * called out in the accuracy research). The detection recipe comes from
 * nirdiamant's semantic-memory thresholds — embedding similarity > 0.85
 * means duplicate, the 0.5–0.85 band plus entity overlap means
 * *contradiction candidate* — and the resolution policy mirrors the
 * mem0^g conflict-detector pattern, minus its LLM adjudication.
 *
 * Two entry points:
 *
 * 1. Write time — {@link findContradictionCandidates}: after a node is
 *    stored and its embedding persisted, scan a bounded set of semantic
 *    neighbors (the caller does the bounded scan; this function is pure)
 *    and flag pairs in the contradiction band. Flagged pairs are
 *    persisted to the `contradictions` table with status `unresolved`
 *    (add-only: both versions are kept, with provenance).
 *
 * 2. Read time — {@link resolveContradictionsAtRead}: when BOTH members
 *    of a CONFIRMED contradiction pair (`status: "resolved"`, e.g. via
 *    the evidence state machine's supersession path) appear in a result
 *    set, demote the OLDER one (multiply its score by
 *    {@link CONTRADICTION_DEMOTION_FACTOR}) so the newer version wins.
 *    Heuristic write-time candidates stay `unresolved` — persisted for
 *    future sleep-time adjudication — and never affect ranking, because
 *    at corpus scale the candidate rule's precision is too low for
 *    unreviewed pairs to demote results. Never removes anything.
 *    Deterministic.
 *
 * No LLM anywhere on this path — detection and resolution are
 * rule-based. LLM adjudication (e.g. in the sleep-time dreaming loop)
 * is an explicit future step, not part of this module.
 *
 * @module @memos/contradictions
 */
import type { ContradictionRecord, MemoryNode, ScoredMemory } from "./types.js";
/**
 * Lower bound of the contradiction band. Below this, two memories are
 * unrelated — flagging them would be pure noise.
 */
export declare const CONTRADICTION_SIM_MIN = 0.5;
/**
 * Upper bound (exclusive) of the contradiction band. At or above this,
 * the pair is a duplicate/paraphrase, not a contradiction — the
 * evidence-learning store path (reinforce) already owns that band.
 */
export declare const CONTRADICTION_SIM_MAX = 0.85;
/**
 * Write-time neighbor scan bound. Contradiction detection must not
 * become a full table scan on every write — the caller asks for the
 * top-N semantic neighbors and this module scores only those.
 */
export declare const CONTRADICTION_SCAN_LIMIT = 50;
/**
 * Read-time demotion factor for the older member of a contradiction
 * pair. 0.5 is strong enough to flip genuinely-tied pairs while a
 * clearly more relevant old memory still keeps its rank.
 */
export declare const CONTRADICTION_DEMOTION_FACTOR = 0.5;
/**
 * A pre-existing memory eligible for contradiction comparison. The
 * caller (the store path) fetches these from a bounded semantic-neighbor
 * scan; `entities` are the stored entities/tags of the candidate.
 */
export interface ContradictionCandidateInput {
    id: string;
    content: string;
    vector: ArrayLike<number>;
    entities: string[];
}
/**
 * A flagged contradiction candidate: the existing memory id plus the
 * measured cosine similarity (for provenance / future adjudication).
 */
export interface ContradictionCandidate {
    id: string;
    similarity: number;
}
/**
 * Stored entity surface forms for a memory node: `metadata.entities`
 * plus `tags`, lowercased and deduped. The entity-overlap check in
 * {@link findContradictionCandidates} compares the NEW memory's
 * extracted entities against these.
 */
export declare function storedEntities(node: {
    tags?: readonly string[];
    metadata?: {
        entities?: unknown;
    };
}): string[];
/**
 * Flag contradiction candidates among existing memories for a newly
 * written memory.
 *
 * A candidate is flagged when ALL of these hold:
 *   1. cosine similarity is in [CONTRADICTION_SIM_MIN, CONTRADICTION_SIM_MAX)
 *      — the nirdiamant recipe band (>= 0.85 is a duplicate, < 0.5 is
 *      unrelated);
 *   2. entity overlap > 0 between the new content's extracted entities
 *      and the candidate's stored entities (rules out topically
 *      unrelated near-neighbors);
 *   3. {@link sharesSubject} — the texts share at least one meaningful
 *      content word, so a negation can only contradict a memory that is
 *      actually about the same thing.
 *
 * Pure function: no storage, no LLM. Deterministic — candidates are
 * returned in input order.
 *
 * @param newContent — The newly stored memory's content.
 * @param newVector — The newly stored memory's embedding vector.
 * @param candidates — Existing memories from the bounded neighbor scan.
 * @returns Flagged candidates ({id, similarity}).
 */
export declare function findContradictionCandidates(newContent: string, newVector: ArrayLike<number>, candidates: ContradictionCandidateInput[]): ContradictionCandidate[];
/**
 * Rule-based contradiction resolution at read time.
 *
 * For every recorded contradiction pair whose BOTH members appear in
 * `results`, demote the OLDER member (smaller `createdAt`; id as the
 * tiebreak) by {@link CONTRADICTION_DEMOTION_FACTOR}. The demoted result
 * carries a `scores.contradiction_demoted` marker (the factor) and its
 * `scores.hybrid` is refreshed to the demoted score — mirroring the
 * convention in `fuseResults`. Demotion is sign-aware: the keyword leg
 * yields negative bm25 ranks, where a plain multiplication would
 * promote instead of demote, so negative scores are divided by the
 * factor (more negative = ranks worse under the descending sort).
 *
 * Rules:
 *   - Never removes results. Add-only is preserved: both versions stay
 *     in the set; the newer one simply outranks the older.
 *   - Pairs with only ONE member in the set are untouched.
 *   - The caller is responsible for passing only CONFIRMED pairs
 *     (`status: "resolved"`); heuristic `unresolved` candidates are
 *     persisted for future adjudication and must not reach this
 *     function (see `applyContradictionResolution` in `src/memory.ts`).
 *   - Deterministic: pairs are processed in canonical (node_a, node_b)
 *     order and the output is re-sorted with `compareScoredMemories`.
 *   - Pure: inputs are not mutated — demoted results are new objects
 *     with fresh `scores` records (the input `scores` objects may be
 *     shared with other result sets).
 *
 * @param results — Scored memories from hybrid search (post-fusion).
 * @param pairs — Recorded contradiction pairs (canonically ordered).
 * @returns A new array with older pair members demoted, sorted best-first.
 */
export declare function resolveContradictionsAtRead(results: ScoredMemory[], pairs: ContradictionRecord[]): ScoredMemory[];
/** Node entity-shape accepted by {@link nodeContradictionCandidates}. */
export type ContradictionScannableNode = Pick<MemoryNode, "id" | "content" | "tags" | "metadata" | "validTo">;
/**
 * Build the {@link ContradictionCandidateInput} list for a batch of
 * existing nodes given their vectors. Historical nodes (`validTo !==
 * null`) are skipped — a superseded memory is already out of the
 * read-time running and must not accumulate new contradiction pairs.
 */
export declare function nodeContradictionCandidates(nodes: ContradictionScannableNode[], vectors: ReadonlyMap<string, ArrayLike<number>>, excludeId?: string): ContradictionCandidateInput[];
//# sourceMappingURL=contradictions.d.ts.map