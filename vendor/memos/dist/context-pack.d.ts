/**
 * AI Trio context pack builder.
 *
 * Implements the `ai-trio.memos.context-pack.v1` contract from
 * `docs/ai-trio-contracts.md`. This is the canonical envelope LLM Guardian
 * and any other AI Trio consumer reads.
 *
 * Token-saving features:
 *   - Content debloating: strips redundant whitespace, collapses repeated
 *     phrases, trims trailing punctuation noise.
 *   - Smart dedup: drops near-duplicate items from the pack so the
 *     consumer doesn't fold the same fact twice — but only genuine
 *     duplicates. Similarity scores are order-blind and value-blind, so
 *     every drop is gated by a discriminating-token guard: an inverted
 *     fact (source/destination swapped) or a changed number survives.
 *   - Token-accurate budgeting: uses a GPT-style BPE approximation
 *     (whitespace + punctuation split) instead of the 4-chars-per-token
 *     heuristic. Callers can swap in a real tokenizer via `tokenCounter`.
 *   - Prompt-cache stability: scores are rounded to 3 decimals, items
 *     sort deterministically (score desc, id asc), and serialization
 *     layouts are fixed — so rebuilding a pack from the same memories
 *     yields byte-identical output. Providers that discount repeated
 *     prompt prefixes (Anthropic prompt caching, OpenAI) then cache the
 *     evidence block instead of re-billing it every turn.
 *
 * @module @memos/context-pack
 */
import type { ContextPackCompressionOptions, ContextPackWireFormat, EmbeddingVector, ImageAttachment, ImageMemoryMeta, ScoredMemory } from "./types.js";
import type { ProceduralLesson } from "./types.js";
import type { FidelityLevel } from "./fidelity.js";
/**
 * The image payload carried by a node, or null when it is not an image
 * memory.
 *
 * `metadata.image` — not `type`, not a new MemoryType member — is the
 * discriminator (the same pattern `metadata.context` uses), so
 * MemoryType exhaustiveness stays intact everywhere: the sync
 * allowlist, fidelity labels, adapters, and the MCP zod schema all keep
 * working without knowing images exist.
 *
 * A malformed payload returns null rather than throwing: a pack is a
 * read path, and a partially-written metadata key must degrade to
 * "not an image" instead of failing the whole pack.
 */
export declare function imageAttachmentOf(node: {
    metadata?: Record<string, unknown>;
}): ImageMemoryMeta | null;
/** The single source of truth for the context-pack schema id. */
export declare const CONTEXT_PACK_SCHEMA = "ai-trio.memos.context-pack.v1";
/** A single ranked, ready-to-fold memory item. */
export interface ContextPackItem {
    id: string;
    /**
     * Citable token like `[mem:a3f9]`, unique within the pack. Present
     * only when the pack was built with `citations: true`.
     */
    citation?: string;
    content: string;
    summary: string | null;
    /**
     * Fidelity level this item's content was rendered at. Present only
     * when the pack was built with the `fidelity` option; `undefined`
     * means L3 verbatim (the default).
     */
    fidelity?: FidelityLevel;
    score: number;
    scores: {
        keyword?: number;
        semantic?: number;
        hybrid?: number;
    };
    /** Pack-level trust label (e.g. "local"). Use trustScore for the numeric value. */
    trust: string;
    /** Pack-level source label (e.g. "session"). Use nodeSource for the per-node provenance. */
    source: string;
    /** Per-node numeric trust score [0, 1]. Used by compact TOON for 0-9 encoding. */
    trustScore?: number;
    /** Per-node provenance source. Used by compact TOON for 2-char code. */
    nodeSource?: string;
    /**
     * Provenance tier of the item's channel (`user-verified` > `user` >
     * `tool-output` > `chat` > `imported`). Lets pack consumers apply the
     * read-time trust policy.
     */
    provenance?: string;
    /**
     * True when the item comes from a low-trust channel (`imported` /
     * `tool-output` tier, or quarantined-then-released): the host agent
     * should confirm it instead of silently injecting it as context.
     */
    untrustedSource?: boolean;
    tags: string[];
    updatedAt: string;
    /**
     * Image attachments carried by this item. Present only when the item
     * is an image memory AND the pack was built with images enabled
     * (the default when any candidate is an image memory).
     *
     * A REFERENCE, never the bytes: `ref` resolves through
     * `memos.imageMemory(ref)`. One item can carry several (a node whose
     * caption describes a multi-image memory), so this stays an array.
     */
    images?: ImageAttachment[];
}
/** Top-level envelope returned to the AI Trio. */
export interface ContextPack {
    schema: typeof CONTEXT_PACK_SCHEMA;
    query: string;
    namespace: string;
    tokenBudget: number;
    items: ContextPackItem[];
    /** Number of tokens saved by debloating + dedup. 0 when neither ran. */
    tokensSaved: number;
    /**
     * Fidelity metadata: which level the pack was rendered at and what it
     * cost vs verbatim, so token savings are visible. Present only when
     * the pack was built with the `fidelity` option.
     */
    fidelity?: ContextPackFidelityMeta;
    /**
     * Procedural lessons injected as an "operating instructions" section.
     * Present only when the pack was built with lessons requested
     * (`MemOS.contextPack({ lessons })`).
     */
    lessons?: ProceduralLesson[];
}
/**
 * Pack-level fidelity metadata. `contentTokens` is what the packed item
 * contents cost at the chosen level; `verbatimTokens` is what the SAME
 * items would have cost at L3 — the difference is the fidelity saving.
 */
