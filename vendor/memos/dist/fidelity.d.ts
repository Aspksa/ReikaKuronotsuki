/**
 * Fidelity-level compaction (L0–L3) + query-adaptive level-aware retrieval.
 *
 * Every memory exists at four fidelity levels:
 *   - L0: tags + entities only (~tens of tokens). Derived free from the
 *         existing entity index/tags — nothing is stored.
 *   - L1: typed facts — short structured statements extracted at write /
 *         consolidation time. Deterministic and template-based (no LLM):
 *         entity-bearing sentences from the existing extraction pipeline
 *         (`extractQueryEntities` + `canonicalizeEntities`), prefixed with
 *         the memory's type.
 *   - L2: extractive summary — sentence selection by centrality
 *         (TextRank-lite over sentence word-overlap, no LLM). A future
 *         sleep-time LLM pass may upgrade it to abstractive; the
 *         extractive path always works with zero LLM.
 *   - L3: verbatim full text (the existing `content`).
 *
 * The retriever picks the CHEAPEST level that satisfies the query instead
 * of always returning verbatim: `routeFidelity()` chooses a starting level
 * from cheap local signals (entity density, query shape, length), and
 * `MemOS.recall()` escalates L0→L1→L2→L3 within the same call when the
 * result set looks insufficient — up to a caller-specified `maxFidelity`.
 *
 * Why this is novel: OpenViking ships fixed tiered loading (L0→L1→L2
 * ladder) but requires LLM/VLM + embeddings and is filesystem-based with
 * a static ladder; MemPalace's L0–L3 is a fixed wake-up loader. This is
 * zero-LLM, SQLite, per-query adaptive fidelity selection with in-call
 * escalation.
 *
 * Level persistence: L1/L2 are generated at write time (`MemOS.store`)
 * and cached in the reserved `metadata.fidelity` slot (`{ v, l1, l2 }`)
 * so they travel with the node on every storage adapter with zero schema
 * migration. `MemOS.compact()` backfills pre-existing memories eagerly;
 * reads also generate lazily when the cache is missing (fail-soft, no
 * writes on the hot path).
 *
 * Default-behavior contract: every public API defaults to L3-equivalent
 * output (verbatim), so existing tests and consumers see byte-identical
 * behavior unless they opt into `fidelity: "adaptive"` or a fixed lower
 * level. Adaptive is opt-in because level selection changes *which text*
 * is returned, and that must be a deliberate caller choice.
 *
 * @module @memos/fidelity
 */
import type { MemoryNode, SearchFilter } from "./types.js";
/** Fidelity levels, cheapest first. */
export type FidelityLevel = "L0" | "L1" | "L2" | "L3";
/** Ordered levels for escalation loops. */
export declare const FIDELITY_LEVELS: readonly FidelityLevel[];
/** Human-readable label per level (CLI/docs). */
export declare const FIDELITY_LEVEL_LABELS: Record<FidelityLevel, string>;
/** One-line description per level (CLI/docs). */
export declare const FIDELITY_LEVEL_DESCRIPTIONS: Record<FidelityLevel, string>;
/** Next level up, or null at the top. */
export declare function nextFidelityLevel(level: FidelityLevel): FidelityLevel | null;
/** Clamp a level to at most `max` (escalation ceiling). */
export declare function clampFidelityLevel(level: FidelityLevel, max: FidelityLevel): FidelityLevel;
/** Parse a user-supplied level string; null when invalid. */
export declare function parseFidelityLevel(value: string): FidelityLevel | null;
/**
 * Split text into sentences. Newlines become spaces; splits on `.`/`!`/`?`
 * followed by whitespace (lookbehind keeps the terminator). Deterministic.
 */
export declare function splitSentences(text: string): string[];
/** Stored entities on a node (`metadata.entities`), lowercased + deduped. */
export declare function nodeEntities(node: MemoryNode): string[];
/**
 * L0 text: tags and entities only. Derived free from the existing entity
 * index/tags — nothing is generated or stored. Returns "" when the memory
 * has neither (such memories can only be reached at L1+).
 */
