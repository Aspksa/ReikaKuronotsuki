/**
 * MemOS Anthropic Adapter — first-class memory integration for the
 * Anthropic SDK (Claude).
 *
 * Wraps a MemOS instance and exposes helpers that map cleanly onto the
 * Anthropic Messages API: a memory-backed tool definition, system-prompt
 * context injection, automatic fact extraction from conversations, and
 * simple store/forget helpers.
 *
 * The adapter has **zero hard dependencies** on the `@anthropic-ai/sdk`
 * package. Every exported message/tool/content-block shape is structurally
 * compatible with the corresponding SDK types, so they can be passed
 * straight into `client.messages.create(...)` with no glue layer. Install
 * `@anthropic-ai/sdk` only if you want to call the model; the adapter
 * itself only needs MemOS.
 *
 * @example
 * ```ts
 * import Anthropic from "@anthropic-ai/sdk";
 * import { createAnthropicMemory } from "@mem-os/sdk/anthropic";
 *
 * const { plugin } = await createAnthropicMemory({ dbPath: "./my-app.db" });
 * const client = new Anthropic();
 *
 * const message = await client.messages.create({
 *   model: "claude-3-5-sonnet-20241022",
 *   max_tokens: 1024,
 *   system: "You are a helpful assistant.",
 *   messages: [{ role: "user", content: "What theme do I like?" }],
 *   tools: [plugin.memoryTool],
 * });
 * ```
 *
 * @module @memos/adapters/anthropic
 */
import { MemOS } from "../index.js";
// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------
/**
 * Anthropic SDK memory plugin backed by MemOS.
 *
 * Wrap an existing MemOS instance, or use {@link createAnthropicMemory} to
 * construct both in one call. The plugin does not call the Anthropic API
 * itself — it prepares memories (as tools, tool-result blocks, and
 * system-prompt strings) for you to feed into your own
 * `client.messages.create` calls.
 */
