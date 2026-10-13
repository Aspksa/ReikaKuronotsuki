/**
 * Retrieval fusion — hybrid search result merging.
 *
 * Two fusion algorithms (see `FusionOptions.fusionMode`):
 *
 * - RRF (weighted Reciprocal Rank Fusion): each leg votes by RANK
 *   (`weight / (K + rank)`), robust to score outliers that would
 *   otherwise dominate a weighted sum. K=60 is the standard constant
 *   from the RRF paper (Cormack et al., 2009).
 * - Convex combination (default since round 4): min-max normalize each
 *   leg's native scores to [0,1], then take the weighted sum. A dominant
 *   absolute score (near-exact embedding match, runaway bm25 hit) keeps
 *   its magnitude instead of being flattened to a rank vote. A Sept 2026
 *   TOIS analysis found convex combination beats RRF in- and
 *   out-of-domain; Weaviate made the same switch.
 *
 * The keyword leg carries the larger weight by default (0.8 vs 0.2):
 * exact term matches are highly reliable for factoid memory queries,
 * while embeddings rescue paraphrases that share no vocabulary.
 */
import type { FusionOptions, ScoredMemory } from "./types.js";
export type { FusionOptions } from "./types.js";
/** Default RRF constant (Cormack et al., 2009). */
export declare const DEFAULT_RRF_K = 60;
/**
 * Default fusion algorithm (round 4). `"convex"` min-max normalizes each
 * leg's native scores and takes the weighted sum; `"rrf"` restores the
 * legacy rank-vote behavior.
 */
export declare const DEFAULT_FUSION_MODE: "convex";
/**
 * Temporal markers that switch on the recency multiplier for a query
 * (round 4 adaptive weighting). Deliberately narrow: generic nouns like
 * "week" alone don't trigger it, only explicit temporal constructions.
 */
export declare const TEMPORAL_QUERY_RE: RegExp;
/** Default strength of the temporal-query recency multiplier (≤5%). */
export declare const DEFAULT_TEMPORAL_RECENCY_STRENGTH = 0.05;
/**
 * Tokenize for PRF: lowercase alphanumeric tokens, stopwords and
 * short tokens dropped.
 */
export declare function prfTokenize(text: string): string[];
/**
 * RM3-lite pseudo-relevance feedback term harvesting (round 4).
 *
 * Pure function: given the top semantic-leg hits for a query, harvest
 * up to `maxTerms` recurring content terms that are NOT already in the
 * query, ranked by frequency across the hits. The caller re-probes FTS5
 * with these terms as a second keyword pass whose results are UNIONED
 * into the keyword leg — expansion can only add recall, never remove
 * candidates.
 *
 * Deterministic: no model, no sampling — same hits always yield the
 * same terms. Gated by the caller to short queries (≤3 terms), where
 * vocabulary mismatch hurts most.
 *
 * @param hits — Top semantic-leg results (best first); callers pass ~5.
 * @param queryTerms — Tokenized query terms (from `prfTokenize`).
 * @param maxTerms — Cap on harvested terms. Default 3.
 */
export declare function harvestPrfTerms(hits: ScoredMemory[], queryTerms: string[], maxTerms?: number): string[];
/**
 * Merge an expansion keyword pass into the primary keyword leg (union
 * semantics). Candidates already in the primary leg keep their original
 * score; expansion-only candidates append after.
 *
 * The expansion query is a different query (harvested terms only), so its
 * bm25 scores are NOT comparable to the primary query's: an expansion hit
 * matching three harvested terms will outscore a primary hit on raw bm25
 * even though the primary query is the user's actual intent. To keep PRF
 * a pure recall booster (never a re-ranker), expansion-only candidates are
 * demoted below every primary hit (FTS5 bm25: lower/more-negative is
 * better, so they take worst-primary + 1); they tie among themselves and
 * order deterministically by node id thereafter.
 */
export declare function mergeKeywordLegs(primary: ScoredMemory[], expansion: ScoredMemory[]): ScoredMemory[];
/**
 * Stable ordering for scored memories: descending score, node id as the
 * final tiebreak. The id tiebreak keeps serialized output byte-identical
 * for identical result sets — without it, equal scores surface
 * input/iteration-order noise, which breaks LLM prompt-cache prefixes
 * (providers only discount cached input when the prefix is byte-stable).
 */