export interface ContextPackFidelityMeta {
    level: FidelityLevel;
    /** True when the level came from the query-adaptive router. */
    adaptive: boolean;
    contentTokens: number;
    verbatimTokens: number;
}
/** Options for building a context pack. */
export interface BuildContextPackOptions {
    query: string;
    namespace: string;
    tokenBudget: number;
    items: ScoredMemory[];
    trust?: string;
    source?: string;
    includeSummary?: boolean;
    /**
     * Custom token counter. Receives a string, returns the token count.
     * Default: a GPT-style BPE approximation (split on whitespace +
     * punctuation, count fragments). Callers that have a real tokenizer
     * (e.g. `tiktoken` or an LM Studio endpoint) should pass it here for
     * exact budget enforcement.
     */
    tokenCounter?: (text: string) => number;
    /**
     * If true (default), strip redundant whitespace and collapse repeated
     * phrases from each item's content before packing.
     */
    debloat?: boolean;
    /**
     * If true (default), drop items whose content is >85% similar (by
     * token-set Jaccard) to an item already in the pack.
     */
    dedup?: boolean;
    /**
     * Jaccard similarity threshold above which two items are considered
     * duplicates. Default 0.85.
     */
    dedupThreshold?: number;
    /**
     * Keep items whose only difference is the one that matters (default
     * true). Before a lexical or semantic near-duplicate is dropped, the
     * two texts are compared on their DISCRIMINATING tokens: any
     * difference in the digit-bearing tokens (`pool size 20` vs
     * `pool size 40`), or — when the vocabulary overlap is high enough
     * for word order to be signal — a different content-word sequence
     * (source/destination inverted) keeps BOTH items.
     *
     * Set-membership similarity is order-blind and value-blind:
     * `moved the deploy script from the runner to the cluster` and
     * `moved the deploy script from the cluster to the runner` score
     * Jaccard 1.0 and cosine ≈ 0.99, so without this guard the pack
     * silently deletes one of two opposite facts. Genuine redundancy
     * (identical text, or a difference confined to function words) still
     * collapses — the token savings are the point of the feature. Set
     * `false` to restore pure similarity-threshold dedup.
     */
    dedupKeepIfDistinct?: boolean;
    /**
     * Opt-in semantic dedup: when provided, items whose stored embedding has
     * cosine similarity >= `semanticDedupThreshold` (default 0.90) with an
     * item already selected for the pack are dropped as paraphrased
     * duplicates. The higher-scored item always survives. Lexical dedup
     * (Jaccard) still runs independently; the two passes are complementary —
     * lexical catches shared-vocabulary copies, semantic catches paraphrases.
     *
     * Vectors come from the caller (typically MemOS, which already has them
     * in memory from hybrid search), so this pass adds no embedding compute.
     */
    embeddings?: Map<string, EmbeddingVector>;
    /**
     * Cosine similarity threshold for `embeddings`-based dedup.
     * Default 0.90 (near-certain paraphrase; lower values risk dropping
     * distinct-but-related facts).
     */
    semanticDedupThreshold?: number;
    /**
     * Memory-grounded citations (opt-in, default off). When true, every
     * pack item carries a `citation` token like `[mem:a3f9]` — unique
     * within the pack, lengthened git-style on collision — and the TOON
     * serializers render it ahead of the item's content so an agent can
     * quote it and a verifier can trace it via `resolveCitation`.
     * Opt-in because it changes the rendered bytes (cache-prefix rule:
     * never reshuffle a layout mid-session unasked).
     */
    citations?: boolean;
    /**
     * Procedural lessons to inject as an "operating instructions" section
     * (additive; does not consume the item token budget). Fetched via
     * `recallProcedural` by `MemOS.contextPack` — pass pre-fetched rows
     * here when calling `buildContextPack` directly.
     */
    lessons?: ProceduralLesson[];
    /**
     * Fidelity level for item contents: a fixed level or `"adaptive"`
     * (the query-adaptive router picks the starting level from query
     * signals). Default `undefined` = L3 verbatim — current behavior
     * preserved exactly. The resolved level is recorded per item
     * (`item.fidelity`) and in the pack metadata (`pack.fidelity`).
     */
    fidelity?: FidelityLevel | "adaptive";
    /**
     * Wire format the pack will be serialized to. When set, the budget
     * loop charges every item what it actually costs on the wire for that
     * format — the TOON row scaffolding (`id|score|trust|src|epochDelta|
     * tags|content`, base64url ids, citations) or the JSON serializer's
     * field names and quotes — instead of the legacy flat
     * `content + summary + 4` estimate. Letting a large budget buy fewer
     * items than it can really afford is the bug this closes.
     *
     * Default `undefined` = legacy accounting, which keeps the item
     * selection byte-identical for every existing caller.
     */
    wireFormat?: ContextPackWireFormat;
    /**
     * Compression for items that do not fit `tokenBudget`. Off by default
     * (see `ContextPackCompressionOptions`); when enabled, an oversized
     * item is re-rendered through `compressText` and admitted if the
     * compressed form fits. Items that are still too big after
     * compression are skipped exactly as before, so this can only add
     * items to a pack, never remove them.
     */
    compression?: ContextPackCompressionOptions;
    /**
     * Attach image references to pack items whose node is an image memory
     * (`metadata.image` present).
     *
     * Default `true` when any candidate item is an image memory: the
     * attachment is a REFERENCE (`img_<sha256[0:12]>` + dimensions +
     * caption), never the bytes, so there is no token-budget cost that
     * would justify an off-by-default. Pass `false` explicitly to omit
     * them (a pack with no images is byte-identical to before).
     *
     * The bytes are resolved separately via `memos.imageMemory(ref)` by a
     * vision-capable host model — inlining them would be both a token
     * bomb and a prompt-cache-prefix disaster.
     */
    images?: boolean;
}
/**
 * Estimate token count using a GPT-style BPE approximation.
 *
 * Splits on whitespace and punctuation boundaries, then counts the
 * fragments. This is within ~10% of real tiktoken counts for English
 * text and is zero-dependency. For exact counts, pass a `tokenCounter`
 * that calls tiktoken or an LM Studio token-count endpoint.
 */
