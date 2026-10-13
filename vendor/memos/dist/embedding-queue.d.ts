/**
 * EmbeddingQueue — bounded, retryable, event-emitting background worker
 * pool for embedding generation.
 *
 * Why this exists: the previous MemOS engine called `provider.embed()` inline
 * from `store()` and `update()`. For local-hash that costs nothing, but the
 * moment a user points MemOS at Ollama, LM Studio, or any OpenAI-compatible
 * endpoint, every write blocks for the full round-trip. This queue lets
 * `store()` return as soon as the node is persisted, with the embedding work
 * happening in the background under a bounded concurrency cap.
 *
 * Design:
 *   - One shared queue per MemOS instance.
 *   - `enqueue()` is fire-and-forget — returns a job id immediately.
 *   - Workers are pulled in FIFO order. Concurrency is bounded by
 *     `EmbeddingQueueConfig.concurrency` (default 2).
 *   - When `batchSize` > 1 and the provider implements `batchEmbed`,
 *     a worker drains up to `batchSize` pending jobs into one batched
 *     call; a failed batch falls back to per-job retries.
 *   - Failures are retried with exponential backoff up to `maxRetries`
 *     (default 3) before the job is marked `failed` and an
 *     `embedding:failed` event fires.
 *   - Backpressure: if `maxQueueSize` is exceeded, `enqueue()` throws
 *     instead of growing memory unbounded. Callers can `await flush()`
 *     to make room.
 *   - Lifecycle events: `embedding:queued`, `embedding:started`,
 *     `embedding:complete`, `embedding:failed`, `embedding:retry`.
 *
 * The queue does not know about storage. It only knows how to call the
 * `EmbeddingProvider`. Persistence of the resulting vector is the
 * responsibility of the caller (a `persist` callback) so this module
 * stays storage-agnostic and easy to test.
 *
 * @module @memos/embedding-queue
 */
import type { EmbeddingProvider, EmbeddingVector } from "./types.js";
/** Lifecycle states an embedding job can be in. */
export type EmbeddingJobStatus = "queued" | "running" | "complete" | "failed" | "retrying";
/** Reasons a job can be marked failed. */
export type EmbeddingFailureReason = "max_retries" | "aborted" | "provider_error";
/** A single embedding job, exposed for observability. */
export interface EmbeddingJob {
    /** Stable id assigned at enqueue time. */
    id: string;
    /** Memory node this embedding is for. */
    nodeId: string;
    /** Text to embed. */
    text: string;
    /** Current status. */
    status: EmbeddingJobStatus;
    /** Number of times we have called the provider for this job. */
    attempts: number;
    /** Most recent error, if any. */
    lastError: string | null;
    /** Timestamp the job was enqueued (ms). */
    enqueuedAt: number;
    /** Timestamp of the most recent status change (ms). */
    updatedAt: number;
    /** Computed vector, set when status is `complete`. */
    vector: EmbeddingVector | null;
    /** Model id, set when status is `complete`. */
    model: string | null;
}
/** Persist callback — the queue does not know how to write the vector. */
export type PersistEmbeddingFn = (nodeId: string, vector: EmbeddingVector, model: string) => Promise<void>;
/** Status-change callback — used by MemOS to track per-node status. */
export type EmbeddingStatusChangeFn = (nodeId: string, status: EmbeddingJobStatus, error: string | null) => void | Promise<void>;
/** Configuration for EmbeddingQueue. */
export interface EmbeddingQueueConfig {
    /** Embedding provider. Required. */
    provider: EmbeddingProvider;
    /** Maximum number of concurrent in-flight embed calls. Default 2. */
    concurrency?: number;
    /**
     * Maximum number of pending jobs drained into a single `batchEmbed()`
     * call when the provider supports batching (e.g. Ollama and
     * OpenAI-compatible servers accept array input). Default 1 = one
     * `embed()` call per job (legacy behavior). Groups that fail as a batch
     * fall back to the per-job retry path.
     */
    batchSize?: number;
    /** Maximum number of jobs buffered when workers are saturated. Default 10000. */
    maxQueueSize?: number;
    /** Maximum number of retry attempts per job. Default 3. */
    maxRetries?: number;
    /** Base backoff in ms; retries use exponential backoff. Default 250. */
    retryBackoffMs?: number;
    /**
     * Coalescing delay in ms before a fully-idle queue picks up newly-enqueued
     * work. Default 5.
     *
     * Why: `schedule()` used to defer pickup with a bare `queueMicrotask`,
     * so sequential `await store()` calls each formed a single-job group and
     * `batchEmbed` was never called — one provider round trip per memory.
     * A short linger lets rapid sequential enqueues coalesce into full
     * `batchSize` groups (N round trips become N/batchSize). The linger only
     * applies when no worker is busy; while workers run, pending jobs
     * accumulate on their own and are picked up immediately. Ordering and
     * completion guarantees are unchanged; `flush()` still drains
     * everything. Set to 0 to restore the immediate microtask pickup.
     */
    batchLingerMs?: number;
    /** Persist callback — invoked once per job on success. Optional. */
    onPersist?: PersistEmbeddingFn;
    /** Status-change callback — fires on every state transition. Optional. */
    onStatusChange?: EmbeddingStatusChangeFn;
}
/**
 * Bounded, retryable, non-blocking embedding queue.
 *
 * @example
 * ```ts
 * const queue = new EmbeddingQueue({
 *   provider,
 *   concurrency: 4,
 *   onPersist: async (nodeId, vector, model) => {
 *     await storage.saveEmbedding(nodeId, vector, model);
 *   },
 * });
 *
 * const jobId = queue.enqueue(node.id, text);
 * await queue.flush();
 * await queue.close();
 * ```
 */
