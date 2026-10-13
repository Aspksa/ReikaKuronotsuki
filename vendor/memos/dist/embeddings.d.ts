import type { EmbeddingConfig, EmbeddingProvider, EmbeddingRuntimeInfo, EmbeddingVector } from "./types.js";
/**
 * Strip all trailing slash characters from a URL/base path without using a
 * regular expression. Avoids a ReDoS-flagged `/+$/` pattern on user-supplied
 * input (CodeQL js/regular-expression-polynomial-redos).
 */
export declare function stripTrailingSlashes(url: string): string;
export declare function normalizeVector(vector: EmbeddingVector): EmbeddingVector;
export declare function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number;
export declare class LocalHashEmbeddingProvider implements EmbeddingProvider {
    readonly id = "local-hash";
    readonly model: string;
    readonly dimensions: number;
    constructor(options?: {
        dimensions?: number;
        model?: string;
    });
    embed(text: string): Promise<EmbeddingVector>;
}
export declare class OllamaEmbeddingProvider implements EmbeddingProvider {
    readonly id = "ollama";
    readonly model: string;
    readonly dimensions: number;
    private readonly baseUrl;
    private readonly queryPrefix;
    private readonly documentPrefix;
    constructor(options?: {
        baseUrl?: string;
        model?: string;
        dimensions?: number;
        /** Optional string prepended to QUERY text before embedding. Many
         *  retrieval models (Liquid E / e5, nomic with a prompt) are
         *  trained for an asymmetric query/document setting and expect an
         *  instruction on the query side, e.g. "query: ". Empty by default
         *  = backward compatible. */
        queryPrefix?: string;
        /** Optional string prepended to DOCUMENT text (the index-side
         *  content) before embedding, e.g. "document: " for Liquid
         *  LFM2.5-Embedding / e5. Applied by `embed()`/`batchEmbed()` but
         *  NOT by `embedQuery()`, which applies `queryPrefix` only. Empty
         *  by default = backward compatible. */
        documentPrefix?: string;
    });
    private callEmbed;
    embed(text: string): Promise<EmbeddingVector>;
    /**
     * Query embedding applies the configured `queryPrefix`, when set, so the
     * retrieval question is embedded in the model's query mode. Documents are
     * embedded WITHOUT the prefix (plain indexing text).
     */
    embedQuery(text: string): Promise<EmbeddingVector>;
    batchEmbed(texts: string[]): Promise<EmbeddingVector[]>;
    embedDocuments(texts: string[]): Promise<EmbeddingVector[]>;
}
export declare class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
    readonly id = "openai-compatible";
    readonly model: string;
    readonly dimensions: number;
    private readonly baseUrl;
    private readonly apiKey;
    private readonly queryPrefix;
    private readonly documentPrefix;
    constructor(options: {
        baseUrl?: string;
        apiKey?: string;
        model?: string;
        dimensions?: number;
        /** Prepended to QUERY text by `embedQuery()`. Asymmetric retrieval
         *  models served over OpenAI-compatible endpoints (e.g. Liquid
         *  LFM2.5-Embedding via llama.cpp, e5 via vLLM) are trained with a
         *  query-side instruction — e.g. "query: " — and silently degrade
         *  without it. Empty by default = backward compatible. */
        queryPrefix?: string;
        /** Prepended to DOCUMENT text by `embed()`/`batchEmbed()` — e.g.
         *  "document: " for Liquid LFM2.5-Embedding / e5 index-side text.
         *  `embedQuery()` applies `queryPrefix` only. Empty by default. */
        documentPrefix?: string;
    });
    private callEmbeddings;
    embed(text: string): Promise<EmbeddingVector>;
    embedQuery(text: string): Promise<EmbeddingVector>;
    batchEmbed(texts: string[]): Promise<EmbeddingVector[]>;
}
/**
 * Voyage AI embedding provider.
 *
 * Voyage's `voyage-3` family is the strongest open-weight-class
 * retrieval model we can hit over HTTP, and it's a common default
 * for serious RAG work. The provider uses the public
 * `https://api.voyageai.com/v1/embeddings` endpoint and Bearer auth.
 */
export declare class VoyageAIEmbeddingProvider implements EmbeddingProvider {
    readonly id = "voyage";
    readonly model: string;
    readonly dimensions: number;
    private readonly apiKey;
    private readonly baseUrl;
    constructor(options?: {
        apiKey?: string;
        model?: string;
        dimensions?: number;
        baseUrl?: string;
    });
    embed(text: string): Promise<EmbeddingVector>;
    batchEmbed(texts: string[]): Promise<EmbeddingVector[]>;
    private callEmbeddings;
}
export declare function createEmbeddingProvider(config: EmbeddingConfig | undefined): EmbeddingProvider;
/**
 * Cohere embed-v3 embedding provider.
 *
 * Cohere's `embed-english-v3.0` (and its multilingual sibling) is a
 * strong default for English retrieval. The provider hits
 * `https://api.cohere.ai/v1/embed` and returns a normalized vector.
 */
export declare class CohereEmbeddingProvider implements EmbeddingProvider {
    readonly id = "cohere";
    readonly model: string;
    readonly dimensions: number;
    private readonly apiKey;
    private readonly baseUrl;
    private readonly inputType;
    constructor(options?: {
        apiKey?: string;
        model?: string;
        dimensions?: number;
        baseUrl?: string;
        inputType?: string;
    });
    embed(text: string): Promise<EmbeddingVector>;
    batchEmbed(texts: string[]): Promise<EmbeddingVector[]>;
    private callEmbed;
}
export declare class FastEmbedEmbeddingProvider implements EmbeddingProvider {
    readonly id = "fastembed";
    readonly model: string;
    readonly dimensions: number;
    private pipeline;
    private resolved;
    /**
     * Set when the transformers pipeline could NOT be loaded and the
     * deterministic local hash fallback is serving embeddings instead.
     * Null while unresolved or when the real model loaded fine. Exposed
     * via `getRuntimeInfo()` so benchmarks can detect — and optionally
     * refuse to run on — the fallback.
     */
    private fallbackReason;
    constructor(options?: {
        model?: string;
        dimensions?: number;
    });
    /**
     * Runtime resolution metadata. `fallbackActive` is only meaningful after
     * the first `embed()` call (or an explicit probe) has triggered
     * `resolve()`; before that it reports `false` with a null reason, which
     * callers should read as "not yet known" rather than "no fallback".
     */
    getRuntimeInfo(): EmbeddingRuntimeInfo;
    /** Dimensions seen on the most recent embed/batchEmbed result. */
    private lastObservedDimensions;
    /**
     * Lazily resolve the transformers pipeline. We use a dynamic import so
     * the optional dep is only paid for when (and if) the user installs it.
     * Any failure to load silently falls back to the local hash.
     *
     * Tries `@huggingface/transformers` (the maintained successor) first,
     * then falls back to the abandoned `@xenova/transformers` for users who
     * still have it installed.
     */
    private resolve;
    /**
     * One-time loud warning when the local-hash fallback activates. Silent
     * degradation is the worst plug-in experience: everything "works" but
     * semantic search quietly returns garbage.
     */
    private warnFallbackOnce;
    embed(text: string): Promise<EmbeddingVector>;
    batchEmbed(texts: string[]): Promise<EmbeddingVector[]>;
    /**
     * Deterministic feature-hash fallback. Produces a `dimensions`-long
     * vector with the same shape (and L2 norm) as a real
     * sentence-transformer embedding, so storage and ranking code is
     * identical to the online path.
     */
    private fallbackEmbed;
}
//# sourceMappingURL=embeddings.d.ts.map