export class MemOSAnthropicPlugin {
    /** The wrapped MemOS instance. */
    memos;
    opts;
    /**
     * Create a new Anthropic memory plugin.
     *
     * @param memos - An initialised MemOS instance.
     * @param opts  - Plugin options. All fields optional with sensible defaults.
     */
    constructor(memos, opts = {}) {
        this.memos = memos;
        this.opts = {
            maxContextMemories: opts.maxContextMemories ?? 5,
            autoExtractFacts: opts.autoExtractFacts ?? true,
            minMessageLength: opts.minMessageLength ?? 15,
            source: opts.source ?? "user_input",
            minConfidence: opts.minConfidence ?? 0.6,
            namespace: opts.namespace ?? "default",
        };
    }
    /**
     * Anthropic tool definition that lets the model search the user's memory.
     * Pass it via the `tools` parameter of `client.messages.create`.
     *
     * When the model invokes it (a `tool_use` content block), call
     * {@link searchMemories} and return the `tool_result` block (built via
     * the result's `toToolResult(toolUseId)`) as a `user` message.
     */
    get memoryTool() {
        return {
            name: "search_memories",
            description: "Search the user's persistent MemOS memory for relevant facts, " +
                "preferences, and context. Call this before answering personal or " +
                "preference questions, or when prior context seems relevant.",
            input_schema: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "Natural-language search query.",
                    },
                    limit: {
                        type: "number",
                        description: "Maximum number of memories to return.",
                        default: 5,
                    },
                },
                required: ["query"],
            },
        };
    }
    /**
     * Extract facts from a conversation and store them in MemOS.
     *
     * Runs MemOS' local rule-based fact extractor over the conversation,
     * persisting any candidate facts whose confidence meets the configured
     * `minConfidence` threshold. Near-duplicates are skipped automatically
     * when embeddings are available.
     *
     * @param conversation - The messages to extract facts from.
     * @returns The extraction result (candidate facts, stored ids, dup count).
     */
    async addMessages(conversation) {
        const candidates = conversation.filter((m) => m.content.trim().length >= this.opts.minMessageLength);
        if (candidates.length === 0) {
            return { facts: [], storedIds: [], duplicates: 0 };
        }
        return this.memos.extractFacts(candidates, {
            autoStore: true,
            minConfidence: this.opts.minConfidence,
            namespace: this.opts.namespace,
            dedupe: true,
        });
    }
    /**
     * Search memories and format the results for Anthropic tool use.
     *
     * @param query - Natural-language search query.
     * @param opts  - Search options (limit, type, namespace).
     * @returns An object containing the ranked memory entries, a JSON string,
     *   and a `toToolResult(toolUseId)` factory that builds a `tool_result`
     *   content block ready to send back as a `user` message.
     */
    async searchMemories(query, opts = {}) {
        const filter = {
            query,
            limit: opts.limit ?? this.opts.maxContextMemories,
        };
        if (opts.type)
            filter.type = opts.type;
        if (opts.namespace)
            filter.namespace = opts.namespace;
        const results = await this.memos.search(filter);
        const memories = results.map((r) => this.toEntry(r));
        const content = memories.length > 0
            ? JSON.stringify(memories, null, 2)
            : "No relevant memories found.";
        return {
            query,
            memories,
            content,
            toToolResult: (toolUseId) => ({
                type: "tool_result",
                tool_use_id: toolUseId,
                content,
            }),
        };
    }
    /**
     * Build a system-prompt string of relevant memories for injection.
     *
     * Optionally extracts & stores facts from the recent `messages` first,
     * then searches MemOS using the most recent user message and returns the
     * matches as a formatted block ready to pass as the top-level `system`
     * parameter of `client.messages.create`.
     *
     * @param messages - Recent conversation messages.
     * @param opts     - Context options (limit, whether to extract).
     * @returns A memory-context string, or `""` if nothing relevant was found.
     */
    async getMemoryContext(messages, opts = {}) {
        const shouldExtract = opts.extract ?? this.opts.autoExtractFacts;
        if (shouldExtract && messages.length > 0) {
            await this.addMessages(messages);
        }
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const query = lastUser?.content.trim() ?? "";
        if (!query)
            return "";
        const results = await this.memos.search({
            query,
            limit: opts.limit ?? this.opts.maxContextMemories,
        });
        if (results.length === 0)
            return "";
        const lines = ["Relevant memories from prior conversations:"];
        results.forEach((m, i) => {
            lines.push(`  ${i + 1}. [${m.node.type}] ${m.node.content}`);
        });
        return lines.join("\n");
    }
    /**
     * Manually store a memory.
     *
     * @param content - Text to remember.
     * @param opts    - Additional memory parameters (type, tags, importance…).
     * @returns The created memory node.
     */
    async remember(content, opts = {}) {
        const { node } = await this.memos.store(content, {
            ...opts,
            source: opts.source ?? this.opts.source,
            namespace: opts.namespace ?? this.opts.namespace,
        });
        return node;
    }
    /**
     * Search for relevant memories.
     *
     * @param query - Search query.
     * @param limit - Maximum number of results. @default 5
     * @returns Scored memory nodes.
     */
    async recall(query, limit = 5) {
        return this.memos.search({ query, limit });
    }
    /**
     * Permanently forget a memory.
     *
     * @param memoryId - ID of the memory to delete.
     * @returns `true` if the memory existed and was deleted.
     */
    async forget(memoryId) {
        return this.memos.forget(memoryId);
    }
    /**
     * Remove all memories and edges from the underlying MemOS instance.
     *
     * This is destructive and cannot be undone.
     */
    async clearMemories() {
        await this.memos.clear();
    }
    /**
     * Return the total number of stored memories.
     *
     * @returns The current memory count.
     */
    getMemoryCount() {
        return this.memos.count;
    }
    /** Convert a scored memory into a JSON-friendly entry. */
    toEntry(scored) {
        return {
            id: scored.node.id,
            content: scored.node.content,
            summary: scored.node.summary,
            type: scored.node.type,
            score: scored.score,
            tags: scored.node.tags,
            trustScore: scored.node.trustScore,
        };
    }
}
// ---------------------------------------------------------------------------
// Convenience constructor
// ---------------------------------------------------------------------------
/**
 * Create a MemOS instance and an Anthropic memory plugin in one call.
 *
 * The MemOS instance is created with `config`, initialised, and wrapped in a
 * {@link MemOSAnthropicPlugin}. Plugin-level options go under `config.plugin`.
 *
 * @param config - MemOS config plus optional `plugin` options.
 * @returns The initialised `memos` instance and bound `plugin`.
 *
 * @example
 * ```ts
 * const { memos, plugin } = await createAnthropicMemory({
 *   dbPath: "./my-app.db",
 *   plugin: { maxContextMemories: 8 },
 * });
 * ```
 */
