/**
 * Single-step PPR-lite graph expansion (HippoRAG-style retrieval).
 *
 * After hybrid fusion produces a ranked candidate list, the top seeds are
 * used as the personalization (restart) vector of a personalized PageRank
 * walk over the 1–2 hop neighbourhood of graph edges + shared-entity
 * links. The walk is a single sparse matrix-vector power iteration — no
 * LLM calls, no extra embedding calls, no iterative retrieval rounds
 * (the whole point: HippoRAG reaches iterative-IRCoT-level multi-hop
 * accuracy at 10–30x lower cost with one PPR pass).
 *
 * Evidence notes (see `~/workspace/your_files/memos-memory-accuracy-
 * research.md` §1a/§5-item-5):
 * - PPR damping 0.5, as in HippoRAG.
 * - Keep BOTH memory (passage) and entity nodes in the graph: dropping
 *   passage nodes costs −6.1 multi-hop F1. This implementation returns
 *   scores for every visited node, including the seeds themselves —
 *   callers must not filter down to entity-only.
 * - Query-to-triple linking beat NER-to-node by +12.5 R@5; the analogue
 *   here is seeding the walk from fused retrieval hits (which already
 *   carry the query match) rather than from extracted entities alone.
 *
 * The module is intentionally storage-free: the neighbourhood is injected
 * via a `getNeighbors` callback so the walk is a pure function and
 * unit-testable on synthetic graphs. `MemOS` wires it up in
 * `applyPprGraphExpansion` (`src/memory.ts`) using the in-memory
 * `GraphEngine` adjacency plus shared-entity links derived from the
 * fused candidate set.
 */
/** Tuning knobs for {@link personalizedPageRank}. */
export interface PersonalizedPageRankOptions {
    /**
     * Follow-link probability per power-iteration step; `1 - damping` is
     * the teleport (restart) mass returned to the personalization vector.
     * HippoRAG uses 0.5. Default 0.5.
     */
    damping?: number;
    /** BFS neighbourhood depth explored from the seed set. Default 2. */
    maxHops?: number;
    /**
     * Per-node neighbour cap, applied after de-duplication and sorting.
     * Bounds both the explored subgraph and the per-iteration work.
     * Default 64.
     */
    maxFanout?: number;
    /**
     * Cap on total visited nodes (safety bound for very dense graphs:
     * without it, `seeds × maxFanout^maxHops` bounds the subgraph only
     * loosely). BFS explores in sorted-frontier order, so which nodes are
     * kept is deterministic. Default 2048.
     */
    maxNodes?: number;
    /** Power-iteration cap. Default 50. */
    maxIterations?: number;
    /** L1 convergence tolerance between iterations. Default 1e-6. */
    tolerance?: number;
}
/** Default PPR damping (follow-link probability), per HippoRAG. */
export declare const DEFAULT_PPR_DAMPING = 0.5;
/** Default neighbourhood depth (1–2 hop expansion). */
export declare const DEFAULT_PPR_MAX_HOPS = 2;
/** Default per-node fan-out safety cap. */
export declare const DEFAULT_PPR_MAX_FANOUT = 64;
/** Default cap on total visited nodes. */
export declare const DEFAULT_PPR_MAX_NODES = 2048;
/** Default power-iteration cap. */
export declare const DEFAULT_PPR_MAX_ITERATIONS = 50;
/** Default L1 convergence tolerance. */
export declare const DEFAULT_PPR_TOLERANCE = 0.000001;
/**
 * Default blend weight of the normalized PPR score in the post-fusion
 * blend (`final = (1 - alpha) * fused + alpha * pprNorm`).
 */
export declare const DEFAULT_GRAPH_EXPANSION_ALPHA = 0.2;
/** Default number of top fused results that seed the PPR walk. */
export declare const DEFAULT_GRAPH_EXPANSION_SEEDS = 10;
/** Default PPR neighbourhood depth from each seed. */
export declare const DEFAULT_GRAPH_EXPANSION_HOPS = 2;
/**
 * Cap on graph neighbours injected into the results per query. Bounds
 * the extra storage reads (one `peekNode` per injected candidate).
 */
export declare const DEFAULT_PPR_MAX_INJECTED = 10;
/**
 * Minimum normalized PPR score for a neighbour to be injected. Filters
 * the long tail of barely-visited nodes so expansion only surfaces
 * candidates the walk actually concentrated on.
 */
export declare const DEFAULT_PPR_MIN_INJECT_SCORE = 0.05;
/**
 * Personalized PageRank over a bounded neighbourhood of the seed set.
 *
 * - The personalization (restart) vector is the seed scores, clamped to
 *   >= 0 and normalized to sum 1 (uniform over seeds when every seed
 *   score is <= 0).
 * - The explored subgraph is the BFS neighbourhood up to `maxHops`
 *   from the seeds; neighbour lists are de-duplicated, sorted, and
 *   fan-out capped, so exploration is deterministic regardless of the
 *   order `getNeighbors` returns.
 * - Power iteration: `r ← damping · Mᵀr + (1 − damping) · p`, with
 *   dangling-node mass redistributed through the personalization vector
 *   (standard PPR handling so rank cannot leak out of the subgraph).
 * - Returns scores for ALL visited nodes, INCLUDING the seed/memory
 *   (passage) nodes — never filter to entity-only (HippoRAG ablation:
 *   −6.1 F1 when passage nodes are dropped).
 *
 * Pure function: no storage, no I/O, no randomness. Deterministic for
 * deterministic `getNeighbors`.
 *
 * @param seeds — Seed node ids mapped to their (non-negative) scores,
 *   e.g. fused hybrid-search scores for the top-K candidates.
 * @param getNeighbors — Neighbour ids for a node id. Directionality is
 *   the caller's choice; MemOS passes both edge endpoints (undirected
 *   traversal) plus shared-entity links.
 * @param opts — Damping / hops / fan-out / iteration tuning.
 * @returns PPR score per visited node id (unnormalized; sums to ~1).
 */
export declare function personalizedPageRank(seeds: Map<string, number>, getNeighbors: (id: string) => string[], opts?: PersonalizedPageRankOptions): Map<string, number>;
//# sourceMappingURL=graph-expansion.d.ts.map