export declare function estimateTokens(text: string): number;
/**
 * Tokens the *serialization scaffolding* of one pack item costs on the
 * wire — everything the item contributes except its own content and
 * summary text: the id, score, trust, source, timestamp and tags, the
 * pipe separators (TOON) or field names and quotes (JSON), the optional
 * citation token, and the optional fidelity field.
 *
 * The count is derived from the real serializers (`JSON.stringify`,
 * `packToToon`'s row layout, `serializeCompactRows`'s field order), so
 * the enforced budget tracks the bytes a consumer actually pays for
 * rather than the memory text alone.
 *
 * Two documented approximations, both in the conservative direction:
 *   - Compact TOON rows carry numeric placeholder fields (`0`), so the
 *     epoch-delta digits are undercounted by ~1 token.
 *   - Compact TOON references tags through the header dictionary when
 *     that is a net win; this charges the literal tags.
 *
 * @param item — The pack item (or a partial one) being costed.
 * @param wireFormat — Target format; `undefined` returns the legacy
 *   flat estimate.
 * @param tokenCounter — Token counter to measure the scaffolding with.
 * @param withCitation — True when the pack is built with `citations`, so
 *   the `[mem:xxxx]` token is charged too (it is assigned after budget
 *   selection, so the caller must say whether it will exist).
 */
export declare function itemWireOverheadTokens(item: ContextPackItem, wireFormat: ContextPackWireFormat | undefined, tokenCounter?: (text: string) => number, withCitation?: boolean): number;
/**
 * Strip content bloat without losing meaning:
 *   - Collapse 3+ newlines to 2
 *   - Collapse 3+ spaces to 1
 *   - Strip trailing whitespace per line
 *   - Remove duplicate consecutive lines
 *   - Trim leading/trailing whitespace
 *
 * Returns the debloated text. If the text is short (<100 chars), returns
 * it unchanged — debloating overhead isn't worth it for one-liners.
 */
