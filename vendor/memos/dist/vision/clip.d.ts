/**
 * CLIP image-embedding provider (Track B of image memory).
 *
 * Encodes images with `Xenova/clip-vit-base-patch32` via
 * `@huggingface/transformers` (the same optional peer dependency the text
 * FastEmbed provider uses), entirely in-process — no API key, no network
 * beyond the first model download (~350 MB, cached on disk like the text
 * model).
 *
 * Design constraints, all deliberate:
 *
 * 1. **Lazy load.** The pipeline is constructed on the FIRST embed call,
 *    not in the constructor — constructing a MemOS instance must never
 *    pay a model download. Mirrors `FastEmbedEmbeddingProvider.resolve()`.
 * 2. **Fail soft.** If the transformers package is missing (or the model
 *    can't be built), `embedImage` throws a typed {@link ClipUnavailableError}
 *    so the write path can record `clipStatus: "failed"` — but the
 *    provider NEVER silently substitutes a text vector for an image
 *    vector. That substitution is the one failure mode that corrupts
 *    retrieval invisibly.
 * 3. **Separate contract from EmbeddingProvider.** CLIP's 512-d space is
 *    not comparable with bge's 384-d text space; the two vector tables
 *    exist precisely so they can never be mixed. The class satisfies
 *    {@link EmbedImageProvider} so it can also be dropped into
 *    `vision.clip.embedImage` directly.
 * 4. **Text side.** `embedImageText` encodes a query through CLIP's text
 *    encoder. Note CLIP's documented limitation: its text encoder is
 *    trained on short captions (<77 tokens) and is a weak text retriever
 *    — it is excellent at cross-modal matching ("a cat on a couch" →
 *    that photo), which is exactly what the image leg uses it for.
 *
 * @module @memos/vision/clip
 */
import type { EmbedImageProvider, EmbeddingVector } from "../types.js";
/** Default CLIP model — ViT-B/32, 512-d image space. */
export declare const DEFAULT_CLIP_MODEL = "Xenova/clip-vit-base-patch32";
/** Default CLIP dimensionality. */
export declare const DEFAULT_CLIP_DIMENSIONS = 512;
/**
 * Thrown when the CLIP pipeline could not be constructed (missing
 * optional dependency, model load failure, or no callable interface).
 * The write path catches this and records `clipStatus: "failed"`;
 * nothing ever falls back to a text vector.
 */
export declare class ClipUnavailableError extends Error {
    readonly cause?: unknown;
    constructor(message: string, cause?: unknown);
}
export interface ClipEmbeddingProviderOptions {
    model?: string;
    dimensions?: number;
}
/**
 * CLIP image encoder. Lazy, optional-dependency-tolerant, and separate
 * from the text embedding pipeline by construction.
 *
 * @example
 * ```ts
 * const clip = new ClipEmbeddingProvider();
 * const vector = await clip.embedImage(fs.readFileSync("cat.png")); // 512-d
 * const query = await clip.embedImageText("a cat on a couch");       // 512-d
 * ```
 */
export declare class ClipEmbeddingProvider implements EmbedImageProvider {
    readonly id = "clip";
    readonly model: string;
    readonly dimensions: number;
    private extractor;
    private resolveAttempted;
    /** Why the pipeline could not be built, or null when it loaded fine. */
    private failureReason;
    constructor(options?: ClipEmbeddingProviderOptions);
    /**
     * Why the CLIP pipeline is unavailable, or null when it loaded (or has
     * not been probed yet). The write path records this in
     * `metadata.clip.error` so a degraded install is diagnosable.
     */
    get fallbackReason(): string | null;
    /** True once the pipeline has been successfully constructed. */
    get available(): boolean;
    /**
     * Lazily resolve the transformers pipeline. Tries
     * `@huggingface/transformers` first, then the legacy
     * `@xenova/transformers`, exactly like the text provider's fallback
     * chain. Resolved at most once — a failure is sticky so repeated
     * embed calls fail fast instead of retrying a doomed model load.
     */
    private resolve;
    /** Reference to the lazily-resolved `RawImage`, or null. */
    private resolveRawImage;
    /**
     * Encode image bytes (or a path/URL) into the CLIP image space.
     *
     * A `Buffer` is wrapped in a `Blob` because `RawImage.read` accepts
     * `RawImage | string | URL | Blob | canvas` natively — a raw Node
     * Buffer is not one of those.
     *
     * @throws {@link ClipUnavailableError} when the pipeline is missing.
     */
    embedImage(image: Buffer | string): Promise<EmbeddingVector>;
    /**
     * Encode a text query into the CLIP image space, so a text→image
     * cosine query works. Uses the `feature-extraction` pipeline (CLIP's
     * text encoder).
     *
     * When unavailable, the caller should degrade to the caption leg
     * (Track A) rather than fail the query.
     *
     * @throws {@link ClipUnavailableError} when the text pipeline is missing.
     */
    embedImageText(query: string): Promise<EmbeddingVector>;
}
//# sourceMappingURL=clip.d.ts.map