export async function createAnthropicMemory(config = {}) {
    const { plugin: pluginOpts, ...memosConfig } = config;
    const memos = new MemOS(memosConfig);
    await memos.init();
    const plugin = new MemOSAnthropicPlugin(memos, pluginOpts);
    return { memos, plugin };
}
// ---------------------------------------------------------------------------
// Usage example
// ---------------------------------------------------------------------------
/*
 * End-to-end example using the official `@anthropic-ai/sdk`.
 *
 *   npm install @anthropic-ai/sdk
 *
 * import Anthropic from "@anthropic-ai/sdk";
 * import { createAnthropicMemory } from "@mem-os/sdk/anthropic";
 *
 * // 1. Boot MemOS + the plugin.
 * const { memos, plugin } = await createAnthropicMemory({
 *   dbPath: "./my-app.db",
 *   plugin: { maxContextMemories: 6 },
 * });
 *
 * const client = new Anthropic();
 *
 * // 2. Teach it something. addMessages() extracts & stores facts.
 * await plugin.addMessages([
 *   { role: "user", content: "I prefer dark mode in all my apps." },
 *   { role: "assistant", content: "Got it — dark mode it is." },
 * ]);
 *
 * // 3a. Context-injection style: fold memories into the system prompt.
 * //     Anthropic takes `system` as a top-level param, not a message role.
 * const systemCtx = await plugin.getMemoryContext([
 *   { role: "user", content: "What theme do I like?" },
 * ]);
 * const a = await client.messages.create({
 *   model: "claude-3-5-sonnet-20241022",
 *   max_tokens: 1024,
 *   system: `You are a helpful assistant.\n\n${systemCtx}`,
 *   messages: [{ role: "user", content: "What theme do I like?" }],
 * });
 * console.log(a.content[0]); // → "dark mode"
 *
 * // 3b. Tool style: let the model call search_memories itself.
 * const tools = [plugin.memoryTool];
 * const res = await client.messages.create({
 *   model: "claude-3-5-sonnet-20241022",
 *   max_tokens: 1024,
 *   messages: [{ role: "user", content: "What theme do I like?" }],
 *   tools,
 * });
 * const toolUse = res.content.find((b) => b.type === "tool_use");
 * if (toolUse && toolUse.name === "search_memories") {
 *   const { query } = toolUse.input as { query: string };
 *   const { toToolResult } = await plugin.searchMemories(query);
 *   const followUp = await client.messages.create({
 *     model: "claude-3-5-sonnet-20241022",
 *     max_tokens: 1024,
 *     messages: [
 *       { role: "user", content: "What theme do I like?" },
 *       { role: "assistant", content: res.content },
 *       { role: "user", content: [toToolResult(toolUse.id)] },
 *     ],
 *     tools,
 *   });
 *   console.log(followUp.content[0]); // → "dark mode"
 * }
 *
 * // 4. Housekeeping helpers.
 * console.log(plugin.getMemoryCount()); // number of stored memories
 * await plugin.clearMemories();         // wipe everything
 */
//# sourceMappingURL=anthropic.js.map