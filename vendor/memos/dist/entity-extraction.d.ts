/**
 * Entity extraction for fused retrieval scoring.
 *
 * The third retrieval signal alongside keyword (FTS5) and semantic
 * (embedding) legs: memories whose stored entities overlap the query's
 * entities get a post-fusion boost. This mirrors the 2026 fused
 * multi-signal retrieval consensus (semantic + BM25 + entity match).
 *
 * The extractor is deliberately lightweight and dependency-free —
 * capitalized multi-word sequences, acronyms, quoted strings, and
 * code-identifier shapes. It runs on every hybrid search, so it must
 * stay in the sub-millisecond class. Entities for a memory are captured
 * at write time into `metadata.entities` (see `MemOS.store`), so the
 * per-candidate overlap check is a set intersection, not a rescan.
 *
 * @module @mem-os/entity-extraction
 */
/**
 * Extract candidate entities from free text.
 *
 * Returns lowercase-normalized entities so overlap checks are
 * case-insensitive. Order is stable (first appearance), duplicates are
 * removed. Sentence-initial capitalization is ignored (it's grammatical,
 * not a name), which keeps "Fix the parser" from yielding "fix".
 */
export declare function extractQueryEntities(text: string): string[];
/**
 * Overlap between query entities and a memory's stored entities
 * (`metadata.entities`) and tags, in [0, 1]. Jaccard-style: shared
 * count over the smaller set, so a single match on a 1-entity query
 * counts fully.
 */
export declare function entityOverlap(queryEntities: readonly string[], node: {
    tags?: readonly string[];
    metadata?: {
        entities?: unknown;
    };
}): number;
/**
 * Built-in alias table mapping surface forms to a canonical entity.
 * Lexical extraction alone yields "Postgres", "PostgreSQL", and "pg" as
 * three different entities; canonicalizing through this map (plus any
 * deployment-specific `MemOSConfig.entityAliases`) collapses them so the
 * overlap signal fires across phrasings.
 */
export declare const BUILTIN_ENTITY_ALIASES: Readonly<Record<string, string>>;
/**
 * Canonicalize extracted entities through the built-in alias table plus
 * any deployment-specific aliases (from `MemOSConfig.entityAliases`,
 * which wins over built-ins). Deduplicates after mapping, preserving
 * first-appearance order.
 */
export declare function canonicalizeEntities(entities: readonly string[], extraAliases?: Readonly<Record<string, string>>): string[];
//# sourceMappingURL=entity-extraction.d.ts.map