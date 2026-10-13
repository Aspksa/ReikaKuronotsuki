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
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_BATCH_SIZE = 1;
const DEFAULT_MAX_QUEUE_SIZE = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BACKOFF_MS = 250;
const DEFAULT_BATCH_LINGER_MS = 5;
/** Generate a short, unique job id without pulling in a uuid dep. */
function generateJobId() {
    return `emb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
export class EmbeddingQueue {
    provider;
    concurrency;
    batchSize;
    maxQueueSize;
    maxRetries;
    retryBackoffMs;
    batchLingerMs;
    onPersist;
    onStatusChange;
    /** Pending jobs not yet picked up by a worker. */
    pending = [];
    /** Currently running job groups, by worker slot index. */
    running;
    /** Job index by id, for status queries. */
    jobs = new Map();
    /** Resolvers for `flush()` callers, resolved when the queue drains. */
    drainWaiters = [];
    /** Set true after `close()` so enqueue can reject and workers exit. */
    closed = false;
    /** Guards one-at-a-time deferred group pickup (see schedule()). */
    scheduleQueued = false;
    constructor(config) {
        this.provider = config.provider;
        this.concurrency = Math.max(1, config.concurrency ?? DEFAULT_CONCURRENCY);
        this.batchSize = Math.max(1, config.batchSize ?? DEFAULT_BATCH_SIZE);
        this.maxQueueSize = Math.max(1, config.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE);
        this.maxRetries = Math.max(0, config.maxRetries ?? DEFAULT_MAX_RETRIES);
        this.retryBackoffMs = Math.max(0, config.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS);
        this.batchLingerMs = Math.max(0, config.batchLingerMs ?? DEFAULT_BATCH_LINGER_MS);
        this.onPersist = config.onPersist;
        this.onStatusChange = config.onStatusChange;
        this.running = new Array(this.concurrency).fill(null);
    }
    /**
     * Enqueue an embedding job. Returns a job id immediately.
     *
     * @throws if the queue is full or has been closed.
     */
    enqueue(nodeId, text) {
        if (this.closed) {
            throw new Error("EmbeddingQueue is closed.");
        }
        if (this.pending.length + this.activeCount() >= this.maxQueueSize) {
            throw new Error(`EmbeddingQueue is full (${this.maxQueueSize} jobs). ` +
                `Call await queue.flush() to make room.`);
        }
        const job = {
            id: generateJobId(),
            nodeId,
            text,
            status: "queued",
            attempts: 0,
            lastError: null,
            enqueuedAt: Date.now(),
            updatedAt: Date.now(),
            vector: null,
            model: null,
        };
        this.pending.push(job);
        this.jobs.set(job.id, job);
        this.notifyStatus(job, "queued", null);
        this.schedule();
        return job.id;
    }
    /** Number of jobs currently waiting or running. */
    size() {
        return this.pending.length + this.activeCount();
    }
    /** Number of jobs currently being processed. */
    activeCount() {
        let n = 0;
        for (const group of this.running) {
            if (group)
                n += group.length;
        }
        return n;
    }
    /** Return a snapshot of a job by id, or null if unknown. */
    getJob(id) {
        const j = this.jobs.get(id);
        return j ? { ...j } : null;
    }
    /** Return all jobs that are not in a terminal state. */
    pendingJobs() {
        const out = [];
        for (const j of this.jobs.values()) {
            if (j.status === "queued" ||
                j.status === "running" ||
                j.status === "retrying") {
                out.push({ ...j });
            }
        }
        return out;
    }
    /**
     * Wait for the queue to drain. Resolves when both `pending` and
     * `running` are empty. If the queue is already drained, resolves on
     * the next microtask.
     */
    async flush() {
        if (this.size() === 0)
            return;
        await new Promise((resolve) => this.drainWaiters.push(resolve));
    }
    /**
     * Permanently stop the queue. In-flight jobs are allowed to finish
     * (and their persist callbacks run) but no new work is accepted.
     */
    async close() {
        this.closed = true;
        await this.flush();
    }
    // --------------------------------------------------------------------------
    // Internal
    // --------------------------------------------------------------------------
    notifyStatus(job, status, error) {
        job.status = status;
        job.updatedAt = Date.now();
        job.lastError = error;
        if (this.onStatusChange) {
            try {
                const result = this.onStatusChange(job.nodeId, status, error);
                if (result && typeof result.then === "function") {
                    // Best-effort: do not await persistence callbacks in status notify.
                    result.catch(() => undefined);
                }
            }
            catch {
                // Status-callback errors are non-fatal.
            }
        }
    }
    /**
     * Pull pending jobs into idle worker slots. The actual pickup is
     * deferred by one microtask so a synchronous enqueue burst (e.g. an
     * ingestion loop storing N memories back-to-back) coalesces into
     * full `batchSize` groups instead of starting a half-empty group per
     * enqueue.
     */
    schedule() {
        if (this.scheduleQueued)
            return;
        this.scheduleQueued = true;
        // Coalescing linger: when the queue is fully idle, wait `batchLingerMs`
        // before picking up work so rapid sequential enqueues (e.g. `await
        // store()` in a loop) form full `batchSize` groups instead of one
        // single-job group each. While workers are already busy, pending jobs
        // accumulate on their own — pick those up immediately with no added
        // latency. A linger of 0 restores the immediate microtask pickup.
        const lingerIdle = this.batchLingerMs > 0 && this.activeCount() === 0;
        if (!lingerIdle) {
            queueMicrotask(() => {
                this.scheduleQueued = false;
                this.scheduleNow();
            });
        }
        else {
            setTimeout(() => {
                this.scheduleQueued = false;
                this.scheduleNow();
            }, this.batchLingerMs);
        }
    }
    scheduleNow() {
        for (let i = 0; i < this.running.length; i += 1) {
            if (this.running[i] !== null)
                continue;
            if (this.pending.length === 0)
                break;
            const group = this.pending.splice(0, this.batchSize);
            this.running[i] = group;
            // Fire-and-forget worker loop.
            void this.runGroup(i, group);
        }
    }
    async runGroup(slot, group) {
        const canBatch = group.length > 1 && typeof this.provider.batchEmbed === "function";
        if (!canBatch) {
            for (const job of group) {
                await this.runJobWithRetries(job);
            }
        }
        else {
            for (const job of group) {
                this.notifyStatus(job, "running", null);
            }
            try {
                const vectors = await this.provider.batchEmbed(group.map((job) => job.text));
                for (const [index, job] of group.entries()) {
                    job.attempts = 1;
                    job.vector = vectors[index] ?? null;
                    job.model = this.provider.model;
                    if (this.onPersist) {
                        await this.onPersist(job.nodeId, job.vector, this.provider.model);
                    }
                    this.notifyStatus(job, "complete", null);
                }
            }
            catch {
                // The batch as a whole failed — fall back to the per-job retry
                // path so one poisoned text cannot silently fail its whole group.
                for (const job of group) {
                    job.attempts = 0;
                    await this.runJobWithRetries(job);
                }
            }
        }
        this.running[slot] = null;
        this.afterJob();
    }
    async runJobWithRetries(job) {
        this.notifyStatus(job, "running", null);
        let attempt = 0;
        let lastError = null;
        while (attempt <= this.maxRetries) {
            attempt += 1;
            job.attempts = attempt;
            try {
                const vector = await this.provider.embed(job.text);
                job.vector = vector;
                job.model = this.provider.model;
                if (this.onPersist) {
                    await this.onPersist(job.nodeId, vector, this.provider.model);
                }
                this.notifyStatus(job, "complete", null);
                return;
            }
            catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                if (attempt > this.maxRetries)
                    break;
                const delay = this.retryBackoffMs * Math.pow(2, attempt - 1);
                this.notifyStatus(job, "retrying", lastError.message);
                await new Promise((resolve) => setTimeout(resolve, delay));
                // Mark the next attempt as running so observers see the transition.
                this.notifyStatus(job, "running", null);
            }
        }
        this.notifyStatus(job, "failed", lastError ? lastError.message : "unknown error");
    }
    /** After a worker slot frees, schedule the next pending job and
     *  resolve any flush() waiters that are now satisfied. */
    afterJob() {
        this.schedule();
        if (this.size() === 0 && this.drainWaiters.length > 0) {
            const waiters = this.drainWaiters.splice(0, this.drainWaiters.length);
            for (const w of waiters)
                w();
        }
    }
}
//# sourceMappingURL=embedding-queue.js.map