/**
 * MemoryManager — the public API surface of MemOS.
 *
 * Orchestrates graph operations, persistence, auto-linking, and
 * extractive summarisation. This is the class that application
 * code interacts with.
 *
 * @module @memos/memory
 */
import { type DetectedExportSource, type ExternalImportSource } from "./external-import.js";
import { type CitationResolution } from "./citations.js";
import type { ContextPack } from "./context-pack.js";
import type { DeletionCertificate } from "./proof-of-forgetting.js";
import type { CompactOptions, CompactResult, FidelityLevel, FidelityRecallOptions, FidelityRecallResult } from "./fidelity.js";
import type { TamperVerifyResult } from "./tamper-log.js";
import type { TamperLogEntry } from "./types.js";
import type { RelevanceGateResult, MemoryNode, MemoryEdge, MemoryPool, MemoryScope, MemoryHistory, HistoryOptions, CreateMemoryInput, UpdateMemoryInput, ScoredMemory, SearchFilter, SemanticSearchOptions, GraphSnapshot, MemOSConfig, MemOSEvent, MemOSEventListener, ExportOptions, ExportResult, ImportOptions, ImportResult, ContextPackCompressionOptions, ContextPackWireFormat, EmbeddingRuntimeInfo, MemoryType, MemorySource, EmbeddingNodeStatusInfo, EmbeddingQueueStatus, DedupeOptions, DedupeResult, DecayForgettingOptions, DecayForgetResult, ArchiveOptions, ArchiveResult, ConsolidateOptions, ConsolidateResult, SummarizeClusterOptions, RevertOptions, RevertResult, RevertTargetResolution, RevertScopeInput, SummarizeClusterResult, ConversationMessage, ExtractFactsOptions, ExtractFactsResult, DiagnosticsResult, LessonOutcome, ProceduralLesson, ProvenanceTier, HarnessCount, HarnessMergeOptions, HarnessMergeResult } from "./types.js";
import type { QuarantineVerdict } from "./quarantine.js";
import type { AddImageMemoryOptions, AddImageMemoryResult, ImageInput, ImageSearchResult, ListImagesOptions, SearchImagesOptions } from "./types.js";
/**
 * Thrown by `store({ filterRetain: true })` when the Hermes-style retain
 * pre-filter decides the content is too low-signal to store (v1.6.26).
 * Catch this to silently skip noise instead of treating it as an error.
 *
 * @example
 *   try {
 *     await memos.store("ok got it", { filterRetain: true });
 *   } catch (e) {
 *     if (e instanceof MemorySkippedError) return; // expected — low signal
 *     throw e;
 *   }
 */
export declare class MemorySkippedError extends Error {
    readonly score: number;
    constructor(reason: string, score: number);
}
/**
 * Core MemOS instance. This is the primary entry point for all
 * memory operations.
 *
 * @example
 * ```ts
 * import { MemOS } from "@mem-os/sdk";
 *
 * const memos = new MemOS({ dbPath: "./my-app.db" });
 * await memos.init();
 *
 * const { node } = await memos.store("User prefers dark mode", { type: "preference" });
 * const results = await memos.search("dark mode");
 * ```
 */