export declare function fidelityL0(node: MemoryNode): string;
/**
 * L1 text: typed fact statements. Entity-bearing sentences (matched
 * against the memory's own tags + stored entities via the existing
 * extraction pipeline) become `[type] sentence` facts; when no sentence
 * carries an entity, the lead sentence stands in. Deterministic,
 * template-based — no LLM.
 *
 * Falls back to the verbatim content when the facts would cost as much
 * as the content itself, keeping token counts non-increasing L1 ≤ L3.
 */
export declare function fidelityL1(node: MemoryNode): string;
/** True when the sentence carries a number, date, or negation. */
export declare function isInformationDense(sentence: string): boolean;
/**
 * TextRank-lite sentence centrality: similarity(i, j) =
 * |words_i ∩ words_j| / (log|words_i| + log|words_j|) (Mihalcea & Tarau
 * 2004), then PageRank over the similarity graph. Pure function, zero
 * LLM. Returns sentences ranked best-first (ties: original order).
 */
export declare function rankSentencesByCentrality(sentences: string[]): string[];
/**
 * L2 text: extractive summary — the top central sentences in original
 * order, capped at ~600 chars. Short content passes through unchanged
 * (nothing to compress). Never longer than verbatim, so L2 ≤ L3.
 *
 * A sleep-time LLM pass may later UPGRADE this slot to an abstractive
 * summary; the extractive path here is the guaranteed zero-LLM floor.
 */
export declare function fidelityL2(node: MemoryNode): string;
/**
 * Stamp generated L1/L2 text into the node's reserved metadata slot
 * (mutates the passed node object). Called at write time and by
 * `MemOS.compact()` backfill.
 */
export declare function stampFidelityCache(node: MemoryNode): {
    l1: string;
    l2: string;
};
/** True when the node already carries cached L1/L2 text. */
export declare function hasFidelityCache(node: MemoryNode): boolean;
/**
 * Text of a memory at a fidelity level. L1/L2 prefer the write-time
 * cache and generate lazily (pure, no writes) when missing.
 *
 * Image memories append their `[img:<ref>]` token at EVERY level. The
 * lower levels exist to save tokens (L0 is a tag/entity soup, L1 is
 * typed facts), and none of them carries `node.content` — so without
 * this append a memory findable at L0 would return prose with no way
 * to reach the image it describes. A memory that can be found but whose
 * image cannot be shown is a broken memory, so the token rides at every
 * level. Text nodes are untouched: no token is appended and their
 * rendered bytes are identical to before.
 */
export declare function levelText(node: MemoryNode, level: FidelityLevel): string;
/**
 * Score each doc against the query as IDF-weighted term coverage in
 * [0, 1]: the fraction of the query's IDF mass present in the doc.
 * 1.0 = every query term appears; 0.0 = none do. Local, zero-dependency,
 * deterministic — the hot-path scorer for level corpora.
 */
export declare function scoreLevelCorpus(query: string, docs: string[]): number[];
/** Cheap signals the router used for one query. */
export interface FidelitySignals {
    /** Canonicalized entities found in the query. */
    entities: string[];
    /** Query word count. */
    words: number;
    /** Question words present. */
    questionWords: string[];
    /** Explanatory/conceptual markers present. */
    explainWords: string[];
    /** Summarization markers present. */
    summaryWords: string[];
    /** Quoted spans or code identifiers present (high specificity). */
    quoted: boolean;
    /**
     * Decisive tokens the query carries — numbers, units, or negation.
     * When present, the served text must contain them too: a query
     * asking "why not 20" gets "pool = 40" as an answer otherwise.
     * `recall()` uses this to force escalation past a level that
     * merely has high term coverage.
     */
    decisiveTokens: string[];
}
/** Router output: starting level + why. */
export interface FidelityRoute {
    level: FidelityLevel;
    /** Human-readable reason (logged / surfaced in results). */
    reason: string;
    signals: FidelitySignals;
}
/**
 * Extract router entities: the standard pipeline
 * (`extractQueryEntities` + canonicalization) PLUS lowercase alias-table
 * vocabulary — "postgres" never surfaces as a capitalized entity but is
 * an unambiguous entity reference through the alias table.
 */
