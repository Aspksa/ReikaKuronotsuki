/**
 * MemOS OpenAI Adapter — first-class memory integration for the OpenAI SDK.
 *
 * Wraps a MemOS instance and exposes helpers that map cleanly onto the
 * OpenAI Chat Completions API: a memory-backed function tool, system-prompt
 * context injection, automatic fact extraction from conversations, and
 * simple store/forget helpers.
 *
 * The adapter has **zero hard dependencies** on the `openai` package. Every
 * exported message/tool shape is structurally compatible with the
 * corresponding `openai` types (`ChatCompletionMessageParam`,
 * `ChatCompletionTool`, `ChatCompletionToolMessageParam`), so they can be
 * passed straight into `openai.chat.completions.create(...)` with no glue
 * layer. Install `openai` only if you want to call the model; the adapter
 * itself only needs MemOS.
 *
 * @example
 * ```ts
 * import OpenAI from "openai";
 * import { createOpenAIMemory } from "@mem-os/sdk/openai";
 *
 * const { plugin } = await createOpenAIMemory({ dbPath: "./my-app.db" });
 * const openai = new OpenAI();
 *
 * const completion = await openai.chat.completions.create({
 *   model: "gpt-4o",
 *   messages: [{ role: "user", content: "What theme do I like?" }],
 *   tools: [plugin.memoryTool],
 * });
 * ```
 *
 * @module @memos/adapters/openai
 */
import { MemOS } from "../index.js";
import type { ConversationMessage, CreateMemoryInput, ExtractFactsResult, MemoryNode, MemorySource, MemoryType, MemOSConfig, ScoredMemory } from "../index.js";
/** Chat message role, compatible with the OpenAI Chat Completions API. */
export type OpenAIRole = "system" | "user" | "assistant" | "tool";
/**
 * Minimal OpenAI-compatible chat message.
 *
 * Structurally compatible with `openai.ChatCompletionMessageParam` for the
 * plain-text cases this adapter produces and consumes.
 */
export interface OpenAIChatMessage {
    role: OpenAIRole;
    content: string;
    name?: string;
    tool_call_id?: string;
}
/**
 * A `tool`-role message returned to the model after a tool call.
 * Compatible with `openai.ChatCompletionToolMessageParam`.
 *
 * Note: `tool_call_id` is left optional here; set it to the id of the
 * `tool_call` you are responding to before sending.
 */
export interface OpenAIToolMessage {
    role: "tool";
    content: string;
    tool_call_id?: string;
}
/**
 * A function-tool definition registrable via the `tools` parameter of
 * `openai.chat.completions.create`. Compatible with
 * `openai.ChatCompletionTool`.
 */
export interface OpenAIToolDefinition {
    type: "function";
    function: {
        name: string;
        description: string;
        /** A JSON Schema object describing the function parameters. */
        parameters: Record<string, unknown>;
    };
}
/**
 * A single memory rendered as a plain JSON object, suitable for returning
 * as a tool result.
 */
export interface OpenAIMemoryEntry {
    id: string;
    content: string;
    summary: string;
    type: MemoryType;
    /** Relevance score from the search. */
    score: number;
    tags: string[];
    trustScore: number;
}
/** Options for {@link MemOSOpenAIPlugin.searchMemories}. */
export interface OpenAISearchMemoriesOptions {
    /** Maximum number of memories to return. @default 5 */
    limit?: number;
    /** Restrict results to a memory type. */
    type?: MemoryType;
    /** Restrict results to a namespace. */
    namespace?: string;
}
/** Options for {@link MemOSOpenAIPlugin.getMemoryContext}. */
export interface OpenAIGetMemoryContextOptions {
    /** Maximum memories to inject. @default 5 */
    limit?: number;
    /** Whether to extract & store facts from `messages` first. @default true */
    extract?: boolean;
}
/** Result returned by {@link MemOSOpenAIPlugin.searchMemories}. */
export interface OpenAIMemorySearchResult {
    /** The query that was searched. */
    query: string;
    /** Ranked memory entries. */
    memories: OpenAIMemoryEntry[];
    /** A ready-to-send `tool` message containing the JSON-encoded memories. */
    toolMessage: OpenAIToolMessage;
}
/** Options for {@link MemOSOpenAIPlugin}. */
export interface MemOSOpenAIPluginOptions {
    /** Maximum memories to inject into context / return from a search. @default 5 */
    maxContextMemories?: number;
    /**
     * Automatically extract & store facts when `addMessages` or
     * `getMemoryContext` are called. @default true
     */
    autoExtractFacts?: boolean;
    /** Minimum message length (chars) to consider for fact extraction. @default 15 */
    minMessageLength?: number;
    /** Provenance source tag for memories created by this adapter. @default "user_input" */
    source?: MemorySource;
    /** Minimum confidence for an extracted fact to be stored. @default 0.6 */
    minConfidence?: number;
    /** Namespace to store/search memories in (experimental). @default "default" */
    namespace?: string;
}
/** Configuration for {@link createOpenAIMemory}. */
export interface OpenAIMemoryConfig extends MemOSConfig {
    /** Plugin-level options. */
    plugin?: MemOSOpenAIPluginOptions;
}
/** Result of {@link createOpenAIMemory}. */
export interface CreateOpenAIMemoryResult {
    /** The initialised MemOS instance. */
    memos: MemOS;
    /** The OpenAI memory plugin bound to that instance. */
    plugin: MemOSOpenAIPlugin;
}
/**
 * OpenAI SDK memory plugin backed by MemOS.
 *
 * Wrap an existing MemOS instance, or use {@link createOpenAIMemory} to
 * construct both in one call. The plugin does not call the OpenAI API
 * itself — it prepares memories (as tools, tool messages, and system-prompt
 * strings) for you to feed into your own `openai.chat.completions` calls.
 */