export declare function debloatContent(text: string): string;
/**
 * Derived pack limits.
 *
 * `contextPack()` derives how many items to retrieve from the caller's
 * `tokenBudget`. The old rule clamped the derived value at 50, which made
 * a 200k-token context window buy exactly the same evidence volume as a
 * 4k one — the window scaled, the memory layer didn't. The ceiling now
 * grows with the budget up to {@link PACK_ITEM_LIMIT_MAX}, which is what
 * a large window is actually paying for.
 */
/** Budget assumed per packed item when deriving the item limit. */
export declare const PACK_TOKENS_PER_ITEM = 80;
/** Floor on the derived item limit (tiny budgets still get a real pack). */
export declare const PACK_ITEM_LIMIT_MIN = 8;
/**
 * Absolute ceiling on the derived item limit, and therefore on the
 * candidate pool (`limit * PACK_CANDIDATE_DEPTH_FACTOR` rows come back
 * from storage). Bounds memory use no matter how large a budget a caller
 * passes; 500 items of evidence is already more than fits in any
 * practical prompt once the token budget itself is enforced.
 */
export declare const PACK_ITEM_LIMIT_MAX = 500;
/**
 * How many candidates the pack path fetches per item slot. A larger
 * budget has to retrieve more candidates for budget trimming to have
 * material to work with.
 */
export declare const PACK_CANDIDATE_DEPTH_FACTOR = 4;
/**
 * Derive the pack item limit from a token budget.
 *
 * Scales linearly (`tokenBudget / PACK_TOKENS_PER_ITEM`) between
 * {@link PACK_ITEM_LIMIT_MIN} and {@link PACK_ITEM_LIMIT_MAX}. Budgets up
 * to 4,000 tokens derive the historical value of 50, so small-budget
 * packs are unchanged; larger windows now buy proportionally more
 * evidence.
 */
export declare function derivePackItemLimit(tokenBudget: number): number;
/**
 * Derive the candidate depth (how many rows retrieval fetches) for a
 * derived pack item limit.
 */
export declare function derivePackCandidateDepth(limit: number): number;
/**
 * Round a score to 3 decimals.
 *
 * Cache-prefix stability: fusion scores are float64 math, so two runs
 * over the same memories can differ in the last bits
 * (0.9499999999999999 vs 0.95). Rounding at build time keeps JSON and
 * TOON output byte-identical across rebuilds, which is what lets
 * provider prompt caches hit on the evidence block.
 */
export declare function roundScore(score: number): number;
export declare function buildContextPack(opts: BuildContextPackOptions): ContextPack;
/**
 * Serialize a ContextPack to TOON (Token-Optimized Object Notation).
 *
 * TOON is a compact, human-readable alternative to JSON for highly
 * structured data. Each line is a pipe-delimited record with a stable
 * field order: `id|score|trust|source|updatedAt|content|tags`.
 *
 * Format:
 *   # ai-trio.memos.context-pack.v1
 *   # toon:pipe-delimited|q=<query>|n=<namespace>|b=<tokenBudget>|s=<tokensSaved>
 *   # fields: id|score|trust|source|updatedAt|tags|content
 *   mem_abc123|0.95|local|user_input|2026-06-18T12:00:00Z|user;preference|User likes dark mode
 *   mem_def456|0.87|local|user_input|2026-06-18T11:30:00Z|work|User works at Google
 *   # q=<query>
 *
 * The trailer line repeats the query AFTER the evidence block (the header
 * already states it BEFORE) — a reader scanning bottom-up re-anchors on
 * the query. It is a `#` comment line, so line-based consumers skip it.
 *
 * Token savings vs JSON: 60-90% on typical context packs (where JSON
 * overhead like braces, quotes, and field names dominate).
 *
 * Fidelity: when the pack was built with the `fidelity` option, a
 * `# fidelity=<level>` header line is emitted so the rendered level is
 * visible (and cacheable) in the serialized form.
 *
 * @param pack — The ContextPack to serialize.
 * @returns A TOON-formatted string.
 */
export declare function packToToon(pack: ContextPack): string;
/**
 * Serialize an array of ScoredMemory to TOON (Token-Optimized Object Notation).
 *
 * @param results — Array of scored memories from a search.
 * @returns A TOON-formatted string.
 */
export declare function searchResultsToToon(results: ScoredMemory[]): string;
/**
 * Serialize a ContextPack in the requested format.
 *
 * @param pack — The ContextPack to serialize.
 * @param format — "json" returns the pack object as-is.
 *   "toon" returns verbose pipe-delimited.
 *   "toon-compact" returns ultra-compact pipe-delimited.
 * @param tokenCounter — Optional custom token counter for budget
 *   enforcement in compact mode.
 * @param maxTokens — Optional hard ceiling on the rendered token count,
 *   honoured by the compact TOON serializer (`packToToonCompact`). Ignored
 *   for "json" (an object has no length to trim) and "toon".
 * @returns The pack object (for json) or a string (for toon formats).
 */