export declare function routerEntities(query: string): string[];
/**
 * Decisive tokens in a query: numbers (with optional units) and
 * negations. These are the tokens a bag-of-words coverage score
 * cannot judge: "pool size = 20" and "pool size reduced from 40"
 * score identically on term presence, and "not" is invisible to
 * every set-membership scorer. When the query carries one and the
 * served text lacks it, `recall()` must escalate regardless of the
 * coverage score.
 */
export declare function queryDecisiveTokens(query: string): string[];
/** True when `text` contains the decisive token (number or negation). */
export declare function textHasDecisiveToken(text: string, token: string): boolean;
/**
 * Pick the STARTING fidelity level for a query. Local heuristics, no
 * LLM. Rule: start low, escalate on demand (escalation happens in
 * `MemOS.recall()` when the result set looks insufficient).
 *
 * Rules (first match wins):
 *   1. Entity lookup (≥1 entity, ≤4 words, no question/explain
 *      words, NO decisive token) → L0. Tags+entities answer "which
 *      memory is about X" — a retrieval affordance, not an answer.
 *   2. Entity-anchored factoid, OR any query carrying a decisive
 *      token (number/unit/negation) → L1. Typed facts carry the
 *      answer; the decisive-token check in `recall()` escalates if
 *      the token is still absent at L1.
 *   3. Explanatory / conceptual (why/how/explain/…) → L3.
 *      Nuance and reasoning don't survive compression.
 *   4. Summarization request or long narrative query (≥30 words) → L2.
 *   5. Open question (what/which/who/when/where/tell, no entity) → L2.
 *      Summary first; escalate on miss.
 *   6. Fallback → L1 (cheap, structured, usually sufficient).
 *
 * L0 is never the terminal level for a content question: `recall()`
 * treats an L0-only hit as insufficient and escalates even when the
 * caller passed `fidelity: "adaptive"`.
 */
export declare function routeFidelity(query: string): FidelityRoute;
/** Options for `MemOS.recall()` — additive; nothing here changes search(). */
export interface FidelityRecallOptions {
    /**
     * Starting fidelity level, or `"adaptive"` to let `routeFidelity()`
     * choose from query signals. Default `"L3"` — verbatim output,
     * behavior-preserving for existing consumers.
     */
    fidelity?: FidelityLevel | "adaptive";
    /**
     * Escalation ceiling: recall never serves above this level, even when
     * the result set looks insufficient. Default `"L3"`.
     */
    maxFidelity?: FidelityLevel;
    /** Max results returned. Default 20. */
    limit?: number;
    /**
     * Minimum [0,1] coverage score for a hit. Results below it trigger
     * escalation (or are dropped at the ceiling). Default 0.15.
     */
    threshold?: number;
    /**
     * Escalate when fewer than this many hits clear the threshold.
     * Default 1.
     */
    minResults?: number;
    /**
     * Escalation floor: never serve a level below this, even via
     * `fidelity: "adaptive"`. Default `"L1"` — L0 (tags+entities) is a
     * retrieval affordance, not an answer, so an adaptive call never
     * stops there. Pass `"L0"` to opt back into tag soup (an explicit
     * contract: the caller wants "which memory is about X").
     */
    minLevel?: FidelityLevel;
    /**
     * Force escalation when the query carries a decisive token
     * (number/unit/negation) that the served text lacks. Default true:
     * IDF coverage scores "pool size = 20" and "pool size was reduced
     * from 40" identically, so this is the only signal that notices the
     * decisive token went missing during compaction. Set false to
     * restore pure coverage-gated escalation.
     */
    escalateOnMissingDecisiveToken?: boolean;
    /** Scope the candidate set (namespace/type/tags/pool). */
    filter?: SearchFilter;
    /**
     * Scope recall to one authoring harness (e.g. `"claude-code"`), or
     * `"all"` (default) for the behavior-preserving cross-harness
     * recall. `filter.harness` is honored too; this top-level option
     * wins when both are set.
     */
    harness?: string;
}
/** One recalled memory with its served fidelity level. */
export interface FidelityRecallResult {
    /** The full memory node (identity preserved; text served at `level`). */
    node: MemoryNode;
    /** Level the text was served at (after escalation). */
    level: FidelityLevel;
    /** `levelText(node, level)` — what the caller should inject. */
    text: string;
    /** [0,1] coverage score at the final level. */
    score: number;
    /** Levels attempted before the final one (empty when none). */
    escalations: FidelityLevel[];
    /** Router output — present only when `fidelity: "adaptive"`. */
    route?: FidelityRoute;
}
/** Default escalation floor: L0 is a retrieval affordance, not an answer. */
export declare const DEFAULT_MIN_FIDELITY_LEVEL: FidelityLevel;
/**
 * Composition guard for `fidelity` × `compression` (audit finding 7f).
 *
 * `compressText` is a stopword-class filter. Applied to an item that
 * is ALREADY a compressed fidelity level (L1 typed facts, L2
 * extractive summary), it strips the connective tissue that made the
 * summary readable — on top of the sentence-selection loss that
 * already happened. Two lossy passes composed: the result is
 * terser but materially less answerable than either pass alone.
 *
 * So when an item was rendered below L3, budget compression is
 * skipped (the item is admitted as-is, or dropped if it still
 * doesn't fit — exactly as it was before compression existed).
 * L3 verbatim text has its full prose structure to lose and is the
 * only level where the filter is a net win.
 */