export declare class MemOSOpenAIPlugin {
    /** The wrapped MemOS instance. */
    readonly memos: MemOS;
    private readonly opts;
    /**
     * Create a new OpenAI memory plugin.
     *
     * @param memos - An initialised MemOS instance.
     * @param opts  - Plugin options. All fields optional with sensible defaults.
     */
    constructor(memos: MemOS, opts?: MemOSOpenAIPluginOptions);
    /**
     * OpenAI function-tool definition that lets the model search the user's
     * memory. Pass it via the `tools` parameter of
     * `openai.chat.completions.create`.
     *
     * When the model invokes it, call {@link searchMemories} and return the
     * `toolMessage` field (after setting `tool_call_id`) as a tool message.
     */
    get memoryTool(): OpenAIToolDefinition;
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
    addMessages(conversation: ConversationMessage[]): Promise<ExtractFactsResult>;
    /**
     * Search memories and format the results for OpenAI tool use.
     *
     * @param query - Natural-language search query.
     * @param opts  - Search options (limit, type, namespace).
     * @returns An object containing the ranked memory entries and a
     *   ready-to-send `tool` message (JSON-encoded memories). Set
     *   `toolMessage.tool_call_id` to the model's `tool_call` id before
     *   returning it.
     */
    searchMemories(query: string, opts?: OpenAISearchMemoriesOptions): Promise<OpenAIMemorySearchResult>;
    /**
     * Build a system-prompt string of relevant memories for injection.
     *
     * Optionally extracts & stores facts from the recent `messages` first,
     * then searches MemOS using the most recent user message and returns the
     * matches as a formatted block ready to prepend to the `system` prompt.
     *
     * @param messages - Recent conversation messages.
     * @param opts     - Context options (limit, whether to extract).
     * @returns A memory-context string, or `""` if nothing relevant was found.
     */
    getMemoryContext(messages: ConversationMessage[], opts?: OpenAIGetMemoryContextOptions): Promise<string>;
    /**
     * Manually store a memory.
     *
     * @param content - Text to remember.
     * @param opts    - Additional memory parameters (type, tags, importance…).
     * @returns The created memory node.
     */
    remember(content: string, opts?: Omit<CreateMemoryInput, "content">): Promise<MemoryNode>;
    /**
     * Search for relevant memories.
     *
     * @param query - Search query.
     * @param limit - Maximum number of results. @default 5
     * @returns Scored memory nodes.
     */
    recall(query: string, limit?: number): Promise<ScoredMemory[]>;
    /**
     * Permanently forget a memory.
     *
     * @param memoryId - ID of the memory to delete.
     * @returns `true` if the memory existed and was deleted.
     */
    forget(memoryId: string): Promise<boolean>;
    /**
     * Remove all memories and edges from the underlying MemOS instance.
     *
     * This is destructive and cannot be undone.
     */
    clearMemories(): Promise<void>;
    /**
     * Return the total number of stored memories.
     *
     * @returns The current memory count.
     */
    getMemoryCount(): number;
    /** Convert a scored memory into a JSON-friendly entry. */
    private toEntry;
}
/**
 * Create a MemOS instance and an OpenAI memory plugin in one call.
 *
 * The MemOS instance is created with `config`, initialised, and wrapped in a
 * {@link MemOSOpenAIPlugin}. Plugin-level options go under `config.plugin`.
 *
 * @param config - MemOS config plus optional `plugin` options.
 * @returns The initialised `memos` instance and bound `plugin`.
 *
 * @example
 * ```ts
 * const { memos, plugin } = await createOpenAIMemory({
 *   dbPath: "./my-app.db",
 *   plugin: { maxContextMemories: 8 },
 * });
 * ```
 */
export declare function createOpenAIMemory(config?: OpenAIMemoryConfig): Promise<CreateOpenAIMemoryResult>;
//# sourceMappingURL=openai.d.ts.map