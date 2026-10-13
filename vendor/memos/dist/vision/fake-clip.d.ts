/**
 * Fake CLIP provider — the offline test seam for the image-embedding
 * foundation.
 *
 * Produces a DETERMINISTIC 512-d normalized vector from the pixel bytes
 * (a feature hash over the buffer), with no model download, no network,
 * and no `@huggingface/transformers` dependency. It exists so the rest
 * of the image-memory suite (storage isolation, querySimilarImages,
 * the vectorCache namespace guarantee) can run offline and
 * deterministically — exactly the role the FastEmbed local-hash
 * fallback plays for text.
 *
 * It is deliberately NOT wired into production code: it is exported for
 * tests and for callers who want a deterministic stand-in. Real installs
 * use {@link ClipEmbeddingProvider} via `vision.clip.embedImage` or the
 * lazy default.
 *
 * Semantics:
 * - `embedImage(bytes)` hashes the raw bytes → 512-d, normalized.
 * - `embedImageText(query)` hashes the query STRING → 512-d, normalized.
 * - Same input always gives the same vector (assert-able in tests).
 * - `embedImageText` with a query whose text matches a previously
 *   embedded image's content produces a related-but-distinct vector —
 *   the fake is a hash, not a similarity model, so cross-modal
 *   "similarity" is only what tests choose to construct.
 *
 * @module @memos/vision/fake-clip
 */
import type { EmbedImageProvider, EmbeddingVector } from "../types.js";
export interface FakeClipProviderOptions {
    model?: string;
    dimensions?: number;
}
/**
 * Deterministic offline stand-in for {@link ClipEmbeddingProvider}.
 *
 * @example
 * ```ts
 * const clip = new FakeClipProvider();
 * const v = await clip.embedImage(Buffer.from([0xff, 0xd8, 0xff])); // 512-d
 * ```
 */
export declare class FakeClipProvider implements EmbedImageProvider {
    readonly id = "fake-clip";
    readonly model: string;
    readonly dimensions: number;
    /** Counts embedImage calls — useful for asserting cache behavior. */
    imageCalls: number;
    /** Counts embedImageText calls. */
    textCalls: number;
    constructor(options?: FakeClipProviderOptions);
    embedImage(image: Buffer | string): Promise<EmbeddingVector>;
    embedImageText(query: string): Promise<EmbeddingVector>;
}
//# sourceMappingURL=fake-clip.d.ts.map