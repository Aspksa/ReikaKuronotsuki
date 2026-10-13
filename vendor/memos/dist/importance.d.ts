/**
 * Effective importance model for MemOS memory nodes.
 *
 * The stored `importance` field is the *base* score assigned at write time
 * (or manually via `update`). It never changes on its own. This module
 * derives an *effective* importance at read time by combining:
 *
 *   1. Recency decay — memories not accessed recently slide toward a
 *      configurable floor (never below `decayFloor` × the boosted base,
 *      so a memory can't vanish by aging alone). The age is measured
 *      from the first available of `lastAccessed` → `createdAt` →
 *      `updatedAt`, so imported rows that never recorded an access are
 *      not mistaken for ancient ones.
 *   2. Access reinforcement — each retrieval adds a small, logarithmic
 *      boost (capped), so frequently-used memories outrank equally-aged
 *      ones that are never touched. The boost itself also decays, so a
 *      memory does not stay permanently fresh on reinforcement alone.
 *
 * The model is pure computation over node fields — it performs no writes.
 * This deliberately keeps it compatible with the access-count debounce:
 * effective importance is recomputed whenever eviction, archival, or
 * ranking needs it, instead of being materialised back into the row.
 *
 * @module @memos/importance
 */
import type { MemoryNode } from "./types.js";
/** Tuning knobs for the effective importance model. */
export interface ImportanceConfig {
    /**
     * Half-life (in days) of the recency decay applied to the base
     * importance. `0` disables decay. Default 30.
     */
    halfLifeDays?: number;
    /**
     * Floor for the decay factor — the multiplicative decay never drops
     * the base importance below `decayFloor` × base. Default 0.5.
     */
    decayFloor?: number;
    /**
     * Reinforcement gained per `log2(1 + accessCount)` unit. Default 0.1.
     */
    accessGain?: number;
    /**
     * Upper bound on the total access boost. Default 0.3.
     */
    accessCap?: number;
    /**
     * Weight of EFFECTIVE importance in hybrid-search ranking (see
     * {@link importanceRankFactor}). `0` keeps ranking on raw relevance
     * and leaves the effective model to eviction/archival decisions only.
     *
     * Only consulted when the `importance` block itself is configured:
     * an unset `importance` keeps ranking byte-identical to the
     * pre-wiring pipeline. Default 0.25.
     */
    rankingWeight?: number;
}
/**
 * Default weight of effective importance in hybrid-search ranking.
 *
 * 0.25 maps effective importance 0.5 (neutral) to a ×1.0 multiplier and
 * the full [0,1] range to [0.75, 1.25] — strong enough to reorder
 * near-tied candidates, never enough to beat a genuine relevance gap.
 */
export declare const DEFAULT_IMPORTANCE_RANK_WEIGHT = 0.25;
/** Resolved defaults for {@link ImportanceConfig}. */
export declare const DEFAULT_IMPORTANCE_CONFIG: Required<ImportanceConfig>;
/**
 * Compute the effective importance of a node at a point in time.
 *
 * Formula:
 *   decay       = decayFloor + (1 - decayFloor) · e^(−ageDays / halfLifeDays)
 *   accessBoost = min(accessCap, accessGain · log2(1 + accessCount))
 *   effective   = clamp01((importance + accessBoost) · decay)
 *
 * `ageDays` is measured from the {@link recencyAnchor} chain
 * (`lastAccessed` → `createdAt` → `updatedAt` → `now`), so a row whose
 * `lastAccessed` was never set — imported, migrated, or externally
 * supplied — decays from its write time instead of from the epoch.
 *
 * The decay multiplies the *boosted* total, so access reinforcement is
 * no longer immune to aging: a heavily-read memory still outranks an
 * equally-scored untouched one, but both slide toward the floor together.
 *
 * @param node — The memory node.
 * @param now  — Current time (Unix ms).
 * @param cfg  — Optional tuning overrides.
 * @returns Effective importance in [0, 1].
 */
export declare function computeEffectiveImportance(node: Pick<MemoryNode, "importance" | "accessCount" | "lastAccessed" | "createdAt" | "updatedAt">, now: number, cfg?: ImportanceConfig): number;
/**
 * Recency score for ranking boosts — pure exponential decay from the
 * last access, in [0, 1] (1 = touched right now).
 *
 * The age anchor follows the same {@link recencyAnchor} fallback chain as
 * {@link computeEffectiveImportance}, so a row that never recorded an
 * access scores as fresh rather than as a zero.
 *
 * @param node — The memory node.
 * @param now  — Current time (Unix ms).
 * @param halfLifeDays — Days for the score to halve. `0` returns 1 (disabled).
 * @returns Recency score in [0, 1].
 */
export declare function recencyScore(node: Pick<MemoryNode, "lastAccessed" | "createdAt" | "updatedAt">, now: number, halfLifeDays?: number): number;
/**
 * Multiplicative ranking factor derived from an effective-importance
 * value.
 *
 * Maps `effective = 0.5` (neutral) to `1.0`, the full [0,1] range to
 * `[1 - w, 1 + w]`, and clamps `weight` to [0,1]. Used by
 * `hybridSearch`'s post-fusion chain so effective importance nudges the
 * ranking without ever dominating pure relevance.
 *
 * @param effective — Output of {@link computeEffectiveImportance}.
 * @param weight — `ImportanceConfig.rankingWeight` (default 0.25).
 */
export declare function importanceRankFactor(effective: number, weight?: number): number;
//# sourceMappingURL=importance.d.ts.map