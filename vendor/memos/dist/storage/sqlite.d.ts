/**
 * SQLite-backed storage adapter for MemOS.
 *
 * Uses `better-sqlite3` for synchronous, high-performance local persistence.
 * Full-text search is powered by SQLite FTS5.
 *
 * @module @memos/storage/sqlite
 */
import Database from "better-sqlite3";
import type { StorageAdapter, ContradictionRecord, ContradictionStatus, NewProceduralLesson, ProceduralLesson, MemoryNode, NewTamperLogEntry, TamperLogEntry, MemoryEdge, SearchFilter, ScoredMemory, GraphSnapshot, UpdateMemoryInput, EdgeRelation, EmbeddingVector, EmbeddingRecordInfo } from "../types.js";
/**
 * Default database path: `~/.memos/memos.db`.
 */
export declare function defaultDbPath(): string;
/** How the semantic leg chooses which stored vectors to score. */
export type SemanticScanMode = "exact" | "prefilter";
/**
 * Telemetry for the most recent `querySimilarEmbeddings` call. Lets
 * callers (and tests) see which parts of the scan actually ran without
 * depending on wall-clock timings, which are useless in CI.
 */
export interface SemanticScanStats {
    /** Candidate ids selected by SQL for the scan. */
    candidates: number;
    /** Candidates served straight from the in-memory vector cache. */
    cacheHits: number;
    /**
     * Squared norms computed during the scan — one per vector hydrated
     * from SQLite. `0` means every norm was already cached, which is the
     * steady state for a warm store.
     */
    normComputations: number;
    /**
     * Candidates that fell back to the legacy JSON-stored-vector path:
     * never cached, so their vector AND norm are re-parsed on every query.
     * Non-zero only for databases written before the float32 BLOB format.
     */
    legacyRows: number;
    /** Candidates dropped by the coarse prefilter (0 in `"exact"` mode). */
    prefilterSkipped: number;
    /** Candidates exactly rescored after the prefilter. */
    rescored: number;
    /** True when the scan stopped early because a perfect match was found. */
    earlyExit: boolean;
}
/**
 * Tokenize a natural-language query into individually quoted FTS5
 * terms.
 *
 * The query is split on non-alphanumeric boundaries, lowercased, and
 * function words are dropped. Each surviving term is double-quoted
 * (escaping any embedded quote) so FTS5 special characters cannot
 * inject syntax.
 *
 * If stopword removal empties the query (e.g. "what is it"), the raw
 * tokens are used instead so the search never degrades to a
 * match-everything no-op.
 *
 * @param query — Raw user query text.
 * @returns Quoted FTS5 terms, e.g. `['"dark"', '"mode"']`.
 */
export declare function buildFtsTerms(query: string): string[];
/**
 * Build an FTS5 MATCH expression from a natural-language query.
 *
 * Terms are joined with `operator` — `" AND "` for precision (every
 * term must appear) or `" OR "` for recall (any term may appear).
 *
 * @param query — Raw user query text.
 * @param operator — Join operator between terms. Default `" AND "`.
 * @returns An FTS5 MATCH expression, e.g. `"dark" AND "mode"`.
 */
export declare function buildFtsQuery(query: string, operator?: " AND " | " OR "): string;
/**
 * SQLite storage implementation.
 */
