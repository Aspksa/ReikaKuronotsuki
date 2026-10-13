/**
 * In-memory graph engine for MemOS.
 *
 * Maintains an adjacency-list representation of the memory graph for
 * fast traversal, clustering, and auto-linking. The graph mirrors
 * what is persisted in the storage backend.
 *
 * @module @memos/graph
 */
import type { MemoryNode, MemoryEdge, CreateEdgeInput } from "./types.js";
/**
 * Default per-node cap on edges created by `autoLink()`.
 *
 * Without a cap, a corpus of similar memories converges to a complete
 * graph (K_N): every new node links to every existing one, so edge
 * writes grow quadratically and dominate ingestion time. 16 links is
 * enough to preserve local cluster structure for `findClusters()` /
 * `injectContext()` while keeping bulk ingestion near-linear. Pass `0`
 * to `autoLink()` to restore uncapped (legacy) behavior.
 */
export declare const DEFAULT_AUTO_LINK_CAP = 16;
/**
 * Bag-of-words cosine similarity between two strings.
 *
 * This is intentionally lightweight — no external embedding model needed.
 * For production use-cases requiring semantic similarity, supply your own
 * embedding-based linker via the adapter interface.
 *
 * @param a — First text.
 * @param b — Second text.
 * @returns Cosine similarity in [0, 1].
 */
export declare function textSimilarity(a: string, b: string): number;
/**
 * Cosine similarity of two pre-tokenized bags (binary term frequency).
 * Exported for reuse by GraphEngine.autoLink, which tokenizes the new node
 * once and reuses cached token sets for existing nodes instead of
 * re-tokenizing both sides on every comparison.
 */
export declare function tokenSetSimilarity(tokensA: Set<string>, tokensB: Set<string>): number;
/**
 * Graph engine managing the in-memory representation of the memory graph.
 */
export declare class GraphEngine {
    /** Adjacency list: nodeId → Set of edge IDs. */
    private adjacency;
    /** Edge lookup: edgeId → MemoryEdge. */
    private edges;
    /** Node lookup: nodeId → MemoryNode. */
    private nodes;
    /**
     * Lazily-computed bag-of-words token sets per node, for autoLink().
     * Populated on first use and invalidated on update/remove — avoids
     * re-tokenizing every existing node on every store().
     */
    private tokenCache;
    /**
     * Add a node to the graph.
     *
     * @param node — The memory node to add.
     */
    addNode(node: MemoryNode): void;
    /**
     * Remove a node and all its connected edges from the graph.
     *
     * @param id — Node ID to remove.
     * @returns `true` if the node existed.
     */
    removeNode(id: string): boolean;
    /**
     * Update a node in the graph.
     */
    updateNode(node: MemoryNode): void;
    /**
     * Add an edge to the graph.
     *
     * @param input — Edge creation input. `validFrom`/`validTo` define the
     *   bitemporal event-time validity interval (`createdAt` stays the
     *   transaction/ingest time); omitted bounds are open-ended.
     * @returns The created edge.
     */
    addEdge(input: CreateEdgeInput): MemoryEdge;
    /**
     * Remove an edge from the graph.
     */
    removeEdge(id: string): boolean;
    /**
     * Lazily-computed bag-of-words token set for a node, cached across
     * autoLink() calls. The cache is invalidated on add/update/remove/clear.
     */
    private tokensFor;
    /**
     * Get all edges connected to a node.
     */
    getEdgesForNode(nodeId: string): MemoryEdge[];
    /**
     * Get neighbours of a node (nodes connected by an edge).
     */
    getNeighbours(nodeId: string): MemoryNode[];
    /**
     * Attempt to auto-link a node to existing nodes based on text similarity.
     *
     * Cost control: linking is O(N) per store, and every accepted link is a
     * persisted row. Without a per-node cap a repetitive corpus converges to
     * a complete graph — K_N edges for N nodes (measured: 100 similar nodes
     * → 4,950 edges, and 300 stores took 2.7s vs 0.1s with linking off).
     * The cap keeps the most similar `maxLinksPerNode` edges and skips the
     * long tail, which preserves cluster structure (`findClusters`,
     * `injectContext`) while making ingestion cost linear-ish in practice.
     *
     * @param node     — The node to link.
     * @param threshold — Minimum similarity score to create an edge [0, 1].
     * @param maxLinksPerNode — Hard cap on edges created per call.
     *   `0` disables the cap (legacy complete-graph behavior).
     * @returns Array of created edges.
     */
    autoLink(node: MemoryNode, threshold: number, maxLinksPerNode?: number): MemoryEdge[];
    /**
     * Find clusters of strongly connected nodes using a simple BFS approach.
     *
     * @param minClusterSize — Minimum number of nodes per cluster.
     * @returns Array of clusters (each cluster is an array of node IDs).
     */
    findClusters(minClusterSize?: number): string[][];
    /**
     * Get a node by ID.
     */
    getNode(id: string): MemoryNode | undefined;
    /**
     * Get all nodes.
     */
    getAllNodes(): MemoryNode[];
    /**
     * Get all edges.
     */
    getAllEdges(): MemoryEdge[];
    /**
     * Bitemporal as-of read: edges whose event-time validity interval covers
     * `timeMs`. NULL bounds are open-ended. Superseded edges (whose
     * `validTo` was stamped by invalidation) are excluded for timestamps
     * at or after their `validTo`, but returned by as-of reads at earlier
     * times — nothing is deleted.
     *
     * @param timeMs — The as-of timestamp (Unix ms).
     */
    edgesValidAt(timeMs: number): MemoryEdge[];
    /**
     * Close (invalidate) the currently-valid edges incident to a node by
     * stamping `validTo`. In-memory edges are mutated in place so the mirror
     * stays consistent with storage; nothing is deleted (add-only).
     *
     * @param nodeId — Node whose incident edges to close.
     * @param timeMs — The invalidation timestamp (Unix ms), usually `now`.
     * @returns The edges that were closed.
     */
    closeEdgesForNode(nodeId: string, timeMs: number): MemoryEdge[];
    /**
     * Node count.
     */
    get size(): number;
    /**
     * Clear the entire graph.
     */
    clear(): void;
}
/**
 * Generate a UUID v4.
 */
export declare function generateId(): string;
//# sourceMappingURL=graph.d.ts.map