export declare class EmbeddingQueue {
    private readonly provider;
    private readonly concurrency;
    private readonly batchSize;
    private readonly maxQueueSize;
    private readonly maxRetries;
    private readonly retryBackoffMs;
    private readonly batchLingerMs;
    private readonly onPersist?;
    private readonly onStatusChange?;
    /** Pending jobs not yet picked up by a worker. */
    private pending;
    /** Currently running job groups, by worker slot index. */
    private readonly running;
    /** Job index by id, for status queries. */
    private readonly jobs;
    /** Resolvers for `flush()` callers, resolved when the queue drains. */
    private readonly drainWaiters;
    /** Set true after `close()` so enqueue can reject and workers exit. */
    private closed;
    /** Guards one-at-a-time deferred group pickup (see schedule()). */
    private scheduleQueued;
    constructor(config: EmbeddingQueueConfig);
    /**
     * Enqueue an embedding job. Returns a job id immediately.
     *
     * @throws if the queue is full or has been closed.
     */
    enqueue(nodeId: string, text: string): string;
    /** Number of jobs currently waiting or running. */
    size(): number;
    /** Number of jobs currently being processed. */
    activeCount(): number;
    /** Return a snapshot of a job by id, or null if unknown. */
    getJob(id: string): EmbeddingJob | null;
    /** Return all jobs that are not in a terminal state. */
    pendingJobs(): EmbeddingJob[];
    /**
     * Wait for the queue to drain. Resolves when both `pending` and
     * `running` are empty. If the queue is already drained, resolves on
     * the next microtask.
     */
    flush(): Promise<void>;
    /**
     * Permanently stop the queue. In-flight jobs are allowed to finish
     * (and their persist callbacks run) but no new work is accepted.
     */
    close(): Promise<void>;
    private notifyStatus;
    /**
     * Pull pending jobs into idle worker slots. The actual pickup is
     * deferred by one microtask so a synchronous enqueue burst (e.g. an
     * ingestion loop storing N memories back-to-back) coalesces into
     * full `batchSize` groups instead of starting a half-empty group per
     * enqueue.
     */
    private schedule;
    private scheduleNow;
    private runGroup;
    private runJobWithRetries;
    /** After a worker slot frees, schedule the next pending job and
     *  resolve any flush() waiters that are now satisfied. */
    private afterJob;
}
//# sourceMappingURL=embedding-queue.d.ts.map