export declare class SQLiteStorage implements StorageAdapter {
    private db;
    private cipherKey;
    private readonly path;
    private readonly wal;
    /**
     * Per-id access count delta buffer. Batched into a single UPDATE per
     * id on a 500 ms debounce. Removes the read-modify-write write that
     * was previously amplified to a `SET access_count = access_count + 1`
     * on every `getNode` call. See {@link flushAccessCounts}.
     */
    private readonly accessBuffer;
    private accessFlushTimer;
    private accessFlushIntervalMs;
    /**
     * Create a new SQLiteStorage instance.
     *
     * @param path — Filesystem path to the `.db` file.
     * @param wal  — Enable WAL journal mode (recommended).
     */
    constructor(path: string, wal?: boolean, options?: {
        vectorCacheEntries?: number;
        cipherKey?: string;
        /**
         * How `querySimilarEmbeddings` picks which stored vectors to score.
         * `"exact"` (default) scores every candidate. `"prefilter"` ranks
         * candidates with a coarse prefix projection first and exactly
         * rescodes only the top-N — bounded work at large corpus sizes,       * APPROXIMATE (a true neighbour ranked below the cutoff can be
         * missed). Set via `MemOSConfig.storageOptions.semanticScan`.
         */
        semanticScan?: SemanticScanMode;
    });
    /**
     * Open the database file, switching to the cipher-capable driver and
     * applying `PRAGMA key` when encryption is configured. The key MUST be
     * set before any other statement on an encrypted database.
     */
    private openDatabase;
    /**
     * Open the database and create tables / indices if they do not exist.
     */
    init(): Promise<void>;
    /**
     * One-time backfill: for every node, read the JSON `tags` column and
     * ensure each tag exists in `node_tags`. Idempotent thanks to
     * `INSERT OR IGNORE`. Runs inside a single transaction so a 100k-node
     * database finishes in well under a second on a warm cache.
     */
    private migrateBackfillNodeTags;
    /**
     * One-time backfill of the `entity_index` inverted table for pre-existing
     * rows (databases created before the table existed). Idempotent — nodes
     * already present in the index are skipped. Delegates to
     * `src/entity-index.ts`, which prefers each row's stored
     * `metadata.entities` (canonicalized with the deployment's aliases at
     * write time) and falls back to extracting from content.
     */
    private migrateBackfillEntityIndex;
    /**
     * Replace the `node_tags` rows for a single node. Used after
     * `saveNode` / `updateNode` to keep the join table in lockstep with
     * the JSON column.
     *
     * Runs inside the caller's transaction (saveNode/updateNode wrap their
     * write + this call in one `db.transaction`) and reuses cached prepared
     * statements — previously each call paid two uncached `db.prepare()`
     * parses plus its own transaction commit.
     */
    private writeNodeTags;
    /**
     * ── item2: entity leg ── mirror a node's entities into the
     * `entity_index` inverted table, keeping it in lockstep with the node
     * row (the entity analogue of `writeNodeTags`). Runs inside the
     * caller's transaction (`saveNode` / `updateNode`).
     *
     * Prefers the write-time canonicalized `metadata.entities` — `MemOS.store`
     * canonicalizes with the deployment's `entityAliases`, so reusing it
     * keeps the index consistent with query-time canonicalization. Falls
     * back to extracting from content (built-in aliases) for rows written
     * straight through storage.
     */
    private writeNodeEntities;
    /**
     * Migration-safe column addition. Checks if column exists before ALTER TABLE.
     * SQLite does not support ALTER TABLE IF NOT EXISTS, so we check pragmatically.
     */
    private migrateAddColumn;
    saveNode(node: MemoryNode): Promise<MemoryNode>;
    getNode(id: string): Promise<MemoryNode | null>;
    /**
     * Record a read access. Routes through the same debounced
     * `accessBuffer` as `getNode`, so a search that touches the top N
     * results costs one coalesced UPDATE per id instead of a
     * read-modify-write per hit — and, critically, does NOT stamp
     * `updated_at`.
     */
    recordAccess(id: string): void;
    private bufferAccess;
    private scheduleAccessFlush;
    /** Drain the buffered access counters to SQLite. */
    flushAccessCounts(): void;
    peekNode(id: string): Promise<MemoryNode | null>;
    evictLeastImportant(): Promise<string | null>;
    updateNode(id: string, input: UpdateMemoryInput): Promise<MemoryNode | null>;
    deleteNode(id: string): Promise<boolean>;
    appendTamperEntry(entry: NewTamperLogEntry): Promise<TamperLogEntry>;
    readTamperLog(): Promise<TamperLogEntry[]>;
    saveEdge(edge: MemoryEdge): Promise<MemoryEdge>;
    /**
     * Batch-insert multiple edges in a single transaction.
     * Uses a cached prepared statement — ~10x faster than calling
     * saveEdge() in a loop for 10+ edges.
     */
    saveEdgesBatch(edges: MemoryEdge[]): Promise<MemoryEdge[]>;
    /**
     * Prepared statement cache. better-sqlite3 caches at the C++ level,
     * but the JS Statement wrapper is still recreated on each prepare()
     * call. Caching the JS object avoids that overhead on hot paths.
     */
    private readonly stmtCache;
    private getPreparedStatement;
    getEdge(id: string): Promise<MemoryEdge | null>;
    deleteEdge(id: string): Promise<boolean>;
    /**
     * Close (invalidate) the currently-valid edges incident to a node by
     * stamping `valid_to`. Rows are updated, never deleted — as-of reads at
     * earlier timestamps still return them. Returns the number of edges closed.
     */
    closeEdgesForNode(nodeId: string, validTo: number): Promise<number>;
    queryNodes(filter?: SearchFilter): Promise<ScoredMemory[]>;
    saveEmbedding(nodeId: string, vector: EmbeddingVector, model: string): Promise<void>;
    getEmbeddingInfo(nodeId: string): Promise<EmbeddingRecordInfo | null>;
    /**
     * Bulk-fetch stored embedding vectors for the given node ids —
     * the write-time contradiction scan's bounded neighbor lookup.
     * Cache hits are zero-cost; misses are fetched in chunks of 500
     * (SQLite bound-parameter limits). Returns only ids with a stored
     * vector.
     */
    getEmbeddingVectors(nodeIds: string[]): Promise<Map<string, EmbeddingVector>>;
    /**
     * Record a contradiction pair. Node ids are canonicalized (sorted)
     * so the UNIQUE(node_a, node_b) constraint dedups reversed pairs;
     * INSERT OR IGNORE makes repeat detection idempotent.
     */
    addContradiction(nodeA: string, nodeB: string, status?: ContradictionStatus): Promise<ContradictionRecord>;
    /**
     * Bounded read-time lookup: recorded contradiction pairs where
     * node_a OR node_b is in `nodeIds`. Empty input returns [] without
     * touching the database.
     */
    getContradictionPairsFor(nodeIds: string[]): Promise<ContradictionRecord[]>;
    updateContradictionStatus(id: string, status: ContradictionStatus): Promise<void>;
    private rowToContradiction;
    saveProceduralLesson(input: NewProceduralLesson): Promise<ProceduralLesson>;
    getProceduralLesson(id: string): Promise<ProceduralLesson | null>;
    updateProceduralLesson(id: string, patch: Partial<ProceduralLesson>): Promise<ProceduralLesson | null>;
    listProceduralLessons(namespace?: string): Promise<ProceduralLesson[]>;
    private rowToProceduralLesson;
    /**
     * Bounded id-prefix lookup backing citation resolution. Dashes in
     * stored ids are ignored so `[mem:a3f9]` matches `a3f9c2e1-…`.
     */
    findNodesByIdPrefix(prefix: string): Promise<MemoryNode[]>;
    getAllEmbeddingInfos(): Promise<Array<{
        nodeId: string;
    } & EmbeddingRecordInfo>>;
    getAllEmbeddings(): Promise<Array<{
        nodeId: string;
        vector: EmbeddingVector;
        model: string;
    }>>;
    setNodeNamespace(id: string, namespace: string): Promise<void>;
    querySimilarEmbeddings(vector: EmbeddingVector, filter: SearchFilter | undefined, limit: number, threshold?: number, model?: string): Promise<ScoredMemory[]>;
    /**
     * Query image memories by CLIP vector similarity.
     *
     * Identical scoring to `querySimilarEmbeddings` — the scan loop is
     * table-agnostic — but runs against `image_embeddings` and filters on
     * model + dimensions, so a text-space vector can never be scored
     * against a CLIP query (or vice versa).
     *
     * The hook for image→image search is already here: pass an
     * *image-encoded* query and the same call returns the nearest
     * neighbouring images ("more like this screenshot").
     */
    querySimilarImages(vector: EmbeddingVector, filter: SearchFilter | undefined, limit: number, threshold?: number, model?: string): Promise<ScoredMemory[]>;
    /**
     * The shared semantic scan. `space` selects the vector table
     * (`embeddings` vs `image_embeddings`) AND the vectorCache namespace,
     * so the two spaces can never cross even when one nodeId carries both.
     */
    private scanSimilar;
    /**
     * Rank candidate ids by cosine against a strided prefix projection of
     * each stored vector (opt-in prefilter path). The projection is built
     * once per stored row and cached with it, so repeat queries pay only
     * the `dims / PREFILTER_STRIDE` dot product per candidate.
     *
     * Approximate by design: it orders candidates, it does not certify
     * them. Callers must rescore the survivors exactly.
     */
    private rankByProjection;
    /**
     * Strided prefix projection used by the prefilter. Built lazily on the
     * first prefilter query so the exact path never pays for it.
     */
    private project;
    getEmbeddingModelCounts(): Promise<Array<{
        model: string;
        count: number;
    }>>;
    deleteEmbeddingsByModel(model: string): Promise<number>;
    saveImageEmbedding(nodeId: string, vector: EmbeddingVector, model: string): Promise<void>;
    getImageEmbeddingInfo(nodeId: string): Promise<EmbeddingRecordInfo | null>;
    getAllImageEmbeddings(): Promise<Array<{
        nodeId: string;
        vector: EmbeddingVector;
        model: string;
    }>>;
    getImageEmbeddingModelCounts(): Promise<Array<{
        model: string;
        count: number;
    }>>;
    deleteImageEmbedding(nodeId: string): Promise<boolean>;
    deleteImageEmbeddingsByModel(model: string): Promise<number>;
    queryEdges(filter?: {
        sourceId?: string;
        targetId?: string;
        relation?: EdgeRelation;
        validAt?: number;
    }): Promise<MemoryEdge[]>;
    getGraph(): Promise<GraphSnapshot>;
    /**
     * Bitemporal as-of graph read: nodes and edges whose validity interval
     * covers `atTime` (unix ms). Predicates mirror the existing as-of read
     * paths exactly — nodes use `valid_to >= ?` (see the `validAt` search
     * filter), edges use strict `valid_to > ?` (see `queryEdges`).
     */
    getGraphAtTime(atTime: number): Promise<GraphSnapshot>;
    setTTL(id: string, seconds: number): Promise<void>;
    clearTTL(id: string): Promise<void>;
    sweepExpired(): Promise<number>;
    queryNodesByTag(tag: string): Promise<MemoryNode[]>;
    /**
     * ── item2: entity leg ── candidate generation for hybrid search: node
     * ids whose indexed entities intersect `entities`, ranked by number of
     * matched entities (desc), node id tiebreak. Backed by the
     * `entity_index` inverted table — O(indexed entities), no content scan.
     */
    searchByEntities(entities: string[], limit: number): Promise<Array<{
        nodeId: string;
        matches: number;
    }>>;
    /**
     * Per-harness memory counts for `memos harness list`. Legacy and
     * unattributed rows read as `"unknown"` via the column default.
     */
    getHarnessCounts(): Promise<Array<{
        harness: string;
        count: number;
    }>>;
    /**
     * Full node snapshot for harness merges (`memos harness merge
     * --from`). Returns EVERYTHING — including historical (superseded)
     * and quarantined rows — so the merge preserves the bitemporal
     * version ledger verbatim. Read-only; the merge writes through the
     * target storage's normal save path.
     */
    listAllNodes(): Promise<MemoryNode[]>;
    /**
     * Full edge snapshot for harness merges. Endpoints are remapped by
     * the merge when node ids collide in the target.
     */
    listAllEdges(): Promise<MemoryEdge[]>;
    deleteAllNodes(): Promise<void>;
    close(): Promise<void>;
    private rowToNode;
    private rowToEdge;
    /**
     * In-process parsed-vector cache (nodeId -> vector + derived norms).
     * The semantic leg otherwise re-fetches EVERY stored vector BLOB from
     * SQLite on every query (tens of MB of memcpy per query on large
     * stores). Writes go through this class, so invalidation is exact;
     * external writers are not tracked (single-process deployments are the
     * supported shape — the Python bridge runs one Node process).
     *
     * The entry bundles the squared L2 norm with the vector: it is
     * computed once per stored row instead of once per query, and it is
     * invalidated by the same `set`/eviction/clear that invalidates the
     * vector itself, so it can never disagree with the stored row.
     */
    private vectorCache;
    private vectorCacheMaxEntries;
    private semanticScanMode;
    private vectorCacheGet;
    private vectorCacheSet;
    /**
     * Telemetry for the last `querySimilarEmbeddings` call. Read-only: the
     * scan fills it in, nothing else mutates it.
     */
    private semanticScanTelemetry;
    /** Scan telemetry for the most recent semantic query. */
    get semanticScanStats(): SemanticScanStats;
    private lookupStoredVector;
    /**
     * Zero-copy Float32Array view over a float32 BLOB. Byte-order and values
     * are identical to `parseEmbedding`'s BLOB branch; alignment is guarded
     * (Node Buffers are 8-byte aligned from the pool, but a sliced view may
     * not be 4-byte aligned — those fall back to `parseEmbedding`).
     */
    private parseEmbeddingF32;
    private parseEmbedding;
    private serializeEmbedding;
    private mapSortField;
    private buildTagFilter;
    private buildMetadataFilter;
    /**
     * Namespace/scope predicate shared by the FTS and structured query
     * paths. Covers exact (`namespace`), multi (`namespaces`), and
     * hierarchical (`namespacePrefix`) constraints. When
     * `includeSharedScope` is set, the shared `default` namespace is OR'd
     * in — a scoped read always sees shared memories (company-brain
     * container semantics). Returns null when no namespace constraint is
     * present (unscoped searches are untouched).
     */
    private buildNamespaceCondition;
    /**
     * Scoped-space inventory: every namespace with its live memory count.
     * Powers `memos scope list`.
     */
    listNamespaces(): Promise<Array<{
        namespace: string;
        count: number;
    }>>;
}
/**
 * Load the cipher-capable driver (an API-compatible better-sqlite3 fork
 * with multiple-cipher support). Kept optional: installs without it keep
 * the default plaintext driver and never load this module. Exported for
 * the `memos encrypt` / `memos decrypt` CLI commands.
 */
export declare function loadCipherDriver(): typeof Database;
/**
 * Encrypt a plaintext database in place. The original file is preserved
 * as `<path>.plaintext.bak`. Uses the standard sqlcipher_export recipe.
 * Returns the backup path.
 */
export declare function encryptDatabase(dbPath: string, key: string): Promise<string>;
export declare function decryptDatabase(dbPath: string, key: string): Promise<string>;
//# sourceMappingURL=sqlite.d.ts.map