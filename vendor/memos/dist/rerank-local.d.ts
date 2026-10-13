/**
 * ─── Local cross-encoder reranking ──────────────────────────────────────────
 *
 * In-process alternative to the HTTP `/rerank` endpoint path in
 * `MemOS.applyRerank`. Loads a sequence-classification cross-encoder
 * (default `Xenova/bge-reranker-base`, ~280 MB) through
 * `@huggingface/transformers` (falling back to `@xenova/transformers`),
 * scores `[query, document]` pairs, and returns sigmoid-squashed relevance
 * scores in [0,1].
 *
 * Design rules (same as the endpoint path):
 * - Opt-in only: nothing here runs unless `experimental.rerank` selects the
 *   local provider (or `MEMOS_RERANK_LOCAL=1`).
 * - Any failure — missing package, model download failure, inference
 *   error — returns `null` so the caller keeps the fused ranking. A broken
 *   reranker degrades quality, never availability.
 * - The model is loaded once per (model, dtype) and reused; the download
 *   happens on first use, so the first reranked query pays for it.
 */
export declare const DEFAULT_LOCAL_RERANK_MODEL = "Xenova/bge-reranker-base";
/** Default quantization for local rerank inference. q8 is ~4x faster on CPU. */
export declare const DEFAULT_LOCAL_RERANK_DTYPE = "q8";
export interface LocalRerankOptions {
    /** HuggingFace model id. Default `Xenova/bge-reranker-base`. */
    model?: string;
    /** Weight dtype passed to `from_pretrained` (e.g. "q8", "fp32"). */
    dtype?: string;
    /** Tokenizer max length for each pair. Default 512. */
    maxLength?: number;
}
/** Minimal surface of a loaded sequence-classification model. */
export interface LocalRerankModel {
    /** Raw (pre-sigmoid) relevance logits, one per pair, in input order. */
    scorePairs(pairs: Array<[string, string]>): Promise<number[]>;
}
export type LocalRerankLoader = (model: string, dtype: string, maxLength: number) => Promise<LocalRerankModel | null>;
/** Test-only override for the model loader (stubbed inference, no download). */
export declare function __setLocalRerankLoaderForTests(loader: LocalRerankLoader | null): void;
/**
 * Tokenize (query, doc) pairs for the cross-encoder. Tries the fast batched
 * path first; some tokenizers (XLM-R family in transformers.js v4) throw on
 * batched pair input (`text.replace is not a function`), in which case we
 * fall back to per-pair tokenization with manual padding. Exported for tests.
 */
export declare function tokenizePairsForRerank(tokenizer: {
    (input: unknown, options?: Record<string, unknown>): Promise<Record<string, TokenTensorLike>>;
    pad_token_id?: number;
}, pairs: Array<[string, string]>, maxLength: number): Promise<Record<string, TokenTensorLike>>;
interface TokenTensorLike {
    type: string;
    data: BigInt64Array | Float32Array | Float64Array | Int32Array | ArrayLike<number>;
    dims: number[];
}
/**
 * Score each document against the query with the local cross-encoder.
 * Returns sigmoid-squashed scores in input order, or `null` when the
 * reranker is unavailable — the caller must keep the fused ranking.
 */
export declare function scorePairsLocal(query: string, docs: string[], opts?: LocalRerankOptions): Promise<number[] | null>;
export {};
//# sourceMappingURL=rerank-local.d.ts.map