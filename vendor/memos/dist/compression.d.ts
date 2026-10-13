/**
 * Statistical hard compression for context-pack items — a zero-dependency
 * variant of LLMLingua's token-selection idea: drop low-information
 * tokens (function words, filler adverbs) before injection instead of
 * calling a small LM to score perplexity.
 *
 * Honest framing: this is a conservative stopword-class filter, not a
 * learned compressor. It removes ~20–40% of tokens from typical prose at
 * zero cost and zero risk of a model dependency; the text remains
 * readable ("the deploy pipeline" → "deploy pipeline" — the separator of
 * a dropped word collapses, it never glues its neighbours into
 * "deploypipeline"). Code-like lines are never touched, and quoted spans
 * are preserved verbatim.
 *
 * @module @mem-os/compression
 */
export type CompressionLevel = "light" | "aggressive";
/**
 * Compress one text block by dropping low-information tokens.
 *
 * @returns The compressed text. Structure (newlines) is preserved;
 * code-like lines pass through untouched.
 */
export declare function compressText(text: string, level?: CompressionLevel): string;
//# sourceMappingURL=compression.d.ts.map