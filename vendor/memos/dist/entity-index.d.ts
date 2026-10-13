/**
 * First-class entity index: an entity → memories inverted table in SQLite.
 *
 * MemOS already had an entity *signal* — the post-fusion entity-overlap
 * boost in `fuseResults` (`src/retrieval.ts`) — but it could only re-score
 * candidates the keyword (FTS5) and semantic legs had already retrieved.
 * Memories that share entities with the query yet were missed by both
 * legs never entered the candidate pool at all. This module closes that
 * recall gap: every node's canonical entities are mirrored into the
 * `entity_index` table at write time (following the `node_tags` join-table
 * pattern), and `searchByEntities` turns query entities into a ranked
 * candidate list that `MemOS.hybridSearch` fuses as a third RRF leg.
 *
 * This is the local, no-LLM analogue of the entity channel behind mem0
 * v3's reported +20/+26 point jump and HippoRAG's entity-node gains: the
 * extractor is the existing dependency-free lexical one
 * (`src/entity-extraction.ts`), and the index is a plain B-tree — no
 * embedding or graph traversal on the hot path.
 *
 * @module @mem-os/entity-index
 */
import type Database from "better-sqlite3";
/** One ranked hit from {@link searchByEntities}. */
export interface EntityIndexMatch {
    /** The matched node's id. */
    nodeId: string;
    /** How many of the query entities this node matched. */
    matches: number;
}
/**
 * Create the `entity_index` inverted table and its lookup index when
 * missing. Migration-safe (`IF NOT EXISTS`): pre-existing databases gain
 * the table on the next `init()` with no schema-version bump, and
 * {@link backfillEntityIndex} populates it from existing rows.
 *
 * Node deletions cascade (`ON DELETE CASCADE` + `PRAGMA foreign_keys =
 * ON`), so no explicit cleanup is needed on the delete path.
 */
export declare function ensureEntityIndexTable(db: Database.Database): void;
/**
 * Extract + canonicalize entities from free text (lowercase-normalized,
 * deduped, first-appearance order). Used when no pre-canonicalized entity
 * list is on hand — legacy rows in the backfill, or rows written straight
 * through storage bypassing `MemOS.store`. `extraAliases` mirrors
 * `MemOSConfig.entityAliases` (storage itself has no config, so the
 * write/backfill paths pass none and get the built-in table).
 */
export declare function extractContentEntities(content: string, extraAliases?: Readonly<Record<string, string>>): string[];
/**
 * Normalize raw entity strings for index storage: lowercase + trim +
 * dedupe, preserving first-appearance order. The index is always
 * lowercase, so lookups are case-insensitive by construction.
 */
export declare function normalizeEntities(entities: readonly unknown[]): string[];
/**
 * Full re-sync of one node's entity rows: deletes stale rows, then
 * inserts the normalized set (`INSERT OR IGNORE` keeps it idempotent).
 * Runs inside the caller's transaction — call from `saveNode` /
 * `updateNode` next to their `node_tags` mirrors.
 */
export declare function writeEntityIndexRows(db: Database.Database, nodeId: string, entities: readonly unknown[]): void;
/**
 * Index one node's entities from its content: extracts with
 * `extractQueryEntities` + `canonicalizeEntities` and stores
 * lowercase-normalized rows. Prefer passing the write-time canonicalized
 * `metadata.entities` via {@link writeEntityIndexRows} when available
 * (it was canonicalized with the deployment's `entityAliases`); this
 * content-based variant is the fallback for rows that lack it.
 */
export declare function indexNodeEntities(db: Database.Database, nodeId: string, content: string, extraAliases?: Readonly<Record<string, string>>): void;
/**
 * Remove every index row for a node. Node deletes are normally handled by
 * the `ON DELETE CASCADE` foreign key — this is for explicit re-syncs.
 */
export declare function removeNodeEntities(db: Database.Database, nodeId: string): void;
/**
 * Ranked entity-leg lookup: node ids whose indexed entities intersect
 * `entities`, ordered by matched-entity count (desc) with node id as the
 * deterministic tiebreak. Returns `{ nodeId, matches }` pairs, best
 * first — the caller (hybrid search) resolves ids to nodes and fuses the
 * list as the third RRF leg.
 */
export declare function searchByEntities(db: Database.Database, entities: readonly string[], limit: number): EntityIndexMatch[];
/**
 * One-time backfill for rows that predate the `entity_index` table (or
 * lost their rows out-of-band). For each node missing from the index,
 * prefers the stored `metadata.entities` — already canonicalized with the
 * deployment's aliases at write time — and falls back to extracting from
 * content. Idempotent: nodes already present in the index are skipped and
 * inserts use `INSERT OR IGNORE`, so re-running is a no-op.
 */
export declare function backfillEntityIndex(db: Database.Database): void;
//# sourceMappingURL=entity-index.d.ts.map