export declare function compareScoredMemories(a: ScoredMemory, b: ScoredMemory): number;
/** Default weight for the keyword (FTS5) leg. */
export declare const DEFAULT_KEYWORD_WEIGHT = 0.8;
/** Default weight for the semantic (embedding) leg. */
export declare const DEFAULT_SEMANTIC_WEIGHT = 0.2;
/**
 * Default strength of the entity-overlap boost — the third retrieval
 * signal (semantic + keyword + entity match). Applied as a post-fusion
 * multiplier `score *= 1 + entityWeight * overlap`, so it nudges rather
 * than dominates; only active when `queryEntities` is non-empty.
 */
export declare const DEFAULT_ENTITY_WEIGHT = 0.15;
/**
 * ── item2: entity leg ── default weight of the entity-inverted-index RRF
 * leg (`entityResults`). Deliberately subordinate to the semantic leg:
 * rank-1 in the entity leg scores `0.1 / (rrfK + 1)`, below a
 * semantic-only rank-1 (`0.2 / (rrfK + 1)`). The extractor is lexical,
 * so on dialogue-heavy corpora a 0.5 weight let entity-matched
 * near-duplicates outrank genuine semantic hits — measured as a LoCoMo
 * nDCG regression at 0.5, neutral at 0.1. The leg's job is recall
 * (surfacing entity-matched memories the other legs missed), not
 * re-ranking.
 */
export declare const DEFAULT_ENTITY_LEG_WEIGHT = 0.1;
/**
 * Default weight of the CLIP image leg (Track B of image memory).
 *
 * Same role as the entity leg — a RECALL leg that surfaces candidates
 * the text legs could not match, not a re-ranking signal — so it sits
 * just below the semantic leg's 0.2, at the entity leg's level. The
 * leg is inert whenever it has no results (no CLIP configured, no image
 * embeddings stored), so this default never moves a text-only store's
 * ranking by a single bit.
 */
export declare const DEFAULT_IMAGE_LEG_WEIGHT = 0.1;
/**
 * Lower bound of the trust multiplier. A memory with trustScore 0 is
 * multiplied by `trustFloor`; trustScore 1 by 1.0. Kept gentle (0.7)
 * so trust nudges ranking without dominating pure relevance.
 */
export declare const DEFAULT_TRUST_FLOOR = 0.7;
/**
 * Weight of the confidence multiplier applied AFTER fusion. The
 * confidence state machine (`src/confidence-machine.ts`) tracks how
 * consistently a memory has been reinforced vs contradicted over time;
 * `confidenceWeight()` combines that with trust via a geometric mean
 * and heavily suppresses memories below the confidence floor (e.g.
 * superseded or contradicted facts). Applied as
 * `score *= floor + weight * (combinedWeight - floor)` — gentle by
 * default so relevance ordering dominates unless evidence says
 * otherwise. Set to `0` to disable confidence-aware ranking.
 */
export declare const DEFAULT_CONFIDENCE_WEIGHT = 0.35;
/**
 * Half-life for the recency tie-break, in milliseconds. Among fused
 * candidates whose scores are within `RECENCY_EPSILON` of each other,
 * the newer memory wins; the boost decays with an exponential half-life
 * (default 30 days) so it only ever re-orders near-ties, never overrides
 * a clear relevance gap. This lifts "Knowledge Update" / "Temporal
 * Reasoning" style queries where two versions of a fact both match but
 * only the current one should surface first. Set to `0` to disable.
 */
export declare const DEFAULT_RECENCY_HALF_LIFE_MS: number;
/**
 * Score window in which candidates are considered TIED for recency
 * tie-breaking. This is a float-noise window (~1e-9), NOT a fuzzy band:
 * adjacent RRF ranks differ by ~w/(K+i)² ≈ 2e-4, three orders of
 * magnitude above this threshold, so genuine rank separation always
 * holds and recency only arbitrates candidates whose fused contributions
 * are mathematically indistinguishable (e.g. rank-1 in the keyword leg
 * vs rank-1 in the semantic leg under equal weights, or duplicate
 * facts ingested twice).
 */
export declare const RECENCY_EPSILON = 1e-9;
/**
 * Fuse two (optionally three) ranked retrieval lists into one, then apply
 * trust weighting.
 *
 * All legs are expected to be pre-ranked best-first (as returned by FTS5
 * bm25, cosine-similarity search, and the entity-inverted-index lookup).
 * Candidates appearing in multiple legs accumulate each leg's RRF
 * contribution.
 *
 * @param keywordResults — Ranked keyword/FTS5 leg (best first).
 * @param semanticResults — Ranked semantic/embedding leg (best first).
 * @param options — Tunable weights; see {@link FusionOptions}.
 * @param entityResults — Ranked entity-inverted-index leg (best first).
 *   Optional third RRF leg: memories sharing entities with the query that
 *   the keyword/semantic legs missed still enter the candidate pool.
 * @returns Fused list sorted by descending hybrid score, with a `scores`
 *   breakdown (`keyword`, `semantic`, `entityLeg`, `hybrid`, plus `entity`
 *   when the entity-overlap boost fires) on each entry.
 */