export declare function shouldCompressFidelityItem(fidelity: FidelityLevel | undefined): boolean;
/**
 * Resolve the effective start level + ceiling for a recall call.
 *
 * The start level is additionally clamped UP to the escalation floor
 * (`minLevel`, default L1) unless the caller explicitly requested L0:
 * an adaptive route may pick L0 for "postgres pool size", but serving
 * tag soup as the answer is a category error, so the floor lifts it
 * to L1.
 */
export declare function resolveRecallLevels(query: string, opts?: FidelityRecallOptions): {
    start: FidelityLevel;
    max: FidelityLevel;
    floor: FidelityLevel;
    route?: FidelityRoute;
};
/**
 * Whether the hits at the current level are sufficient, or the call
 * must escalate. Two conditions beyond raw coverage:
 *
 * 1. `floor` — never serve L0 unless the caller explicitly asked for
 *    it. Tags+entities answer "which memory", not "what is the value".
 * 2. Decisive tokens — when the query carries a number/unit/negation
 *    and the served text lacks it, escalate even at full coverage:
 *    "pool size = 20" and "pool size reduced from 40" both score 1.0
 *    on term presence, and only one of them answers the question.
 */
export declare function fidelityLevelSufficient(query: string, level: FidelityLevel, docs: string[], opts: {
    floor: FidelityLevel;
    checkDecisiveTokens: boolean;
}): boolean;
/** Per-level token stats over a set of memories. */
export interface FidelityLevelStats {
    level: FidelityLevel;
    label: string;
    description: string;
    /** Memories measured. */
    count: number;
    /** Mean tokens per memory at this level. */
    avgTokens: number;
    /** Total tokens across all measured memories. */
    totalTokens: number;
    /**
     * Fraction of tokens saved vs verbatim (L3): 0.9 = 90% fewer tokens.
     * 0 for L3 itself.
     */
    savingsVsVerbatim: number;
}
/**
 * Measure tokens per fidelity level over `nodes`. `tokenCounter` is
 * injected (callers pass the pack-grade `estimateTokens`) so this module
 * stays dependency-free.
 */
export declare function fidelityStats(nodes: MemoryNode[], tokenCounter: (text: string) => number): FidelityLevelStats[];
/** Options for `MemOS.compact()`. */
export interface CompactOptions {
    /** Only backfill this namespace. */
    namespace?: string;
    /** Cap the number of memories scanned. */
    limit?: number;
    /** Include per-level token stats in the result. */
    stats?: boolean;
    /** Compute stats but don't write anything. */
    dryRun?: boolean;
}
/** Result of `MemOS.compact()`. */
export interface CompactResult {
    scanned: number;
    /** Memories that received newly generated L1/L2. */
    backfilled: number;
    /** Memories that already had cached levels. */
    skipped: number;
    stats?: FidelityLevelStats[];
}
//# sourceMappingURL=fidelity.d.ts.map