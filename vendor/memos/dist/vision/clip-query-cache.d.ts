/**
 * Bounded LRU cache for CLIP query vectors.
 *
 * CLIP text-encoding is cheap (~10–30 ms on CPU for a 20-token query)
 * but not free, and conversations repeat queries (the same query fans
 * out across multiple retrieval legs). This mirrors the text path's
 * `queryEmbeddingCache` LRU, but it is a SEPARATE cache by design:
 *
 * - `embedQueryCached` is keyed `provider.id:model:query` for the TEXT
 *   provider. CLIP text encoding is a different model in a different
 *   vector space and must not share that LRU — a shared LRU would let a
 *   CLIP query vector be served to a text-semantic query (or vice
 *   versa), which is the same silent-corruption class as the
 *   vectorCache namespace bug.
 * - The key here is `clip:<model>:<query>`, namespaced away from every
 *   text cache key.
 *
 * The cache is bounded (default 512 entries ≈ 512 × 512 floats ≈ 1 MB)
 * with FIFO eviction on insert and LRU touch on hit, matching the text
 * cache's semantics.
 *
 * @module @memos/vision/clip-query-cache
 */
import type { EmbeddingVector } from "../types.js";
/** Default bound on cached CLIP query vectors. */
export declare const DEFAULT_CLIP_QUERY_CACHE_MAX = 512;
/**
 * A bounded LRU cache for CLIP query vectors.
 *
 * Usage:
 * ```ts
 * const cache = new ClipQueryCache();
 * const v = await cache.get("a red error banner", clipProvider);
 * ```
 */
export declare class ClipQueryCache {
    private readonly entries;
    private readonly max;
    constructor(max?: number);
    /** Number of cached vectors. */
    get size(): number;
    /** Drop every cached vector. */
    clear(): void;
    /**
     * Encode `query` with `provider.embedImageText`, memoized under
     * `clip:<model>:<query>`.
     *
     * Returns null when the provider cannot encode text (no
     * `embedImageText`) — the caller degrades to the caption leg. A
     * provider that THROWS propagates the error: caching a failure would
     * pin it, and a failed encode is a real signal the caller must see.
     */
    get(query: string, provider: {
        model: string;
        embedImageText?: (query: string) => Promise<EmbeddingVector>;
    }): Promise<EmbeddingVector | null>;
}
//# sourceMappingURL=clip-query-cache.d.ts.map