export declare function fuseResults(keywordResults: ScoredMemory[], semanticResults: ScoredMemory[], options?: FusionOptions, entityResults?: ScoredMemory[], imageResults?: ScoredMemory[]): ScoredMemory[];
/**
 * Default tail-trim threshold: a candidate is kept when its fused score
 * is at least this fraction of the top score. Deliberately low — it
 * exists to cut the long tail of "matched one stopword" rows, not to
 * make fine-grained relevance decisions.
 */
export declare const DEFAULT_RELEVANCE_RATIO = 0.15;
/**
 * Default abstention floor on the semantic leg's cosine similarity.
 *
 * 0.3 is not arbitrary: `SEMANTIC_FUSION_THRESHOLD` and the fusion
 * comments already treat ~0.3 as the point where a real embedder's
 * paraphrase matches begin. Below it, a hit is coincidence.
 *
 * This is OPT-IN (`filter.abstainBelowSimilarity`) because the floor is
 * embedder-dependent — a 256-d hash embedder and a 1024-d transformer
 * do not share a cosine scale. Calibrate per embedder before enabling.
 */
export declare const DEFAULT_ABSTAIN_SIMILARITY = 0.3;
export interface RelevanceGateOptions {
    /**
     * Abstain (return nothing) when no candidate reaches this cosine
     * similarity AND nothing matched the query literally. `undefined`
     * disables abstention. See {@link DEFAULT_ABSTAIN_SIMILARITY}.
     */
    abstainBelowSimilarity?: number;
    /**
     * Keep only candidates scoring at least `topScore * relevanceRatio`.
     * `undefined` or `0` disables trimming.
     */
    relevanceRatio?: number;
}
/**
 * True when any candidate literally contains a query term.
 *
 * Guards abstention against its main failure mode: a bullseye exact-term
 * hit (a rare proper noun, a product name) can score a low cosine when
 * the embedder barely knows the word. Abstaining there would throw away
 * a perfect answer, so a literal match always wins over the cosine test.
 */
export declare function hasExactTermMatch(query: string, results: ScoredMemory[]): boolean;
/**
 * Decide whether retrieval found anything worth returning at all.
 *
 * Conservative by construction — three independent escape hatches, each
 * of which suppresses abstention:
 *
 * - no floor configured, or no results at all → never abstain;
 * - no candidate carries a semantic score (keyword-only retrieval, or no
 *   embedding provider) → cannot judge similarity, so never abstain;
 * - any candidate reaches the cosine floor → clearly relevant, return.
 *
 * Only when every candidate is below the floor do we abstain, and even
 * then a literal term match rescues the result set.
 *
 * **Reads `scores.semanticRaw`, never `scores.semantic`.** Convex fusion
 * (the default mode) min-max-normalizes each leg, so `scores.semantic`
 * holds a fusion weight whose top candidate is always exactly `1` —
 * comparing that against an absolute floor can never fail, which made
 * abstention dead code on the default path. `semanticRaw` carries the
 * unnormalized cosine on the embedder's own scale. The fallback to
 * `scores.semantic` is for hand-built results and custom fusion paths
 * that predate the raw field; those already store a raw value in
 * `semantic` (see `rrfFuse`).
 */
export declare function shouldAbstain(results: ScoredMemory[], query: string, options?: RelevanceGateOptions): boolean;
/**
 * Apply abstention and tail trimming to a fused, best-first result list.
 *
 * Pure and dependency-free (like {@link fuseResults}) so it can be unit
 * tested without storage, embeddings, or a MemOS instance.
 */
export declare function applyRelevanceGate(results: ScoredMemory[], query: string, options?: RelevanceGateOptions): ScoredMemory[];
/**
 * Build an expanded query by harvesting distinctive terms from the top
 * `maxDocs` candidates of a first retrieval pass.
 *
 * Scores terms by DOCUMENT FREQUENCY across the top candidates rather
 * than raw term frequency, so one long memory cannot dominate the
 * expansion. Returns `""` when nothing was harvested, which callers
 * treat as "skip the second pass".
 */
export declare function expandQueryWithPseudoRelevance(query: string, results: ScoredMemory[], options?: {
    maxDocs?: number;
    maxTerms?: number;
}): string;
//# sourceMappingURL=retrieval.d.ts.map