export declare class MemOS {
    private graph;
    private storage;
    /** In-memory snapshots for time-travel (experimental). */
    private snapshots;
    private config;
    private experimental;
    private embeddingProvider;
    /**
     * In-process LRU cache of query embedding vectors, keyed by
     * `${provider.id}:${provider.model}:${query}`.
     *
     * Round 4 (perf): the semantic leg embeds the query on every search,
     * and `multiStreamSearch` fans out to three pool streams — previously
     * three identical ONNX inferences per search. Embedding is a pure
     * function of (provider, model, query), so caching the vector is
     * provably recall-neutral: a cache hit returns the byte-identical
     * vector the provider would have produced. Bounded (LRU eviction) so
     * long-lived processes cannot grow it without limit.
     */
    private queryEmbeddingCache;
    private static readonly QUERY_EMBEDDING_CACHE_MAX;
    /**
     * Tier-2 semantic screen for the provenance-trust write gate (intent
     * level, fastembed embeddings — no LLM). Lazily constructed: the
     * anchor embeddings are computed on first use and cached for the
     * process lifetime.
     */
    private semanticScreen;
    private listeners;
    private initialised;
    private sweepTimer;
    /** Background embedding queue. Null when no provider is configured. */
    private embeddingQueue;
    /**
     * Per-node embedding status cache. Populated as the queue emits status
     * callbacks and as nodes are reaped into the persisted embedding.
     */
    private nodeEmbeddingStatus;
    /**
     * LRU cache for recent search results. Prevents re-running hybrid
     * search (which embeds the query + scans the embedding table) when
     * the same query is issued repeatedly within a short window.
     * Key: `${query}::${namespace}::${limit}`. Value: { results, expiry }.
     */
    private searchCache;
    private searchCacheMaxEntries;
    private searchCacheTtlMs;
    /**
     * Vision (image memory) runtime state. All three fields stay inert
     * until `vision.enabled` is set, so a bare `new MemOS()` pays nothing
     * and behaves exactly as it did before image memory existed.
     *
     * - `blobRoot` is derived once from the db path so every image write
     *   resolves the same directory.
     * - `clipProvider` is the Track B encoder (explicit from config, or
     *   the lazily-loaded default). Null when Track B is off.
     * - `clipQueryCache` memoizes CLIP query encodings; it is deliberately
     *   separate from `queryEmbeddingCache` so a CLIP vector can never be
     *   served to a text-semantic query.
     */
    private imageBlobRoot;
    private clipProvider;
    private clipQueryCache;
    /** In-flight image embeds, drained by `flushEmbeddings`. */
    private pendingImageEmbeds;
    /**
     * Idempotency guard for the ranking-modulation chain (effective
     * importance + triple boost + Ebbinghaus reinforcement).
     *
     * `applyRankingModulators` is additive, so running it twice would
     * double-count. It now lives inside `hybridSearch` (so `contextPack`,
     * `multiStreamSearch`, and the store-time evidence pass rank like
     * `search`), while `postSortResults` — the historical owner — is still
     * reached by `search()` on both the hybrid and the keyword-only path.
     * `postSortResults` therefore skips the chain when it recognizes the
     * very objects `applyRankingModulators` produced: `hybridSearch` hands
     * back that same array, so `results[0]` is still the marked entry.
     */
    private readonly rankingModulated;
    /** Warn only once when the rerank endpoint fails (graceful degradation). */
    private rerankFailureWarned;
    /**
     * Last timestamp handed out by `store()`. Fast successive stores can land
     * in the same millisecond, which would make createdAt ties ambiguous for
     * temporal ordering, version timelines, and recency tie-breaks — so
     * store timestamps are kept strictly monotonic per instance.
     */
    private lastStoreTime;
    /**
     * Node ids written by `store()` whose embeddings have not been scanned
     * for contradiction candidates yet. The write-time scan runs when the
     * embedding is persisted (see `onEmbeddingPersisted`) — the gate keeps
     * the scan off the startup backfill path and off re-embeddings from
     * `update()`, so detection stays a bounded per-write cost.
     */
    private contradictionScanPending;
    /**
     * Append one entry to the tamper-evident mutation log (see
     * `src/tamper-log.ts`). Fail-open: logging never blocks the mutation
     * — a logging failure is swallowed so the write path always wins.
     */
    private logMutation;
    /**
     * `storage.updateNode` plus tamper-log bookkeeping. Use for every
     * node mutation that goes through `updateNode` so the log stays
     * complete — a mutation invisible to the log is indistinguishable
     * from tampering at verify time.
     */
    private updateNodeLogged;
    /**
     * Lifetime token-savings telemetry for context packs (in-process —
     * resets when the MemOS instance is recreated). `packTokens` counts
     * what was actually injected; `naiveBaselineTokens` counts what
     * dumping the same candidates as raw JSON nodes would have cost.
     */
    private usage;
    /**
     * Create a new MemOS instance.
     *
     * @param config — Configuration options. All fields are optional.
     */
    constructor(config?: MemOSConfig);
    /**
     * Initialise the storage backend and hydrate the in-memory graph.
     * Must be called before any other method.
     */
    init(): Promise<void>;
    /**
     * Store a new memory.
     *
     * Automatically generates a summary (if not provided) and attempts
     * to link the new node to existing nodes based on text similarity.
     *
     * @param content — Text content to remember.
     * @param opts    — Optional metadata, type, summary, importance, ttl, tags.
     * @returns The created node and any auto-created edges.
     */
    store(content: string, opts?: Omit<CreateMemoryInput, "content">): Promise<{
        node: MemoryNode;
        links: MemoryEdge[];
    }>;
    /**
     * Import a record with its original identity (ID and timestamps).
     *
     * Used by encrypted sync restore (`src/sync.ts`). Unlike `store()`,
     * this bypasses the write pipeline — no retain filter, no quarantine
     * screen, no event-update resolution, no auto-linking — because the
     * record already went through all of that on the exporting machine.
     * The node is still queued for (re-)embedding under the local
     * provider and registered for the contradiction scan.
     */
    importRecord(record: {
        id: string;
        content: string;
        summary?: string;
        type: MemoryType;
        tags?: string[];
        importance?: number;
        createdAt: number;
        updatedAt: number;
        namespace?: string;
        metadata?: Record<string, unknown>;
        source?: MemorySource;
        provenance?: ProvenanceTier;
        pool?: MemoryPool;
        expiresAt?: number | null;
        validFrom?: number | null;
        validTo?: number | null;
        harness?: string;
    }): Promise<MemoryNode>;
    /**
     * Inner write path. `skipEventUpdate` is true only for the event-update
     * machinery below (prevents the replacement write from re-triggering
     * update detection on its own text — infinite recursion otherwise).
     */
    private storeInner;
    /**
     * Resolve a natural-language event update/cancel against the store.
     *
     * Cross-harness rule: the target is resolved from the CURRENT rows in
     * the shared DB file (same deterministic rules in every harness), so
     * model B can update an event stored by model A with no shared
     * conversation state.
     *
     * Deterministic tiebreaks:
     * - kind named ("that meeting") → newest open event whose kind matches
     *   `metadata.event.kind`, or whose label contains the kind;
     *   createdAt desc, id asc.
     * - kind unnamed ("it got moved") → the single open event if exactly
     *   one exists; zero or ambiguous → null (fail safe, never guess).
     *
     * @returns The resolved replacement write, or null when nothing
     *   resolves (the caller falls through to a normal write).
     */
    private applyEventUpdate;
    /**
     * Find the currently-open scheduled event an update/cancel refers to.
     * See `applyEventUpdate` for the deterministic tiebreak rules.
     */
    private resolveOpenEventTarget;
    /**
     * Retrieve a single memory by ID.
     *
     * @param id — Memory node ID.
     * @returns The node, or `null` if not found.
     */
    retrieve(id: string): Promise<MemoryNode | null>;
    /**
     * Store an image as a durable memory.
     *
     * An image memory is an ORDINARY memory node plus two side artifacts:
     * a caption stored as the node's `content` (so every existing text
     * retrieval path finds it), and the image bytes in a content-addressed
     * blob store next to the database. The node shape does not change and
     * no new `MemoryType` member is introduced — `metadata.image` is the
     * discriminator, exactly like `metadata.context`.
     *
     * Because it routes through `storeInner`, the write goes through the
     * same pipeline as every text memory: retain triage, quarantine
     * screening, provenance resolution, auto-linking, contradiction scan,
     * tamper log. That is the difference between ~250 lines and ~800.
     *
     * Two embedding tracks, independent of each other:
     * - **Track A (always on):** the caption is embedded by the normal
     *   TEXT provider, so the image is found by keyword and text-semantic
     *   search on every install. Zero extra model downloads.
     * - **Track B (opt-in via `vision.clip.enabled`):** the image itself
     *   is encoded by CLIP into a separate vector space, so a query can
     *   match the PIXELS when its wording differs from the caption's.
     *   Degrades to Track A when the transformers package is missing —
     *   it never throws and never substitutes a text vector.
     *
     * @param input — A filesystem path, raw bytes, `{ data, mime }`
     *   (base64), `{ url }`, or a `data:` URL.
     * @param opts — Caption, kind, tags, and the usual store options.
     * @returns The created node, its image attachment, and the CLIP status.
     *
     * @example
     * ```ts
     * const { node, image } = await memos.addImageMemory("./diagram.png", {
     *   caption: "gateway → auth → orders → postgres, retry loop on orders",
     *   kind: "diagram",
     *   tags: ["arch"],
     * });
     * ```
     */
    addImageMemory(input: ImageInput, opts?: AddImageMemoryOptions): Promise<AddImageMemoryResult>;
    /**
     * Resolve an image reference (or node id) to its bytes.
     *
     * Takes the REF, not the node id, so a host model that only saw
     * `[img:…]` in a context pack can resolve it without any other
     * context. Also accepts a node id for convenience.
     *
     * @returns The blob bytes and MIME type, or null when missing.
     */
    imageMemory(refOrId: string): Promise<{
        buffer: Buffer;
        mime: string;
        ref: string;
    } | null>;
    /**
     * Search image memories by text query.
     *
     * Runs the caption leg (keyword + text-semantic — the same legs every
     * other memory uses) and, when Track B is enabled, the CLIP leg, then
     * fuses them. The CLIP leg is what makes a query match the PIXELS
     * when its wording shares nothing with the caption.
     *
     * Only nodes carrying `metadata.image` are returned.
     */
    searchImages(query: string, opts?: SearchImagesOptions): Promise<ImageSearchResult[]>;
    /**
     * All image memories in a namespace, newest first.
     *
     * Requires vision to be enabled, so an operator who has not turned
     * the feature on gets told how rather than an empty list that looks
     * like "no images stored".
     */
    listImages(opts?: ListImagesOptions): Promise<ImageSearchResult[]>;
    /**
     * Delete an image memory: the node, its blob, and its CLIP vector.
     * The embedding row cascades with the node (ON DELETE CASCADE).
     */
    deleteImageMemory(nodeId: string): Promise<boolean>;
    /**
     * Delete blobs no live node references any more.
     *
     * Explicit rather than scheduled: eviction paths (`forgetByDecay`,
     * `archive`) delete nodes, so their blobs become unreachable garbage
     * that only an explicit sweep removes.
     */
    purgeOrphanImages(): Promise<number>;
    /**
     * The CLIP retrieval leg for a hybrid search, or [] when it cannot
     * contribute.
     *
     * Returns an empty list — with zero storage reads — whenever any of
     * these holds:
     *  - the query is empty (a structured-only filter search),
     *  - `vision.clip.enabled` is false (the default),
     *  - the provider cannot encode text (`embedImageText` missing), or
     *  - the storage adapter has no `querySimilarImages`.
     *
     * That is what makes the leg free for a text-only install: not one
     * extra query, not one changed byte. When it IS active, the query is
     * encoded through the dedicated CLIP LRU (never `embedQueryCached`,
     * whose keys belong to the text provider) and scanned against
     * `image_embeddings` with the caller's own filter mirrored — so an
     * image in another namespace can never leak into this scope.
     *
     * A CLIP failure degrades to [] rather than propagating: Track B is a
     * recall upgrade, and losing it must never break a text search.
     */
    private fetchImageLeg;
    /** Resolve (and memoize) the blob-store root for this instance. */
    private resolveImageBlobRoot;
    /**
     * Resolve the Track B image encoder.
     *
     * Order: an explicitly injected provider, then the lazily-constructed
     * default. Null whenever Track B is off — which is the common case, so
     * the default `ClipEmbeddingProvider` is never even allocated.
     */
    private resolveClipProvider;
    private resolveClipQueryCache;
    /**
     * The image payload carried by a node, or null when it is not an
     * image memory. `metadata.image` — not `type`, not a new MemoryType
     * member — is the discriminator, so MemoryType exhaustiveness stays
     * intact everywhere (sync allowlist, fidelity labels, adapters, MCP
     * schema).
     */
    private imageAttachmentOf;
    /** The CLIP bookkeeping recorded in `metadata.clip`. */
    private clipMetaOf;
    private clipStatusOf;
    /**
     * Schedule the CLIP embed for a freshly written image node.
     *
     * Deliberately NOT routed through `EmbeddingQueue`: that queue's
     * batch-and-persist contract writes to the TEXT `embeddings` table,
     * and CLIP vectors belong in `image_embeddings`. This is a small
     * in-flight set drained by `flushEmbeddings`, with retry-free
     * fail-soft semantics — a CLIP failure records
     * `metadata.clip.status = "failed"` and leaves Track A intact.
     */
    private scheduleImageEmbedding;
    /** Persist `metadata.clip` on the node. */
    private recordClipStatus;
    /** Find an image node with the same content digest in one namespace. */
    private findImageNodeByDigest;
    /** Find an image node by its blob ref. */
    private findImageNodeByRef;
    /** Count image nodes sharing one digest (blob refcount). */
    private countImageNodesByDigest;
    /** Every ref referenced by a live image node. */
    private collectLiveImageRefs;
    /**
     * Fuse the caption leg and the CLIP leg by reciprocal rank.
     *
     * RRF rather than score blending: the two legs live in different
     * vector spaces, so their raw scores are not comparable — only their
     * RANKS are. An image found by both legs outranks one found by
     * either alone, which is exactly the intended behaviour.
     */
    private fuseImageLegs;
    /**
     * Search memories by text query and/or structured filters.
     *
     * @param queryOrFilter — A plain text query string, or a full SearchFilter object.
     * @returns Array of scored memories, ordered by relevance.
     */
    search(queryOrFilter: string | SearchFilter): Promise<ScoredMemory[]>;
    /**
     * Whether a text query should take the hybrid (multi-leg) path.
     *
     * Historically this was just "is a text embedding provider
     * configured". The CLIP image leg is a second, INDEPENDENT reason to
     * fuse: an install with `embeddings.enabled: false` but
     * `vision.clip.enabled: true` still has a vector leg to run, and
     * gating on the text provider alone would leave Track B silently
     * dead on exactly the installs that opted into it.
     *
     * Cheap: the check is a boolean on resolved config, not a probe.
     */
    private canRunHybrid;
    /**
     * Fidelity-aware recall: retrieve memories at the CHEAPEST fidelity
     * level that satisfies the query, escalating L0→L1→L2→L3 within the
     * same call when the result set looks insufficient.
     *
     * This is an ADDITIVE API — `search()` / `semanticSearch()` are
     * untouched. Scoring is a local IDF-weighted term-coverage pass over
     * the level corpus (zero LLM, zero embeddings); each result carries
     * the full node plus the level it was served at.
     *
     * Default behavior is L3-equivalent (verbatim text, no routing, no
     * escalation): existing consumers see the same output shape as a
     * plain search. Pass `fidelity: "adaptive"` (or a fixed lower level)
     * to opt into token savings.
     *
     * Two guards keep an adaptive call answerable:
     *   - the escalation FLOOR (default L1) — an L0 tag/entity listing
     *     is a retrieval affordance, not an answer, so it is never the
     *     terminal level unless the caller explicitly asked for L0;
     *   - the DECISIVE-TOKEN check — when the query carries a number,
     *     unit or negation that the served text lacks, escalation
     *     continues regardless of the IDF coverage score.
     *
     * @example
     * ```ts
     * // Adaptive never serves tag soup: a factoid starts at L1 and
     * // escalates to L3 when the decisive token is still missing.
     * const hits = await memos.recall("postgres pool size", {
     *   fidelity: "adaptive",
     *   maxFidelity: "L2",
     * });
     * for (const h of hits) console.log(h.level, h.text);
     * ```
     */
    recall(query: string, opts?: FidelityRecallOptions): Promise<FidelityRecallResult[]>;
    /**
     * Scope the recall candidate set. Mirrors the `SearchFilter` fields
     * that make sense for an in-memory scan (namespace / type / tags /
     * pool); full-text and vector legs live in `search()`. The harness
     * scope comes from the explicit argument first, then
     * `filter.harness` — `"all"` (or unset) keeps every harness.
     */
    private applyRecallFilter;
    /**
     * Eager fidelity backfill: generate missing L1/L2 levels for stored
     * memories and persist them into the reserved `metadata.fidelity`
     * slot. Idempotent — memories that already carry cached levels are
     * skipped. Reads (`recall`, `contextPack`) also generate lazily, so
     * this command is an optimization, not a requirement.
     *
     * `memos compact --stats` reports per-level token averages without
     * writing anything.
     */
    compact(opts?: CompactOptions): Promise<CompactResult>;
    /**
     * Search and return results in TOON (Token-Optimized Object Notation)
     * format — a compact pipe-delimited string that cuts token count.
     *
     * Format:
     *   # memos.search.v1
     *   # toon:pipe-delimited
     *   # fields: id|score|trust|source|updatedAt|tags|content
     *   mem_abc|0.950|local|user_input|2026-06-18T12:00:00.000Z|preference;ui|User likes dark mode
     *
     * @param opts — If a string, searches with that query. If an object,
     *   accepts `{ query, format: "toon" | "toon-compact", ...searchOptions }`.
     *   Default format is "toon-compact" for maximum token savings.
     * @returns A TOON-formatted string.
     */
    searchToon(opts: string | (SearchFilter & {
        format?: "toon" | "toon-compact";
    })): Promise<string>;
    /**
     * Compose a scope filter into storage-facing namespace constraints.
     * Explicit `namespace` always wins over `scope`; scope matches
     * hierarchically (prefix) unless `scopeMatch: "exact"`.
     */
    private resolveScopeFilter;
    /**
     * Apply post-query sorting that the storage layer can't do natively
     * (e.g. trustScore when the query went through FTS which always
     * sorts by rank).
     *
     * The ranking-modulation chain (triple boost, effective importance,
     * Ebbinghaus reinforcement) is owned by `hybridSearch` these days —
     * see {@link applyRankingModulators} — so this method only runs it for
     * the keyword-only path, where `hybridSearch` is never reached. On the
     * hybrid path the incoming array is already modulated and is passed
     * through untouched (the `rankingModulated` WeakSet tells the two
     * apart).
     */
    private postSortResults;
    /**
     * The shared ranking-modulation chain: everything that re-ranks a
     * fused result set AFTER relevance. Runs inside `hybridSearch`'s
     * post-fusion stages so every caller of the hybrid pipeline —
     * `search()`, `contextPack()`, `multiStreamSearch()`, the store-time
     * evidence pass — ranks identically instead of `search()` alone.
     *
     * Three independent, individually-gated stages:
     *
     *  1. TRIPLE BOOST (`experimental.tripleExtraction`) — ×1.15 when a
     *     memory's stored triples match the query's triples.
     *  2. EFFECTIVE IMPORTANCE (`config.importance`, opt-in) — a bounded
     *     multiplicative factor from `computeEffectiveImportance()`, so
     *     recency decay and access reinforcement modulate ranking the same
     *     way they already modulate eviction and archival.
     *  3. EBBINGHAUS REINFORCEMENT (`experimental.ebbinghaus`) — a small
     *     additive forgetting-curve term, plus the access-counter bump.
     *
     * Every stage is off unless its own config says otherwise, and stage 2
     * additionally requires the `importance` block to be non-empty — so an
     * unconfigured instance passes its exact input array through.
     */
    private applyRankingModulators;
    /**
     * Resolve the effective-importance config for ranking / eviction /
     * archival, or `null` when the user left it unconfigured.
     *
     * The constructor normalises `config.importance` to `{}`, so "unset"
     * and "explicitly empty" are indistinguishable there — and BOTH must
     * keep the historical behaviour (raw `node.importance`) exactly, since
     * this is a published SDK. An object carrying at least one defined
     * field is therefore the opt-in signal.
     *
     * @returns The configured tuning block, or `null` for "use raw importance".
     */
    private resolveImportanceRanking;
    /**
     * Bump accessCount and lastAccessed for retrieved nodes (Ebbinghaus
     * reinforcement). Fire-and-forget; failures are ignored.
     *
     * MUST go through the storage adapter's `recordAccess` — never
     * `updateNode`. `updateNode` stamps `updatedAt = Date.now()` and
     * ignores the `accessCount`/`lastAccessed` fields in its UPDATE
     * statement, so routing read telemetry through it did both of these:
     *
     *  1. Every search rewrote `updated_at` on up to 10 nodes without a
     *     tamper-log entry, so `verifyTamperLog` reported the whole store
     *     as "edited without logging" (false tamper alarm on a plain read).
     *     It also made recalled memories look freshly written to recency
     *     ordering, sync last-write-wins, and the embedding-freshness
     *     check (`info.updatedAt >= node.updatedAt` → needless re-embed).
     *  2. The `accessCount`/`lastAccessed` it passed were silently dropped —
     *     both fields are absent from `updateNode`'s UPDATE statement — so
     *     every search paid a full row rewrite (plus tag/entity index
     *     resync) to persist none of its own telemetry.
     *
     * Adapters without `recordAccess` skip reinforcement (fail-open).
     */
    private bumpAccessCounters;
    /**
     * Boost results whose stored triples match the query's triples.
     * Matching triples get a 15% score boost.
     */
    private applyTripleBoost;
    /**
     * Permanently forget a memory and all its connected edges.
     *
     * @param id — Memory node ID to forget.
     * @returns `true` if the memory existed and was deleted.
     */
    forget(id: string): Promise<boolean>;
    /**
     * Generate a summary of all stored memories.
     *
     * Concatenates all node summaries and produces an extractive
     * summary of the combined text.
     *
     * @returns A summary string.
     */
    summarize(): Promise<string>;
    /**
     * Manually create a link (edge) between two memories.
     *
     * @param sourceId — Source node ID.
     * @param targetId — Target node ID.
     * @param relation — Semantic relation type.
     * @param weight   — Edge weight [0, 1].
     * @returns The created edge.
     */
    link(sourceId: string, targetId: string, relation?: MemoryEdge["relation"], weight?: number): Promise<MemoryEdge>;
    /**
     * Set a time-to-live on a memory node.
     *
     * @param id — Memory node ID.
     * @param seconds — TTL in seconds from now.
     */
    setTTL(id: string, seconds: number): Promise<void>;
    /**
     * Clear the TTL on a memory node (make it persist indefinitely).
     *
     * @param id — Memory node ID.
     */
    clearTTL(id: string): Promise<void>;
    /**
     * Add tags to a memory node.
     *
     * @param id — Memory node ID.
     * @param tags — Tags to add.
     */
    tag(id: string, tags: string[]): Promise<void>;
    /**
     * Remove tags from a memory node.
     *
     * @param id — Memory node ID.
     * @param tags — Tags to remove.
     */
    untag(id: string, tags: string[]): Promise<void>;
    /**
     * List all memories with a specific tag.
     *
     * @param tag — Tag to filter by.
     * @returns Array of memory nodes with the tag.
     */
    listByTag(tag: string): Promise<MemoryNode[]>;
    /**
     * Export memories in the specified format.
     */
    export(opts?: ExportOptions): Promise<ExportResult>;
    /**
     * Import memories from a JSON file or directory of Markdown/Obsidian files.
     *
     * @param opts — Import options (source path, format).
     * @returns Import result with counts.
     */
    /**
     * Import memories from a third-party export: ChatGPT
     * (`conversations.json`), Claude (export directory or file), or Slack
     * (export directory). The parser sniffs each entry, maps messages to
     * timestamped memories, dedupes by content hash, and every item is
     * stored with `source: "external_data"` (lower trust by default) plus
     * provenance tags (`imported`, `<source>`), so imported memories are
     * rankable but never outrank first-party facts.
     *
     * With `synthesize: true`, a post-import pass extracts structured
     * decisions / preferences / milestones from the imported text using
     * rule-based heuristics (no LLM) and stores them as tagged memories.
     */
    importExternal(opts: {
        /** Path to the export JSON file. Mutually exclusive with `data`. */
        file?: string;
        /** Pre-loaded export payload (JSON string or decoded value). */
        data?: unknown;
        /**
         * Path to an export directory. Required for `slack`; for
         * `chatgpt`/`claude` scans every `*.json`/`*.jsonl` file in the
         * directory. Mutually exclusive with `file`/`data`.
         */
        dir?: string;
        /** Parser hint. Default `"auto"` sniffs the shape. */
        source?: ExternalImportSource;
        namespace?: string;
        dryRun?: boolean;
        /** Safety cap on imported items. Default 500. */
        maxItems?: number;
        /** Extra tags applied to every imported memory. */
        tags?: string[];
        /**
         * Post-import synthesis pass: rule-based extraction of decisions,
         * preferences, and milestones into structured memories. Default
         * false.
         */
        synthesize?: boolean;
    }): Promise<{
        detected: DetectedExportSource;
        total: number;
        imported: number;
        skipped: number;
        dryRun: boolean;
        durationMs: number;
        sampleIds: string[];
        synthesized: {
            decisions: number;
            preferences: number;
            milestones: number;
        };
    }>;
    private lessonStorage;
    /**
     * Capture a procedural lesson — behavioral guidance for future tasks,
     * not a fact. Starts at the neutral prior score (0.5); outcome
     * feedback via `recordLessonOutcome` moves it from there.
     */
    memorizeProcedural(lesson: string, opts?: {
        context?: string;
        tags?: string[];
        namespace?: string;
        scope?: MemoryScope;
        initialScore?: number;
    }): Promise<ProceduralLesson>;
    /**
     * Record an outcome for a lesson. Successes reinforce
     * (`score += (1 - score) * 0.2`), failures demote
     * (`score -= score * 0.3`) — pure local math, fully transparent.
     * Also bumps `useCount` and refreshes timestamps (which resets the
     * read-time decay clock).
     */
    recordLessonOutcome(id: string, outcome: LessonOutcome): Promise<ProceduralLesson>;
    /**
     * Retrieve the top-k procedural lessons for a query, ranked by a
     * blend of decayed score (60%) and query-token relevance (40%).
     * Lessons with no query overlap are skipped unless the query is
     * empty (empty query = top lessons by score).
     */
    recallProcedural(query: string, k?: number, opts?: {
        namespace?: string;
        scope?: MemoryScope;
    }): Promise<ProceduralLesson[]>;
    /** List procedural lessons, highest score first. */
    listProceduralLessons(opts?: {
        namespace?: string;
        scope?: MemoryScope;
    }): Promise<ProceduralLesson[]>;
    /**
     * Trace a citation token (e.g. `[mem:a3f9]`, `a3f9`, or a full id)
     * back to its source memory. Returns the full memory on an exact
     * prefix match, `not_found` when nothing matches, and `ambiguous`
     * with the candidate list when the token matches several memories
     * (use a longer token to disambiguate).
     */
    resolveCitation(token: string): Promise<CitationResolution>;
    /**
     * Render a citation resolution exactly as `memos cite` prints it.
     * Shared with the CLI so tests assert on the real output bytes.
     */
    formatCitation(resolution: CitationResolution, asJson?: boolean): string;
    /**
     * Screen text with the write-gate classifier without storing
     * anything. Useful for pre-flight checks and for testing the
     * classifier's verdict on a given input. Tier 1 only (synchronous
     * regex screen) — the async semantic tier needs an initialized
     * instance and runs on the real write path.
     */
    screenContent(content: string): QuarantineVerdict;
    /**
     * Lazily-constructed tier-2 semantic screen, or null when embeddings
     * are disabled (no provider to embed with).
     */
    private getSemanticScreen;
    /**
     * Tier-2 semantic screen for the provenance-trust write gate:
     * intent-level detection via cosine similarity to canonical
     * attack-shape anchors (fastembed, no LLM — see
     * `src/semantic-screen.ts`).
     *
     * Runs only when tier 1 left the write in the gray zone (score in
     * [1.0, 2.0)) or the write is low-trust tiered — ordinary writes
     * never pay the embedding cost, and the zero-LLM cheap screen stays
     * the first and only mandatory tier.
     *
     * Escalation rules (both quarantine, never hard-block — flagged
     * content is still stored, just excluded from recall pending review):
     * - gray-zone: tier-1 score + `semanticEscalationPoints(sim)` >= 2.0 —
     *   the semantic tier escalates partial regex evidence, it cannot
     *   quarantine a clean-looking write on its own;
     * - low-trust tiers: sim >= SEMANTIC_HIGH_SIM_BAR quarantines on
     *   intent alone (tool output is data, never instructions).
     *
     * Returns null when the tier doesn't run (out of scope, embeddings
     * off) or is unavailable (hash fallback, transient embed error) —
     * callers keep the tier-1 verdict. Fail-open for writes: a semantic
     * outage never blocks or silently quarantines a write.
     */
    private maybeSemanticScreen;
    /**
     * Retrieval-time anomaly scoring (topic-conditioned): memories whose
     * write-time attack-shape similarity (`metadata.semanticAttackSim`,
     * stamped by {@link maybeSemanticScreen}) is at/above
     * RETRIEVAL_ANOMALY_THRESHOLD are down-weighted — unless the query
     * itself is attack-shaped (similarity at/above QUERY_ATTACK_SIM_CAP),
     * in which case attack-shaped memories are expected (security
     * discussion, red-team review) and the flag stays off.
     *
     * Cheap by construction: the query is embedded only when at least one
     * stamped suspect is in the result set; stored memories reuse their
     * write-time measurement.
     */
    private applyRetrievalAnomalyScoring;
    /**
     * List quarantined memories — the review queue — most recently
     * flagged first. Quarantined memories are excluded from recall by
     * default; this is the explicit review path.
     */
    listQuarantined(opts?: {
        limit?: number;
        namespace?: string;
    }): Promise<MemoryNode[]>;
    /**
     * Release a memory from quarantine: it becomes recallable again, but
     * stays flagged as low-trust for agent consumption — the
     * `releasedFromQuarantine` metadata marker keeps
     * `untrusted_source: true` on in MCP responses so a host agent
     * confirms it instead of silently injecting it as context.
     * Idempotent: releasing a non-quarantined memory is a no-op.
     * Add-only: `quarantinedAt`/`quarantineReason` are preserved as the
     * audit trail of the original flagging.
     */
    releaseFromQuarantine(id: string): Promise<MemoryNode>;
    /**
     * Set a memory's provenance tier. This is the only path to the
     * `user-verified` tier — explicit user confirmation, never assigned
     * automatically at write time.
     */
    setProvenance(id: string, tier: ProvenanceTier): Promise<MemoryNode>;
    /**
     * Per-harness memory counts — "which harnesses wrote what lives in
     * this database". Powers `memos harness list`. Memories written
     * before harness attribution existed (or by clients that never set
     * the tag) read as `"unknown"`.
     */
    getHarnessCounts(): Promise<HarnessCount[]>;
    /**
     * Merge another harness's database file into this one — "one memory,
     * every harness."
     *
     * The merge is a faithful row-level import, not a re-write: every
     * source node keeps its id (remapped only on collision), timestamps,
     * bitemporal validity interval (`validFrom`/`validTo`), provenance
     * tier, trust score, tags, quarantine state, and harness tag. Edges
     * follow their endpoints through the id remap.
     *
     * Cross-harness duplicates and contradictions are NOT resolved here:
     * imported nodes go through the exact same post-write path as
     * `store()` — re-embedded by the local provider and registered for
     * the existing write-time contradiction scan — so the established
     * contradiction detection + read-time resolution machinery converges
     * them exactly as if they had been written locally. No second
     * resolution system exists, by design.
     *
     * Deterministic: nodes import in (createdAt, id) order; collisions
     * get fresh UUIDs recorded in the result's id map.
     *
     * @param fromPath — Path to the source `.db` file.
     * @param opts — `{ dryRun }` reports the plan without writing.
     */
    mergeHarnessDb(fromPath: string, opts?: HarnessMergeOptions): Promise<HarnessMergeResult>;
    importMemories(opts: ImportOptions): Promise<ImportResult>;
    private importJson;
    private parseMarkdownFile;
    /**
     * Semantic-only retrieval. Uses persisted embedding vectors when configured,
     * with the older graph text-similarity path kept as a no-provider fallback.
     *
     * Two call styles (both supported):
     *   semanticSearch(query, 10, 0.2, { namespace: "demo" })   // positional
     *   semanticSearch(query, { limit: 10, threshold: 0.2, namespace: "demo" })
     *
     * @param query — Text query to search for.
     * @param limitOrOpts — Result limit, or an options object with `limit`,
     *   `threshold`, and any `SearchFilter` field.
     * @param threshold — Minimum similarity score in [0, 1] (positional style).
     * @param filter — Extra search filters (positional style).
     * @param internal — Internal plumbing (not part of the public contract):
     *   `queryVector` skips the query embedding when the caller already
     *   computed it (see `multiStreamSearch` embed-once threading).
     */
    semanticSearch(query: string, limitOrOpts?: number | SemanticSearchOptions, threshold?: number, filter?: SearchFilter, internal?: {
        queryVector?: number[];
    }): Promise<ScoredMemory[]>;
    /**
     * Generate a DOT-format graph visualization string.
     */
    graphViz(): Promise<string>;
    /**
     * List all namespaces.
     */
    listNamespaces(): Promise<string[]>;
    /**
     * Get the count of memories in a namespace.
     */
    namespaceCount(ns: string): Promise<number>;
    /**
     * Scoped-space inventory: every namespace with its live memory count,
     * ordered by count descending. Free-form scopes (convention:
     * `project:<name>`, `harness:<name>`) appear here alongside typed
     * `user:/agent:/run:` scopes and the shared `default` namespace.
     * Powers `memos scope list`.
     */
    listNamespaceCounts(): Promise<Array<{
        namespace: string;
        count: number;
    }>>;
    /**
     * Get context for a node by walking the graph to a given depth.
     * Returns the node's content plus contents of neighbours up to `depth` hops.
     */
    injectContext(id: string, depth?: number, maxChars?: number): Promise<string>;
    /**
     * Update an existing memory node.
     */
    update(id: string, input: UpdateMemoryInput): Promise<MemoryNode | null>;
    /**
     * Get the full graph snapshot (nodes + edges).
     */
    getGraph(): Promise<GraphSnapshot>;
    /**
     * Get the graph as of a bitemporal timestamp (unix ms) — time-travel
     * over add-only history. Backs the MCP Apps explorer's as-of scrubber.
     * Reads from storage (the in-memory graph only reflects live state);
     * adapters without `getGraphAtTime` fall back to filtering the live
     * snapshot with the same as-of predicates.
     */
    getGraphAtTime(atTime: number): Promise<GraphSnapshot>;
    /**
     * Get direct neighbours of a memory node.
     */
    getNeighbours(nodeId: string): Promise<MemoryNode[]>;
    /**
     * Get all edges connected to a memory node.
     */
    getEdges(nodeId: string): Promise<MemoryEdge[]>;
    /**
     * Find clusters of related memories.
     */
    clusters(minSize?: number): Promise<string[][]>;
    /**
     * Return the total number of stored memories.
     */
    get count(): number;
    /**
     * Remove all memories and edges.
     */
    clear(): Promise<void>;
    /**
     * Shut down MemOS and release resources.
     */
    close(): Promise<void>;
    /**
     * Build an AI Trio v1 context pack for a query.
     *
     * This is the canonical read-only envelope consumed by LLM Guardian
     * and any other AI Trio member. Items are sorted by descending
     * relevance and trimmed to fit `tokenBudget`. The score is
     * reproducible for the same query, provider, model, and database.
     *
     * @example
     * ```ts
     * const pack = await memos.contextPack({
     *   query: "release blockers",
     *   namespace: "default",
     *   tokenBudget: 1200,
     * });
     * ```
     */
    contextPack(opts: {
        query: string;
        namespace?: string;
        /** Typed multi-scope filter (hierarchical by default). */
        scope?: MemoryScope;
        /** How `scope` matches stored namespaces. Default `"hierarchical"`. */
        scopeMatch?: "exact" | "hierarchical";
        tokenBudget: number;
        limit?: number;
        trust?: string;
        source?: string;
        includeSummary?: boolean;
        /**
         * Fidelity level for pack item contents: a fixed level or
         * `"adaptive"` (the query-adaptive router picks the starting level
         * per query). Default `undefined` = L3 verbatim — current behavior
         * preserved exactly. Lower levels cut tokens per item; the chosen
         * level is recorded per item (`item.fidelity`) and in the pack
         * metadata (`pack.fidelity`).
         */
        fidelity?: FidelityLevel | "adaptive";
        /** Output format: "json" (default), "toon", or "toon-compact" */
        format?: "json" | "toon" | "toon-compact";
        /**
         * Opt-in semantic dedup: drop pack items whose stored embedding is a
         * near-duplicate (cosine >= 0.90) of an already-selected item's.
         * Catches paraphrased memories that lexical dedup misses. Costs one
         * pass over stored embedding rows (filtered to the candidate set);
         * off by default.
         */
        semanticDedup?: boolean;
        /**
         * Multi-stream retrieval (LongMemEval-V2 design lesson): run the query
         * separately against each granularity pool (`event`, `note`,
         * `procedure`) and fuse the ranked lists. Beats a single fused query
         * once distilled notes or procedures exist, and degrades to the
         * plain single-stream path when only `event` content is present.
         * Default true.
         */
        multiStream?: boolean;
        /**
         * Bounded graph expansion for this pack: 1-hop neighbours of the top
         * seeds join the candidate set (via `derived_from` / relation edges),
         * so consolidated summaries carry their sources. Default true;
         * `experimental.graphExpansion` settings take precedence when set.
         */
        graphExpansion?: boolean;
        /**
         * Memory-grounded citations (opt-in, default off): every pack item
         * carries a `[mem:xxxx]` token (unique within the pack) rendered
         * ahead of its content in TOON output, resolvable via
         * `resolveCitation` / `memos cite`.
         */
        citations?: boolean;
        /**
         * Inject top procedural lessons as an "operating instructions"
         * section (additive; default off). `true` injects the top 3 lessons
         * for the query; a number sets k. Uses the pack's namespace.
         */
        lessons?: boolean | number;
        /**
         * Wire format the pack will be serialized to. When set, the token
         * budget is enforced against what each item actually costs on the
         * wire for that format — TOON row scaffolding (`id|score|trust|src|
         * epochDelta|tags|content`, base64url ids, citations) or the JSON
         * serializer's field names and quotes — instead of a flat
         * `content + summary + 4` estimate. Without it the item selection is
         * exactly what it has always been.
         */
        wireFormat?: ContextPackWireFormat;
        /**
         * Hard ceiling on the token count of the SERIALIZED output. When the
         * rendered string exceeds it, the lowest-ranked rows are dropped
         * until it fits. Only meaningful together with a TOON `format`;
         * ignored for "json" (an object has no length to trim). Omitted by
         * default, which leaves the rendered bytes untouched.
         */
        maxWireTokens?: number;
        /**
         * Compression for items that don't fit the budget: an oversized item
         * is re-rendered through `compressText` and admitted if the
         * compressed form fits. Defaults to
         * `experimental.packCompression`; off unless that config enables it,
         * so default pack contents stay byte-identical.
         */
        compression?: ContextPackCompressionOptions;
        /**
         * Attach image references to pack items that are image memories.
         * Default `true` when any candidate item is an image memory (the
         * attachment is a reference, never bytes, so there is no token cost
         * to justify an off-by-default); pass `false` to omit them. Bytes
         * are resolved separately via `memos.imageMemory(ref)`.
         */
        images?: boolean;
    }): Promise<ContextPack | string>;
    /**
     * Fetch procedural lessons for pack injection. Returns `{}` when the
     * caller didn't ask for lessons or the storage adapter has no lesson
     * support — packs stay additive and never fail on lessons.
     */
    private packLessons;
    /**
     * Lifetime token-savings counters for context packs. `savedPct` is the
     * percentage of the naive baseline (raw node JSON for the same
     * candidates) that TOON packing + budget trimming eliminated.
     */
    usageStats(): {
        packsBuilt: number;
        packTokens: number;
        naiveBaselineTokens: number;
        savedTokens: number;
        savedPct: number;
    };
    private trackPackUsage;
    /**
     * Whether any memory exists in the given pools. Cheap probe used by
     * `contextPack` to skip multi-stream retrieval on event-only stores.
     */
    private hasPoolContent;
    /**
     * Multi-stream retrieval: run the query separately against each
     * granularity pool and fuse the ranked lists by keeping each node's best
     * stream score. Candidates found by multiple streams are the strongest
     * evidence — exactly the behavior that beats single-query retrieval on
     * the LongMemEval-V2 ablations.
     */
    private multiStreamSearch;
    /**
     * Merge near-duplicate memories. Two memories with cosine
     * similarity over their embeddings above `threshold` collapse into
     * one: the survivor is the one with the highest importance (ties
     * broken by recency), and the merged-in nodes have their access
     * count and tag union folded in.
     */
    dedupe(opts?: DedupeOptions): Promise<DedupeResult>;
    /**
     * Move stale + low-importance memories to the `archived` namespace.
     * They are NOT deleted — they remain in the DB and can be restored
     * with `memos.update(id, { namespace: "default" })`.
     */
    archive(opts?: ArchiveOptions): Promise<ArchiveResult>;
    /**
     * Cluster memories by embedding similarity and produce an extractive
     * summary for each cluster above `minClusterSize`. The summary is
     * stored as a regular node with `derived_from` edges to each
     * source.
     */
    summarizeCluster(opts?: SummarizeClusterOptions): Promise<SummarizeClusterResult>;
    /**
     * Verify the tamper-evident mutation log.
     *
     * Checks the hash chain (sequence continuity, prev-hash linkage,
     * entry-hash recomputation) and cross-checks every node's current
     * content against its latest log entry. Pass `expectTip` with a
     * checkpoint hash from `memos log checkpoint` to also prove the
     * chain wasn't rewritten since the checkpoint.
     *
     * See `src/tamper-log.ts` for the honest threat model: without an
     * externally anchored checkpoint, a full-chain rewrite by someone
     * with raw DB write access is undetectable.
     */
    verifyTamperLog(opts?: {
        expectTip?: string;
    }): Promise<TamperVerifyResult>;
    /**
     * Read the tamper-evident mutation log in sequence order (newest
     * last). Returns an empty array when the storage adapter doesn't
     * implement the log. Entries contain hashes only — no memory
     * content — so they are safe to display or export.
     */
    readTamperLog(): Promise<TamperLogEntry[]>;
    /**
     * Export a cryptographic deletion certificate for a forgotten memory.
     *
     * Finds the "forget" entry in the tamper log for the given node ID and
     * returns a verifiable certificate proving what was deleted and when.
     * Use `verifyDeletionCertificate()` to check it.
     *
     * @param nodeId - The deleted node's ID.
     * @returns The deletion certificate, or null if no forget entry exists.
     */
    proveForget(nodeId: string): Promise<DeletionCertificate | null>;
    /**
     * Reconstruct the memory state as it existed at a given timestamp.
     *
     * Time-travel: answers "what did the agent believe on date X?" by
     * replaying snapshots. Nodes deleted before the target are excluded.
     *
     * Note: snapshots are captured from now onward (in-memory). Historical
     * state before this feature was enabled is not available.
     *
     * @param targetTs - Unix ms timestamp to reconstruct.
     * @returns Nodes as they existed at targetTs.
     */
    replayAt(targetTs: number): Promise<MemoryNode[]>;
    /**
     * Version timeline for one memory — the audit view behind "auditable by
     * design". Returns the memory, the older versions it replaced
     * (`supersedes`), the newer versions that replaced it (`supersededBy`),
     * consolidated notes derived from it, and every graph edge touching it.
     *
     * Related versions are inferred by content similarity (cosine over
     * stored embeddings where available, text similarity otherwise) combined
     * with creation order — superseded versions are the historical ones
     * (`validTo` set), so nothing here is guesswork about intent.
     */
    history(id: string, opts?: HistoryOptions): Promise<MemoryHistory>;
    /**
     * Run dedupe + archive (+ optional cluster summary) in one pass.
     * This is the canonical entry point for "memory maintenance".
     */
    consolidate(opts?: ConsolidateOptions): Promise<ConsolidateResult>;
    /**
     * Decay-based algorithmic forgetting. Computes a retention score per
     * memory — importance, trust, access reinforcement, and an exponential
     * recency term — and SUPERSEDES memories whose score falls below
     * `minScore`: `validTo = now`, so they become historical and drop out
     * of default search while remaining queryable via `searchTemporal`.
     * Nothing is ever deleted.
     *
     * Weights: importance 0.35 · trust 0.15 · access 0.15 · recency 0.35.
     * With the default half-life (60 days) a month-old, never-accessed,
     * agent-inferred low-importance memory crosses the default threshold
     * (~0.2) at roughly four months of age; frequently-reinforced or
     * user-stated memories effectively never do.
     */
    forgetByDecay(opts?: DecayForgettingOptions): Promise<DecayForgetResult>;
    /**
     * Internal: fetch every node's embedding for the given namespace.
     * Returns an empty array if the storage adapter doesn't expose
     * `getAllEmbeddings` (e.g. an in-memory custom adapter).
     */
    private collectEmbeddings;
    /** Clear the search result cache. Called on any mutation. */
    private invalidateSearchCache;
    /**
     * Wait for all pending embedding jobs to complete.
     *
     * Resolves once both the queue and any in-flight persist callbacks have
     * drained. Safe to call when no embedding provider is configured — it
     * resolves immediately.
     */
    flushEmbeddings(): Promise<void>;
    /**
     * Embed a query through the configured provider with an in-process LRU
     * cache. Returns `null` when no embedding provider is configured.
     *
     * The cache is recall-neutral by construction: the provider's embed
     * is deterministic in (provider id, model, query), so a hit returns
     * the exact vector a fresh inference would produce. This collapses the
     * repeated identical inferences an agent loop performs — most
     * importantly the 3× fan-out inside `multiStreamSearch`, which now
     * embeds once and threads the vector through all three pool streams.
     */
    private embedQueryCached;
    /**
     * Re-embed every node with the CURRENTLY configured provider, replacing
     * stale vectors in place. Required after switching embedding models:
     * vectors from different models are not comparable (semantic search
     * filters by stored model), and the embedding table has no automatic
     * migration.
     *
     * @param opts.purgeStale — When true, first delete all embedding rows
     *   stored by any OTHER model (frees space; without it, old-model rows
     *   stay on disk until overwritten node-by-node).
     * @returns Summary counters. `failed` counts nodes whose embedding
     *   could not be recomputed (their status is marked `failed`).
     */
    reindexEmbeddings(opts?: {
        purgeStale?: boolean;
    }): Promise<{
        reembedded: number;
        purged: number;
        failed: number;
        model: string;
    }>;
    /**
     * Per-node embedding status, plus the queue's running/pending counters.
     *
     * @param nodeId — Optional filter; when provided, returns only that node.
     * @returns Aggregate status when called with no args, or a single info
     *   object for the requested node.
     */
    embeddingStatus(): EmbeddingQueueStatus;
    embeddingStatus(nodeId: string): EmbeddingNodeStatusInfo | null;
    /**
     * Set the temporal validity window on a memory node.
     *
     * When `validTo` is set to a past timestamp, the memory becomes
     * "historical" — it is excluded from default search results but
     * remains queryable via `searchTemporal(query, atTime)`.
     *
     * @param id — Memory node ID.
     * @param validFrom — Validity start (Unix ms), or null to clear.
     * @param validTo — Validity end (Unix ms), or null to clear.
     * @returns The updated node, or null if not found.
     */
    setValidity(id: string, validFrom: number | null, validTo: number | null, 
    /** Optional confidence to stamp alongside the validity change. */
    confidence?: number, 
    /** Optional evidence count to stamp alongside the validity change. */
    evidenceCount?: number): Promise<MemoryNode | null>;
    /**
     * Search for memories that were valid at a specific point in time.
     *
     * This is the temporal knowledge graph query: "What did we know
     * at time T?" A memory is included if:
     *   (validFrom is null OR validFrom <= atTime) AND
     *   (validTo is null OR validTo >= atTime)
     *
     * @param query — Text search query.
     * @param atTime — The point in time to query (Unix ms).
     * @param opts — Additional search filters (limit, tags, namespace, etc.).
     * @returns Scored memories valid at `atTime`.
     */
    searchTemporal(query: string, atTime: number, opts?: Omit<SearchFilter, "query" | "validAt">): Promise<ScoredMemory[]>;
    /**
     * Supersede a memory — mark it as historical by setting `validTo`
     * to now, and optionally link the replacement memory with a
     * `temporal_precedes` edge.
     *
     * @param id — The memory to supersede.
     * @param replacementId — Optional ID of the new memory that replaces it.
     * @param confidence — Optional confidence to stamp on the retracted
     *   node. Supersession is a contradiction: when the evidence state
     *   machine has already computed the crushed score, pass it here so
     *   the old version stops outranking its replacement. Omit to leave
     *   confidence untouched (pure temporal supersession).
     * @returns The superseded (updated) node, or null if not found.
     */
    supersede(id: string, replacementId?: string, confidence?: number, evidenceCount?: number): Promise<MemoryNode | null>;
    /**
     * Find the predecessor of a memory in its version ledger — the older
     * version the target superseded. Signals, in priority order:
     *
     * 1. `temporal_precedes` edges where the target is the newer endpoint
     *    (written by supersede(id, replacementId));
     * 2. `resolved` contradiction pairs involving the target (written by the
     *    evidence state machine's contradict path). Pair ids are stored in
     *    canonical sorted order, so direction is recovered from validity —
     *    the historical (validTo-stamped) endpoint is the predecessor.
     *
     * The most recently created candidate wins. Returns null when the
     * memory has no supersession history.
     */
    findRevertPredecessor(targetId: string): Promise<MemoryNode | null>;
    /**
     * The most recent currently-valid, non-audit memory in a namespace —
     * what "revert that" / "revert the last thing" resolves to. Revert
     * audit events are excluded so a revert can never target its own
     * record.
     */
    private mostRecentRevertible;
    /**
     * Resolve a named entity to the best-matching memory. Disambiguation
     * rule: when several valid memories match, the most recently created
     * one wins and the rest are returned as `alternatives` for confirmation
     * (CLI --dry-run, MCP dry_run) instead of being guessed over.
     */
    private resolveRevertEntity;
    /**
     * Resolve a revert scope to a concrete target memory.
     *
     * - `{ kind: "id" }` — the memory with that ID.
     * - `{ kind: "last" }` — the most recent currently-valid, non-audit
     *   memory in the namespace (durable across processes).
     * - `{ kind: "entity" }` — named-entity search, most-recent-wins.
     * - `{ kind: "text" }` — natural language run through the local intent
     *   detector (`detectRevertIntent`); "last"-scope phrasing resolves as
     *   "last", named phrasing as an entity. Throws when no revert intent
     *   is detected.
     */
    resolveRevertTarget(scope: RevertScopeInput | string, namespace?: string): Promise<RevertTargetResolution>;
    /**
     * Revert a memory to its previous version — the command-driven belief
     * revision primitive. The user/agent says "revert that" / "go back" /
     * "that last thing was wrong"; MemOS closes the target's validity
     * interval NOW and reactivates the predecessor, so the next recall
     * returns the pre-correction belief with full provenance.
     *
     * Add-only: the reverted-away version stays in history (validTo
     * stamped, the row is never deleted), and the revert itself is recorded
     * as an audit event node (tags `audit`/`revert`, metadata.audit =
     * "revert") capturing who/when/why. Edge validity intervals closed by
     * the earlier supersession are NOT reopened — edges stay add-only; the
     * node-level belief is what recall returns.
     *
     * @param scope — where the target comes from (or a raw string, run
     *   through the intent detector).
     * @param opts — actor / reason (recorded on the audit event), dryRun,
     *   namespace. Defaults are unchanged everywhere else.
     * @throws When no target resolves, the target is already historical, or
     *   it has no supersession history to restore.
     */
    revert(scope: RevertScopeInput | string, opts?: RevertOptions): Promise<RevertResult>;
    /**
     * Get the trust score of a memory.
     *
     * @param id — Memory node ID.
     * @returns The trust score [0, 1], or null if the node doesn't exist.
     */
    trust(id: string): Promise<number | null>;
    /**
     * Set the trust score of a memory.
     *
     * Trust scores influence retrieval ranking: higher-trust memories
     * rank above lower-trust ones for the same relevance score.
     *
     * @param id — Memory node ID.
     * @param score — Trust score in [0, 1].
     * @returns The updated node, or null if not found.
     */
    setTrust(id: string, score: number): Promise<MemoryNode | null>;
    /**
     * Adjust the trust score of a memory by a delta, clamped to [0, 1].
     *
     * @param id — Memory node ID.
     * @param delta — Amount to add (positive) or subtract (negative).
     * @returns The updated node, or null if not found.
     */
    adjustTrust(id: string, delta: number): Promise<MemoryNode | null>;
    /**
     * Extract candidate facts from a conversation.
     *
     * Uses a rule-based extractor that identifies user statements,
     * preferences, and entities from conversation messages. Each
     * candidate fact is scored by confidence and optionally stored.
     *
     * This is a local-first alternative to LLM-based extraction — no
     * API calls required. For higher-quality extraction, callers can
     * use an LLM to pre-process the conversation and pass the results
     * as plain text messages.
     *
     * @param messages — The conversation to extract facts from.
     * @param opts — Extraction options.
     * @returns Extracted facts and (if autoStore) stored node IDs.
     */
    extractFacts(messages: ConversationMessage[], opts?: ExtractFactsOptions): Promise<ExtractFactsResult>;
    /**
     * Rule-based fact extractor. Scans conversation messages for
     * patterns that indicate facts, preferences, and entities.
     *
     * Heuristics:
     * - "I like/prefer/use/work at" → preference
     * - "My name is/I am/I'm" → entity (about the user)
     * - "I need/want/should" → context
     * - Declarative statements from the user → fact
     */
    private runFactExtractor;
    /**
     * Return a detailed diagnostics snapshot of the memory store.
     *
     * Includes counts by source, type, and namespace; temporal and
     * trust statistics; embedding coverage; storage capabilities; and
     * database file size.
     *
     * @returns A diagnostics report.
     */
    /**
     * Runtime metadata about the active embedding provider: what was
     * requested vs. what actually resolved, and whether the FastEmbed
     * local-hash fallback is active. Returns null when embeddings are
     * disabled (`embeddings: { enabled: false }`).
     */
    getEmbeddingRuntimeInfo(): EmbeddingRuntimeInfo | null;
    diagnostics(): Promise<DiagnosticsResult>;
    /**
     * Register an event listener.
     */
    on(event: MemOSEvent, listener: MemOSEventListener): void;
    /**
     * Remove an event listener.
     */
    off(event: MemOSEvent, listener: MemOSEventListener): void;
    private emit;
    private assertInit;
    /**
     * Evict the least-important memory when `maxMemories` is exceeded.
     *
     * The selection is a single SQL statement — we do not load the full
     * table into memory the way the old in-JS sort did. Falls back to
     * the in-memory path if the storage adapter doesn't implement
     * `evictLeastImportant`.
     */
    private evict;
    /**
     * Evidence state machine hook for `store()` (opt-in via
     * `{ evidenceLearning: true }`). Compares the incoming content against
     * the most similar existing memory in the namespace and applies the
     * outcome:
     *
     *   - `{ action: "reinforced", node }`: an existing memory was
     *     confirmed — its confidence and evidence count were bumped and
     *     the caller should NOT write a duplicate node. The returned node
     *     is the freshly-updated version.
     *   - `{ action: "superseded" }`: an existing memory was contradicted —
     *     it has been marked historical (validTo = now) and the caller
     *     SHOULD write the new version.
     *   - `{ action: "new" }`: no decisive match; the caller writes a
     *     fresh node.
     *
     * Candidate selection reuses the search index (top-8 by hybrid rank);
     * classification uses content-to-content pair similarity via
     * {@link classifyEvidence}, with a shared-subject guard so a negation
     * can only supersede a memory that is actually about the same thing.
     */
    private applyStoreEvidence;
    /** Cosine similarity over embeddings with a bag-of-words fallback. */
    private pairSimilarity;
    /**
     * The text that gets embedded for a node. `embeddings.embedText`
     * selects raw content vs. the historical summary+content blend (the
     * extractive summary roughly doubles input tokens for short facts).
     * Write-time context (`metadata.context`, from `store({ context })` or
     * the `enrichMemory` hook) is prepended so the vector carries
     * situational meaning — contextual retrieval, without re-embedding
     * queries. Only nodes stored with a context line are affected; changing
     * enrichment later requires `reindexEmbeddings()`.
     */
    private embeddedTextFor;
    private persistEmbedding;
    /**
     * Runs after an embedding vector is persisted for a node — all three
     * persist paths (background queue, synchronous queue fallback, inline
     * fallback) funnel through here.
     *
     * Beyond persisting, this is the write-time contradiction-detection
     * hook: when the node was freshly written by `store()` (the pending
     * gate), a bounded semantic-neighbor scan flags contradiction
     * candidates and persists them. The scan runs in the embedding
     * background context — never on the synchronous `store()` path — so
     * write-path overhead stays bounded. Best-effort: detection failures
     * must never break embedding persistence.
     */
    private onEmbeddingPersisted;
    /**
     * Write-time contradiction candidate detection.
     *
     * Scans a BOUNDED set of semantic neighbors (top
     * {@link CONTRADICTION_SCAN_LIMIT} above
     * {@link CONTRADICTION_SIM_MIN}, same namespace, same embedding
     * model — one indexed query, never a full table scan), flags pairs
     * in the contradiction band via `findContradictionCandidates`, and
     * persists them as `unresolved` pairs. Confirmed `contradicted`
     * outcomes from the evidence state machine are recorded separately
     * by `store()` with status `resolved` (see the provenance block
     * there).
     */
    private detectContradictionsForNode;
    /**
     * Enqueue a node for background embedding. Returns immediately.
     *
     * If `embeddingQueue.synchronous` is true, falls back to awaiting the
     * inline persist call (useful for tests that need read-after-write
     * semantics).
     */
    private scheduleEmbedding;
    private recordEmbeddingStatus;
    private backfillEmbeddings;
    /**
     * Read-time contradiction resolution (accuracy item 4).
     *
     * Fetches recorded contradiction pairs for the ids in the fused
     * result set (one bounded IN-query) and applies
     * {@link resolveContradictionsAtRead}: when both members of a pair
     * are present, the older one is score-demoted so the newer version
     * wins. Best-effort and storage-agnostic — any failure or a storage
     * without the contradictions table returns the input untouched.
     */
    private applyContradictionResolution;
    /**
     * ── item2: entity leg ── candidate generation from the entity→memories
     * inverted index (`src/entity-index.ts`). Returns ranked `ScoredMemory`s
     * (score = number of matched query entities, rank = match count desc /
     * node id tiebreak) for fusion as the third RRF leg in `fuseResults`.
     *
     * Applies the same namespace / type / pool / tag / temporal scoping as
     * the keyword and semantic legs, so the entity leg can never leak
     * out-of-scope memories into results. Degrades to `[]` when the query
     * has no entities or the storage has no entity index (custom adapters).
     */
    private fetchEntityLeg;
    private hybridSearch;
    /**
     * Search and report the relevance gate's verdict alongside the results.
     *
     * Backward-compatible sibling of {@link search}: `search()` keeps
     * returning a bare `ScoredMemory[]`, and every result still carries the
     * same `relevanceGate` metadata this method exposes as a first-class
     * member. Unlike `search()` this method bypasses the result cache, so
     * the reported verdict always describes the call you just made.
     *
     * @example
     * ```ts
     * const memos = new MemOS({
     *   retrieval: { relevanceGate: { enabled: true, abstainSimilarity: 0.3 } },
     * });
     * const { results, gate } = await memos.searchWithGate("anything");
     * if (gate.abstained) {
     *   // The store has nothing about this query — answer from world
     *   // knowledge instead of inventing a memory recall.
     * }
     * ```
     */
    searchWithGate(queryOrFilter: string | SearchFilter): Promise<{
        results: ScoredMemory[];
        gate: RelevanceGateResult;
    }>;
    /**
     * Resolve the relevance-gate config, or `null` when the gate is off.
     *
     * Off means byte-identical output: the stage is skipped entirely and
     * the pipeline returns exactly what fusion + expansion + rerank
     * produced. `enabled` defaults to false because this is a published
     * SDK and an enabled gate changes how many memories a search returns
     * for the same query. `MEMOS_RELEVANCE_GATE=1` turns it on without a
     * config change (experiments and A/B runs).
     */
    private resolveRelevanceGate;
    /**
     * Apply the relevance gate to a finished, best-first result list.
     *
     * `applyRelevanceGate` (src/retrieval.ts) is pure and already covers
     * abstention and tail trimming; this wrapper adds the two things the
     * SDK needs around it:
     *
     *  - a `minResults` floor, so a caller that needs N items is never left
     *    with fewer by an aggressive ratio;
     *  - reporting — the outcome is written to `opts.gateOut` (when the
     *    caller wants it, e.g. `searchWithGate`) and stamped onto every
     *    surviving result as `ScoredMemory.relevanceGate`.
     *
     * Only runs when the gate is configured; otherwise the input array is
     * returned untouched.
     */
    private applyRelevanceGateStage;
    /**
     * Two-stage reranking (`experimental.rerank`, off by default). The first
     * stage — hybrid retrieval — exists to RECALL candidates; a cross-encoder
     * then re-scores the top `candidates` fused results against the query and
     * the final ranking is reordered by that score. Cross-encoders read query
     * and document together, so they are far more precise than bi-encoder
     * similarity — at O(candidates) cost per query, which is why it only
     * ever runs on the narrow head of the pool.
     *
     * Two providers: `"endpoint"` (an HTTP `/rerank` server, e.g.
     * bge-reranker-v2-m3 served by llama-server) and `"local"` (in-process
     * cross-encoder via `src/rerank-local.ts`, no server needed).
     *
     * On reranker failure the fused order is kept unchanged (graceful
     * degradation) — a downed reranker degrades quality, not availability.
     */
    private applyRerank;
    /**
     * Graph-expansion recall leg. Takes the top `maxSeeds` fused results,
     * follows their graph edges in both directions, and injects unseen
     * neighbours at `seedScore × scoreFactor` (halved for each subsequent
     * neighbour of the same seed). Lifts multi-evidence / multi-hop
     * queries where related facts are connected by edges but neither
     * retrieval leg surfaces them.
     *
     * An EXPLICIT `config` (passed by `contextPack`, which resolves its
     * own `graphExpansion` opt-out) is authoritative — it is used as-is.
     * When `config` is omitted the leg resolves its own default:
     * `experimental.graphExpansion` when present, otherwise ON, and OFF
     * when `fusion.graphExpansion` is configured (that flag is the
     * PPR-leg knob — see `applyPprGraphExpansion` — and when a caller
     * tunes it the PPR walk owns graph expansion, so this older
     * injection leg stays out of the way rather than double-injecting
     * nodes the PPR walk should be reporting on).
     *
     * `SearchFilter.graphExpansion` is an opt-OUT here (`false` suppresses
     * injection for one query, which is how the pack path turns expansion
     * off); `true` is the PPR leg's business and must not turn injection
     * on when it is otherwise off.
     */
    private applyGraphExpansion;
    /**
     * PPR-lite graph expansion (single-step, HippoRAG-style). Runs after
     * fusion (and after the experimental neighbour-injection leg): the top
     * `graphExpansionSeeds` fused results seed a personalized PageRank walk
     * (damping 0.5, `graphExpansionHops` hops) over graph edges plus
     * shared-entity links, and the final score blends as
     * `(1 - graphExpansionAlpha) * fused + graphExpansionAlpha * pprNorm`
     * with PPR scores normalized to [0,1]. Graph neighbours of seeds that
     * neither retrieval leg surfaced can enter the results this way.
     *
     * Controlled by `config.fusion`: `graphExpansion` (default true),
     * `graphExpansionAlpha` (default 0.2), `graphExpansionHops` (default 2),
     * `graphExpansionSeeds` (default 10). `filter.graphExpansion === false`
     * disables it for a single query. With expansion disabled (or
     * alpha <= 0) the fused list is returned untouched — byte-identical to
     * the pre-expansion pipeline.
     *
     * Cost: one bounded BFS + power iteration over the seed neighbourhood
     * (no LLM, no embedding calls) plus at most `DEFAULT_PPR_MAX_INJECTED`
     * `peekNode` reads for newly injected neighbours.
     */
    private applyPprGraphExpansion;
    /**
     * In-memory mirror of the SQLite `queryNodes` structured-filter
     * semantics, applied to PPR-injected neighbours. The SQL legs filter
     * type, pool, tags, metadata, importance/trust bounds, and temporal
     * windows at scan time; graph traversal bypasses all of that, so an
     * injected node must satisfy the same constraints or the expansion
     * would leak across filter boundaries (e.g. a procedure-only search
     * surfacing an event-pool neighbour).
     *
     * Namespace scoping is enforced separately by the seed-namespace
     * guard (stricter: the injected node must share a seed's namespace,
     * and seeds already passed the query's namespace/scope filter). The
     * query text itself is intentionally not re-applied — injected nodes
     * are recall wins the keyword/semantic legs missed.
     */
    private pprInjectedNodePassesFilter;
    /**
     * Neighbour lookup for the PPR walk, over two link types:
     *
     * (a) Graph edges — from the in-memory `GraphEngine` adjacency (both
     *     endpoints, i.e. undirected traversal). Cheapest source: no
     *     storage I/O, O(1) per node.
     * (b) Shared-entity links — nodes in the fused candidate set sharing a
     *     tag or `metadata.entities` entry (exact match, lowercased),
     *     built in-memory over the candidate set. There is no
     *     entity→memories inverted table on this branch, so this is the
     *     zero-I/O analogue; nodes discovered via edges at hop 2+ do not
     *     contribute entity links (their tags are never fetched, keeping
     *     the hot path bounded) but remain reachable/expandable via edges.
     *
     * The returned list is sorted for deterministic iteration; fan-out
     * capping happens inside {@link personalizedPageRank}.
     */
    private buildPprNeighbors;
    /**
     * Near-duplicate suppression (opt-in via `filter.semanticDedup`). A
     * result whose stored embedding is a near-verbatim duplicate (cosine >=
     * `experimental.searchDedupThreshold`, default 0.95) of an
     * already-selected result is dropped and the next candidate takes its
     * slot — multi-evidence questions otherwise lose top-K slots to
     * restated facts. Similarity comes from the storage vector cache, so
     * the pass costs a few dot products, not a new embedding call.
     */
    private applySearchDedup;
    /**
     * Session-sibling expansion. Memories recorded from the same
     * conversation (`metadata.sessionId` / `metadata.instanceId`) are
     * pulled in behind their seed at a decaying fraction of the seed
     * score. Multi-hop answers typically span many turns of one session,
     * so recovering the neighbours of a single relevant turn raises
     * all-evidence recall without another embedding pass.
     *
     * ON by default (`experimental.sessionExpansion`, default true):
     * injected siblings sit BEHIND every organically-retrieved result at a
     * decaying `seed.score * scoreFactor^k`, so the head ordering never
     * moves and only the empty tail is filled — the injected node is only
     * ever ranked above nodes that scored below it. An explicit
     * `filter.sessionExpansion === false` disables it per query.
     */
    private applySessionExpansion;
    /**
     * Start the background TTL sweep timer.
     */
    private startSweep;
    /**
     * Stop the background TTL sweep timer.
     */
    private stopSweep;
    /**
     * Convert a memory node to markdown with YAML frontmatter.
     */
    private nodeToMarkdown;
    private escapeDot;
    private escapeRegex;
}
export type { MemoryNode, MemoryEdge, SearchFilter, ScoredMemory, GraphSnapshot, MemOSConfig, ExportOptions, ExportResult, ExperimentalConfig, } from "./types.js";
export { GraphEngine, textSimilarity } from "./graph.js";
export { SQLiteStorage } from "./storage/sqlite.js";
//# sourceMappingURL=memory.d.ts.map