export declare function serializeContextPack(pack: ContextPack, format: "json" | "toon" | "toon-compact", tokenCounter?: (text: string) => number, maxTokens?: number): ContextPack | string;
/**
 * Losslessly shorten a memory ID for the wire.
 *
 * Canonical dashed UUIDs are re-packed as base64url under a `~` marker
 * (36 chars -> 24). Other pure-hex even-length IDs (except 32-hex, which
 * would be indistinguishable from UUID bodies on decode) are packed the
 * same way. Any other shape passes through unchanged; a literal leading
 * `~` is escaped as `~~` so the decoder can always tell encoded from raw.
 *
 * Decode rule: a decoded hex body of exactly 32 chars is re-dashed to the
 * canonical 8-4-4-4-12 UUID form; anything shorter stays plain hex. That
 * is why bare 32-hex IDs are excluded from encoding above.
 */
export declare function encodeCompactId(id: string): string;
/**
 * Inverse of {@link encodeCompactId}. Unknown shapes are returned as-is so
 * hand-written or foreign IDs survive untouched.
 */
export declare function decodeCompactId(wire: string): string;
/**
 * Serialize a ContextPack to ultra-compact TOON format (v2).
 *
 * Layout:
 *   # memos.search.v2|e=<minEpoch>|t=<tagDict>
 *   # f=~id|s|t|c|e|g|ct
 *   ~Ab3xZ9|950|9|ui|-86400|0;2|User likes dark mode
 *   # q=<query>                <- pack path only: query trailer for
 *                                 bottom-up readers; skipped by the parser
 *
 * Optimizations vs the v1 compact format:
 *   1. IDs: pure-hex IDs (incl. dashed UUIDs) re-packed to base64url with a
 *      `~` prefix (36-char UUID -> 24 chars); other shapes pass through.
 *   2. Timestamps: delta-encoded from a header epoch anchor `e=` (rows with
 *      the smallest timestamp store 0).
 *   3. Tags: a per-call dictionary in the header (`t=a,b,c`), rows reference
 *      tags by index; falls back to literal tags when the dictionary is not
 *      a net win.
 *   4. Carried over from v1: integer scores (x1000), 0-9 trust digit,
 *      2-char source codes, single-char field legend.
 *
 * Round-trip: `parseToonCompact` restores the original IDs (dashed UUIDs
 * re-dashed), absolute timestamps, and tag names exactly.
 *
 * @param pack — The ContextPack to serialize.
 * @param tokenCounter — Optional custom token counter. Used only when
 *   `maxTokens` is set, to measure the rendered wire cost.
 * @param maxTokens — Optional hard ceiling on the rendered token count.
 *   When the full pack exceeds it, the items are first re-rendered through
 *   `compressText` and re-checked: if the compressed pack fits, it is
 *   returned whole — COMPRESS BEFORE DROP. Only when compression is not
 *   enough are items dropped lowest-score-first until the output fits, and
 *   those drops are taken from the ALREADY compressed set, so no fact is
 *   ever discarded before it has been given the chance to fit. Trimming is
 *   by SCORE, not by list position, so the U-shape pin (second-best item,
 *   pinned last) is never the first casualty. If even the single best item
 *   is over budget it is still emitted — an over-budget answer carrying
 *   the top fact beats an empty evidence block. Omitted (the default)
 *   serializes the whole pack, exactly as before.
 * @returns A compact TOON-formatted string.
 */
export declare function packToToonCompact(pack: ContextPack, tokenCounter?: (text: string) => number, maxTokens?: number): string;
/**
 * Serialize search results to compact TOON format (v2). See
 * {@link packToToonCompact} for the wire layout.
 */
export declare function searchResultsToToonCompact(results: ScoredMemory[]): string;
/**
 * Decode a v2 (or v1) compact TOON string back into ContextPackItem objects.
 *
 * v2 headers carry an epoch anchor (`e=`) and optional tag dictionary
 * (`t=`); rows reference tags by index when the dictionary is present.
 * v1 strings (no `e=` in the header) keep their absolute-epoch semantics.
 *
 * All `#` comment lines are skipped — including the query trailer
 * (`# q=<query>`) that pack serializers append after the last evidence
 * row, so packs round-trip with the trailer intact-but-ignored.
 *
 * @param toon — The compact TOON string (header lines are skipped).
 * @returns Array of decoded ContextPackItem objects.
 */
export declare function parseToonCompact(toon: string): ContextPackItem[];
//# sourceMappingURL=context-pack.d.ts.map