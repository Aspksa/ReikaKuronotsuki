/**
 * Strip all trailing slash characters from a URL/base path without using a
 * regular expression. Avoids a ReDoS-flagged `/+$/` pattern on user-supplied
 * input (CodeQL js/regular-expression-polynomial-redos).
 */
export function stripTrailingSlashes(url) {
    let result = url;
    while (result.endsWith("/")) {
        result = result.slice(0, -1);
    }
    return result;
}
const DEFAULT_DIMENSIONS = 384;
const SYNONYMS = {
    // Preference language
    prefer: ["like", "favor", "preference"],
    prefers: ["like", "likes", "preference"],
    preference: ["prefer", "like", "likes"],
    preferences: ["prefer", "likes", "favorite"],
    likes: ["prefer", "preference", "favorite"],
    favorite: ["favourite", "preferred", "likes"],
    // UI / appearance
    dark: ["night", "black", "dim"],
    theme: ["mode", "ui", "appearance"],
    themes: ["mode", "ui", "appearance"],
    mode: ["theme", "ui", "appearance"],
    // Memory vocabulary
    remember: ["memory", "recall"],
    remembers: ["memory", "recall"],
    memories: ["memory", "recall"],
    // Tasks
    todo: ["task", "action"],
    tasks: ["todo", "action"],
    // Exercise & fitness — paraphrases like "exercise routine" must reach
    // memories phrased as "runs 5k three times a week".
    exercise: ["workout", "training", "fitness", "runs", "running", "gym"],
    exercises: ["workout", "training", "fitness", "running"],
    workout: ["exercise", "training", "fitness", "gym"],
    runs: ["running", "jogging", "exercise"],
    running: ["runs", "jogging", "exercise"],
    routine: ["schedule", "habit", "regular"],
    routines: ["schedule", "habit", "regular"],
    habit: ["routine", "regular"],
    habits: ["routine", "regular"],
    gym: ["workout", "exercise", "fitness"],
    // Reading & books — "book author preferences" must reach "reads sci-fi,
    // especially Le Guin".
    book: ["books", "reads", "reading", "novel", "author", "literature"],
    books: ["book", "reading", "novel", "literature"],
    author: ["writer", "novelist", "book", "books"],
    authors: ["writers", "book", "books"],
    reads: ["reading", "book", "books"],
    reading: ["reads", "book", "books"],
    novel: ["book", "fiction", "literature"],
    // Media
    podcast: ["show", "audio", "episode"],
    music: ["song", "songs", "listening"],
    // Travel
    vacation: ["trip", "travel", "holiday"],
    holiday: ["vacation", "trip", "travel"],
    trip: ["travel", "vacation", "journey"],
    travel: ["trip", "vacation", "journey"],
    // Work
    job: ["work", "employment", "company", "employer", "career"],
    works: ["work", "job", "employment"],
    company: ["employer", "workplace", "business"],
    employer: ["company", "workplace"],
    career: ["job", "work", "profession"],
    // Relationships & family
    partner: ["spouse", "wife", "husband", "girlfriend", "boyfriend"],
    siblings: ["sister", "brother", "family"],
    sibling: ["sister", "brother", "family"],
    sister: ["sibling", "family"],
    brother: ["sibling", "family"],
    // Health
    allergies: ["allergic", "allergy", "intolerance", "reaction"],
    allergy: ["allergic", "intolerance"],
    allergic: ["allergy", "intolerance"],
    health: ["healthy", "wellness", "medical"],
    // Transport
    transportation: ["transport", "commute", "commuting"],
    commute: ["commuting", "transport"],
    bike: ["bicycle", "cycling"],
    bicycle: ["bike", "cycling"],
    // Hobbies & games
    hobby: ["hobbies", "pastime", "interest"],
    hobbies: ["hobby", "pastime", "interests"],
    games: ["game", "gaming", "playing"],
    gaming: ["games", "playing"],
    skill: ["level", "rating", "ability"],
    rating: ["score", "rank", "level"],
    // Instruments
    instrument: ["piano", "guitar", "musical"],
    piano: ["instrument", "keyboard", "musical"],
    guitar: ["instrument", "musical"],
    // Pets
    dog: ["pet", "puppy"],
    cat: ["pet", "kitten"],
    pet: ["dog", "cat", "animal"],
    // Food & drink
    coffee: ["espresso", "caffeine"],
    drinks: ["drink", "beverage"],
};
function tokenize(text) {
    return text
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 1);
}
function hashToken(token) {
    let hash = 2166136261;
    for (let index = 0; index < token.length; index += 1) {
        hash ^= token.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function addFeature(vector, feature, weight) {
    const hash = hashToken(feature);
    const index = hash % vector.length;
    const sign = hash & 1 ? 1 : -1;
    vector[index] += sign * weight;
}
export function normalizeVector(vector) {
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (norm === 0)
        return vector;
    return vector.map((value) => value / norm);
}
export function cosineSimilarity(a, b) {
    const length = Math.min(a.length, b.length);
    if (length === 0)
        return 0;
    let dot = 0;
    let aNorm = 0;
    let bNorm = 0;
    for (let index = 0; index < length; index += 1) {
        dot += a[index] * b[index];
        aNorm += a[index] * a[index];
        bNorm += b[index] * b[index];
    }
    if (aNorm === 0 || bNorm === 0)
        return 0;
    return dot / Math.sqrt(aNorm * bNorm);
}
export class LocalHashEmbeddingProvider {
    id = "local-hash";
    model;
    dimensions;
    constructor(options = {}) {
        this.dimensions = options.dimensions ?? DEFAULT_DIMENSIONS;
        this.model = options.model ?? `local-hash-${this.dimensions}`;
    }
    async embed(text) {
        const vector = Array.from({ length: this.dimensions }, () => 0);
        const tokens = tokenize(text);
        const uniqueTokens = [...new Set(tokens)];
        for (const token of uniqueTokens) {
            addFeature(vector, `tok:${token}`, 1);
            for (let length = 3; length <= Math.min(token.length, 5); length += 1) {
                for (let index = 0; index <= token.length - length; index += 1) {
                    addFeature(vector, `ng:${token.slice(index, index + length)}`, 0.12);
                }
            }
            for (const synonym of SYNONYMS[token] ?? []) {
                addFeature(vector, `tok:${synonym}`, 0.45);
            }
        }
        for (let index = 0; index < tokens.length - 1; index += 1) {
            addFeature(vector, `bi:${tokens[index]}:${tokens[index + 1]}`, 0.35);
        }
        return normalizeVector(vector);
    }
}
export class OllamaEmbeddingProvider {
    id = "ollama";
    model;
    dimensions;
    baseUrl;
    queryPrefix;
    documentPrefix;
    constructor(options = {}) {
        this.baseUrl = stripTrailingSlashes(options.baseUrl ?? "http://127.0.0.1:11434");
        this.model = options.model ?? "nomic-embed-text";
        this.dimensions = options.dimensions ?? 768;
        this.queryPrefix = options.queryPrefix ?? "";
        this.documentPrefix = options.documentPrefix ?? "";
    }
    async callEmbed(input) {
        const response = await fetch(`${this.baseUrl}/api/embed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: this.model, input }),
        });
        if (!response.ok) {
            throw new Error(`Ollama embedding request failed: ${response.status} ${response.statusText}`);
        }
        const payload = (await response.json());
        const vectors = payload.embeddings ??
            (payload.embedding ? [payload.embedding] : undefined);
        if (!Array.isArray(vectors)) {
            throw new Error("Ollama embedding response did not include a vector.");
        }
        if (Array.isArray(input) && vectors.length !== input.length) {
            throw new Error(`Ollama embedding response length mismatch: got ${vectors.length}, expected ${input.length}.`);
        }
        return vectors.map((v) => normalizeVector(v));
    }
    async embed(text) {
        const input = this.documentPrefix ? `${this.documentPrefix}${text}` : text;
        return this.callEmbed(input).then((v) => v[0]);
    }
    /**
     * Query embedding applies the configured `queryPrefix`, when set, so the
     * retrieval question is embedded in the model's query mode. Documents are
     * embedded WITHOUT the prefix (plain indexing text).
     */
    embedQuery(text) {
        const input = this.queryPrefix ? `${this.queryPrefix}${text}` : text;
        return this.callEmbed(input).then((v) => v[0]);
    }
    async batchEmbed(texts) {
        const input = this.documentPrefix
            ? texts.map((t) => `${this.documentPrefix}${t}`)
            : texts;
        return this.callEmbed(input);
    }
    async embedDocuments(texts) {
        if (texts.length === 1) {
            return this.embed(texts[0]).then((v) => [v]);
        }
        return this.batchEmbed(texts);
    }
}
export class OpenAICompatibleEmbeddingProvider {
    id = "openai-compatible";
    model;
    dimensions;
    baseUrl;
    apiKey;
    queryPrefix;
    documentPrefix;
    constructor(options) {
        this.baseUrl = stripTrailingSlashes(options.baseUrl ?? "https://api.openai.com/v1");
        this.apiKey = options.apiKey ?? "";
        this.model = options.model ?? "text-embedding-3-small";
        this.dimensions = options.dimensions ?? 1536;
        this.queryPrefix = options.queryPrefix ?? "";
        this.documentPrefix = options.documentPrefix ?? "";
    }
    async callEmbeddings(input) {
        const headers = new Headers({ "Content-Type": "application/json" });
        if (this.apiKey)
            headers.set("Authorization", `Bearer ${this.apiKey}`);
        const response = await fetch(`${this.baseUrl}/embeddings`, {
            method: "POST",
            headers,
            body: JSON.stringify({ model: this.model, input }),
        });
        if (!response.ok) {
            throw new Error(`Embedding request failed: ${response.status} ${response.statusText}`);
        }
        const payload = (await response.json());
        if (!Array.isArray(payload.data)) {
            throw new Error("Embedding response did not include a `data` array.");
        }
        if (payload.data.length !== input.length) {
            throw new Error(`Embedding response length mismatch: got ${payload.data.length}, expected ${input.length}.`);
        }
        return payload.data.map((row) => {
            if (!Array.isArray(row.embedding)) {
                throw new Error("Embedding response contained a non-vector entry.");
            }
            return normalizeVector(row.embedding);
        });
    }
    async embed(text) {
        const input = this.documentPrefix ? `${this.documentPrefix}${text}` : text;
        return this.callEmbeddings([input]).then((v) => v[0]);
    }
    embedQuery(text) {
        const input = this.queryPrefix ? `${this.queryPrefix}${text}` : text;
        return this.callEmbeddings([input]).then((v) => v[0]);
    }
    async batchEmbed(texts) {
        const input = this.documentPrefix
            ? texts.map((t) => `${this.documentPrefix}${t}`)
            : texts;
        return this.callEmbeddings(input);
    }
}
/**
 * Voyage AI embedding provider.
 *
 * Voyage's `voyage-3` family is the strongest open-weight-class
 * retrieval model we can hit over HTTP, and it's a common default
 * for serious RAG work. The provider uses the public
 * `https://api.voyageai.com/v1/embeddings` endpoint and Bearer auth.
 */
export class VoyageAIEmbeddingProvider {
    id = "voyage";
    model;
    dimensions;
    apiKey;
    baseUrl;
    constructor(options = {}) {
        if (!options.apiKey) {
            throw new Error("VoyageAIEmbeddingProvider requires an `apiKey` (e.g. `pa-…`).");
        }
        this.apiKey = options.apiKey;
        this.model = options.model ?? "voyage-3";
        this.dimensions = options.dimensions ?? 1024;
        this.baseUrl = stripTrailingSlashes(options.baseUrl ?? "https://api.voyageai.com/v1");
    }
    async embed(text) {
        return this.callEmbeddings([text]).then((v) => v[0]);
    }
    async batchEmbed(texts) {
        return this.callEmbeddings(texts);
    }
    async callEmbeddings(texts) {
        const response = await fetch(`${this.baseUrl}/embeddings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({ model: this.model, input: texts }),
        });
        if (!response.ok) {
            throw new Error(`Voyage embedding request failed: ${response.status} ${response.statusText}`);
        }
        const payload = (await response.json());
        if (!Array.isArray(payload.data)) {
            throw new Error("Voyage embedding response missing `data` array.");
        }
        const vectors = payload.data.map((row) => {
            if (!Array.isArray(row.embedding)) {
                throw new Error("Voyage embedding response contained a non-vector entry.");
            }
            return row.embedding;
        });
        if (vectors.length !== texts.length) {
            throw new Error(`Voyage embedding response length mismatch: got ${vectors.length}, expected ${texts.length}.`);
        }
        return vectors.map((v) => normalizeVector(v));
    }
}
export function createEmbeddingProvider(config) {
    if (config?.provider && typeof config.provider === "object") {
        return config.provider;
    }
    const provider = config?.provider ?? "fastembed";
    // NOTE: "fastembed" is the default because a bare `new MemOS()` should
    // give real local semantic search. FastEmbedEmbeddingProvider lazily
    // loads the transformers pipeline on first use and degrades loudly to
    // the deterministic local hash when the optional peer dep isn't
    // installed — so the default is always safe, just sometimes degraded.
    if (provider === "ollama") {
        return new OllamaEmbeddingProvider(config);
    }
    if (provider === "openai-compatible") {
        return new OpenAICompatibleEmbeddingProvider(config ?? {});
    }
    if (provider === "voyage") {
        return new VoyageAIEmbeddingProvider(config ?? {});
    }
    if (provider === "cohere") {
        return new CohereEmbeddingProvider(config ?? {});
    }
    if (provider === "fastembed") {
        return new FastEmbedEmbeddingProvider(config ?? {});
    }
    return new LocalHashEmbeddingProvider(config);
}
/**
 * Cohere embed-v3 embedding provider.
 *
 * Cohere's `embed-english-v3.0` (and its multilingual sibling) is a
 * strong default for English retrieval. The provider hits
 * `https://api.cohere.ai/v1/embed` and returns a normalized vector.
 */
export class CohereEmbeddingProvider {
    id = "cohere";
    model;
    dimensions;
    apiKey;
    baseUrl;
    inputType;
    constructor(options = {}) {
        if (!options.apiKey) {
            throw new Error("CohereEmbeddingProvider requires an `apiKey`.");
        }
        this.apiKey = options.apiKey;
        this.model = options.model ?? "embed-english-v3.0";
        this.dimensions = options.dimensions ?? 1024;
        this.baseUrl = stripTrailingSlashes(options.baseUrl ?? "https://api.cohere.ai/v1");
        // `search_document` is the right value for indexing; callers that
        // need query-side embeddings can construct a separate provider
        // instance with input_type=`search_query`.
        this.inputType = options.inputType ?? "search_document";
    }
    async embed(text) {
        return this.callEmbed([text]).then((v) => v[0]);
    }
    async batchEmbed(texts) {
        return this.callEmbed(texts);
    }
    async callEmbed(texts) {
        const response = await fetch(`${this.baseUrl}/embed`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                texts,
                input_type: this.inputType,
            }),
        });
        if (!response.ok) {
            throw new Error(`Cohere embedding request failed: ${response.status} ${response.statusText}`);
        }
        const payload = (await response.json());
        if (!Array.isArray(payload.embeddings)) {
            throw new Error("Cohere embedding response missing `embeddings` array.");
        }
        if (payload.embeddings.length !== texts.length) {
            throw new Error(`Cohere embedding response length mismatch: got ${payload.embeddings.length}, expected ${texts.length}.`);
        }
        return payload.embeddings.map((v) => normalizeVector(v));
    }
}
/**
 * In-process FastEmbed-style embedding provider.
 *
 * Tries to load `@xenova/transformers` at runtime. If the package is
 * installed (the recommended path for real semantic quality), the
 * provider uses the BAAI/bge-small-en-v1.5 model and runs entirely
 * in-process — no network, no API key, ideal for air-gapped setups.
 *
 * If the package is not installed, falls back to a deterministic
 * feature-hash embedding so the rest of the SDK still works for
 * tests, CI, and offline development. The vector shape and L2 norm
 * are identical between the two modes, so swapping in the real
 * FastEmbed later is a no-op for downstream code.
 */
/**
 * Warn-once flag for the FastEmbed local-hash fallback. The fallback keeps
 * the SDK working with zero extra installs, but users deserve to know
 * their "semantic" search is degraded — and exactly how to fix it.
 */
let warnedEmbeddingFallback = false;
export class FastEmbedEmbeddingProvider {
    id = "fastembed";
    model;
    dimensions;
    pipeline = null;
    resolved = false;
    /**
     * Set when the transformers pipeline could NOT be loaded and the
     * deterministic local hash fallback is serving embeddings instead.
     * Null while unresolved or when the real model loaded fine. Exposed
     * via `getRuntimeInfo()` so benchmarks can detect — and optionally
     * refuse to run on — the fallback.
     */
    fallbackReason = null;
    constructor(options = {}) {
        this.model = options.model ?? "BAAI/bge-small-en-v1.5";
        this.dimensions = options.dimensions ?? 384;
    }
    /**
     * Runtime resolution metadata. `fallbackActive` is only meaningful after
     * the first `embed()` call (or an explicit probe) has triggered
     * `resolve()`; before that it reports `false` with a null reason, which
     * callers should read as "not yet known" rather than "no fallback".
     */
    getRuntimeInfo() {
        return {
            requestedProvider: "fastembed",
            resolvedProvider: this.fallbackReason
                ? "local-hash-fallback"
                : "fastembed",
            requestedModel: this.model,
            resolvedModel: this.fallbackReason
                ? `local-hash-fallback-${this.dimensions}`
                : this.model,
            modelRevision: null,
            requestedDimensions: this.dimensions,
            observedDimensions: this.lastObservedDimensions,
            fallbackActive: this.fallbackReason !== null,
            fallbackReason: this.fallbackReason,
        };
    }
    /** Dimensions seen on the most recent embed/batchEmbed result. */
    lastObservedDimensions = null;
    /**
     * Lazily resolve the transformers pipeline. We use a dynamic import so
     * the optional dep is only paid for when (and if) the user installs it.
     * Any failure to load silently falls back to the local hash.
     *
     * Tries `@huggingface/transformers` (the maintained successor) first,
     * then falls back to the abandoned `@xenova/transformers` for users who
     * still have it installed.
     */
    async resolve() {
        if (this.resolved)
            return;
        this.resolved = true;
        try {
            // Both packages are optional peer deps — users opt in by installing
            // one of them. We use dynamic imports so they're only paid for when
            // installed. Types are declared in `src/xenova-transformers.d.ts`.
            const mod = (await import("@huggingface/transformers").catch(() => null));
            const legacyMod = mod
                ? null
                : (await import("@xenova/transformers").catch(() => null));
            const resolved = mod ?? legacyMod;
            if (!resolved) {
                // Neither optional peer dep is installed — record WHY so
                // `getRuntimeInfo()` can report the fallback, then fall through
                // to the local hash. (The early return here previously skipped
                // the missing-package reason entirely — the silent-fallback bug.)
                this.fallbackReason =
                    "neither @huggingface/transformers nor @xenova/transformers is installed";
                this.warnFallbackOnce();
                return;
            }
            const pipeline = await resolved.pipeline("feature-extraction", this.model);
            // @huggingface/transformers v3+/v4 pipelines are callable directly;
            // older shapes exposed `.feature`. Normalize both behind one function.
            this.pipeline =
                typeof pipeline === "function"
                    ? pipeline
                    : (pipeline
                        .feature ?? null);
            if (!this.pipeline) {
                this.fallbackReason = `pipeline for model "${this.model}" exposed no callable feature-extraction interface`;
                this.warnFallbackOnce();
            }
        }
        catch (err) {
            // Record the failure for runtime info, then fall through to the
            // local hash. The SDK keeps its resilient default behavior — but
            // benchmarks can now SEE the fallback instead of silently scoring it.
            this.fallbackReason = `pipeline construction failed for model "${this.model}": ${String(err).substring(0, 200)}`;
            this.warnFallbackOnce();
        }
    }
    /**
     * One-time loud warning when the local-hash fallback activates. Silent
     * degradation is the worst plug-in experience: everything "works" but
     * semantic search quietly returns garbage.
     */
    warnFallbackOnce() {
        if (warnedEmbeddingFallback)
            return;
        warnedEmbeddingFallback = true;
        console.warn(`[memos] embedding fallback: ${this.fallbackReason}. ` +
            "Semantic search is degraded to a deterministic local hash. " +
            "For real embeddings: pnpm add @huggingface/transformers");
    }
    async embed(text) {
        await this.resolve();
        if (this.pipeline) {
            const out = await this.pipeline(text, {
                pooling: "mean",
                normalize: true,
            });
            this.lastObservedDimensions = out.data.length;
            return Array.from(out.data);
        }
        return this.fallbackEmbed(text);
    }
    async batchEmbed(texts) {
        await this.resolve();
        if (this.pipeline) {
            // The transformers pipeline runs array input as one batched ONNX
            // session — far cheaper than one session run per text. Batched output
            // is a single Tensor with dims [batch, hidden]; slice it per row.
            // Chunked to bound peak memory on large backfills.
            const CHUNK_SIZE = 32;
            const vectors = [];
            for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
                const chunk = texts.slice(i, i + CHUNK_SIZE);
                const out = await this.pipeline(chunk, {
                    pooling: "mean",
                    normalize: true,
                });
                const hidden = out.dims[out.dims.length - 1];
                this.lastObservedDimensions = hidden;
                for (let r = 0; r < chunk.length; r += 1) {
                    vectors.push(Array.from(out.data.slice(r * hidden, (r + 1) * hidden)));
                }
            }
            return vectors;
        }
        return texts.map((t) => this.fallbackEmbed(t));
    }
    /**
     * Deterministic feature-hash fallback. Produces a `dimensions`-long
     * vector with the same shape (and L2 norm) as a real
     * sentence-transformer embedding, so storage and ranking code is
     * identical to the online path.
     */
    fallbackEmbed(text) {
        this.lastObservedDimensions = this.dimensions;
        const vector = Array.from({ length: this.dimensions }, () => 0);
        const tokens = text
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .split(/[^a-z0-9]+/)
            .filter((t) => t.length > 1);
        const unique = [...new Set(tokens)];
        for (const token of unique) {
            addFeature(vector, `tok:${token}`, 1);
            for (let length = 3; length <= Math.min(token.length, 5); length += 1) {
                for (let i = 0; i <= token.length - length; i += 1) {
                    addFeature(vector, `ng:${token.slice(i, i + length)}`, 0.12);
                }
            }
        }
        for (let i = 0; i < tokens.length - 1; i += 1) {
            addFeature(vector, `bi:${tokens[i]}:${tokens[i + 1]}`, 0.35);
        }
        return normalizeVector(vector);
    }
}
//# sourceMappingURL=embeddings.js.map