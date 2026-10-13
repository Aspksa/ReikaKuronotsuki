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
import type { ConversationMessage, CreateMemoryInput, ExtractFactsResult, MemoryNode, MemorySource, MemoryType, MemOSConfig, ScoredMemory } from "../index.js";
/**
 * A text content block. Anthropic messages carry `content` as either a
 * plain string or an array of typed blocks.
 */
export interface AnthropicTextBlock {
    type: "text";
    text: string;
}
/**
 * A `tool_result` block returned to the model after it issues a `tool_use`.
 * Compatible with the Anthropic SDK's `ToolResultBlockParam`.
 */
export interface AnthropicToolResultBlock {
    type: "tool_result";
    /** The id of the `tool_use` block this result responds to. */
    tool_use_id: string;
    content: string;
}
/** Union of content blocks this adapter produces. */
export type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolResultBlock;
/**
 * Minimal Anthropic-compatible message.
 *
 * Structurally compatible with `@anthropic-ai/sdk`'s `MessageParam` for the
 * plain-text cases this adapter produces and consumes. Note the Anthropic
 * API has no `system` role inside `messages` — system context is passed as
 * a separate top-level `system` parameter (see {@link getMemoryContext}).
 */
export interface AnthropicMessage {
    role: "user" | "assistant";
    content: string | AnthropicContentBlock[];
}
/**
 * A tool definition registrable via the `tools` parameter of
 * `client.messages.create`. Compatible with the Anthropic SDK's `Tool`.
 * Anthropic uses `input_schema` (a JSON Schema) rather than OpenAI's
 * nested `function.parameters`.
 */
export interface AnthropicToolDefinition {
    name: string;
    description: string;
    /** A JSON Schema object describing the tool input. */
    input_schema: Record<string, unknown>;
}
/**
 * A single memory rendered as a plain JSON object, suitable for returning
 * as a tool result.
 */
export interface AnthropicMemoryEntry {
    id: string;
    content: string;
    summary: string;
    type: MemoryType;
    /** Relevance score from the search. */
    score: number;
    tags: string[];
    trustScore: number;
}
/** Options for {@link MemOSAnthropicPlugin.searchMemories}. */
export interface AnthropicSearchMemoriesOptions {
    /** Maximum number of memories to return. @default 5 */
    limit?: number;
    /** Restrict results to a memory type. */
    type?: MemoryType;
    /** Restrict results to a namespace. */
    namespace?: string;
}
/** Options for {@link MemOSAnthropicPlugin.getMemoryContext}. */
export interface AnthropicGetMemoryContextOptions {
    /** Maximum memories to inject. @default 5 */
    limit?: number;
    /** Whether to extract & store facts from `messages` first. @default true */
    extract?: boolean;
}
/** Result returned by {@link MemOSAnthropicPlugin.searchMemories}. */
export interface AnthropicMemorySearchResult {
    /** The query that was searched. */
    query: string;
    /** Ranked memory entries. */
    memories: AnthropicMemoryEntry[];
    /** The JSON-encoded memories as a plain string. */
    content: string;
    /**
     * Build a `tool_result` content block for this search, ready to send back
     * as a `user` message. Pass the `tool_use_id` from the model's tool call.
     *
     * @param toolUseId - The `id` of the model's `tool_use` block.
     * @returns A `tool_result` content block.
     */
    toToolResult: (toolUseId: string) => AnthropicToolResultBlock;
}
/** Options for {@link MemOSAnthropicPlugin}. */
export interface MemOSAnthropicPluginOptions {
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
/** Configuration for {@link createAnthropicMemory}. */
export interface AnthropicMemoryConfig extends MemOSConfig {
    /** Plugin-level options. */
    plugin?: MemOSAnthropicPluginOptions;
}
/** Result of {@link createAnthropicMemory}. */
export interface CreateAnthropicMemoryResult {
    /** The initialised MemOS instance. */
    memos: MemOS;
    /** The Anthropic memory plugin bound to that instance. */
    plugin: MemOSAnthropicPlugin;
}
/**
 * Anthropic SDK memory plugin backed by MemOS.
 *
 * Wrap an existing MemOS instance, or use {@link createAnthropicMemory} to
 * construct both in one call. The plugin does not call the Anthropic API
 * itself — it prepares memories (as tools, tool-result blocks, and
 * system-prompt strings) for you to feed into your own
 * `client.messages.create` calls.
 */
export declare class MemOSAnthropicPlugin {
    /** The wrapped MemOS instance. */
    readonly memos: MemOS;
    private readonly opts;
    /**
     * Create a new Anthropic memory plugin.
     *
     * @param memos - An initialised MemOS instance.
     * @param opts  - Plugin options. All fields optional with sensible defaults.
     */
    constructor(memos: MemOS, opts?: MemOSAnthropicPluginOptions);
    /**
     * Anthropic tool definition that lets the model search the user's memory.
     * Pass it via the `tools` parameter of `client.messages.create`.
     *
     * When the model invokes it (a `tool_use` content block), call
     * {@link searchMemories} and return the `tool_result` block (built via
     * the result's `toToolResult(toolUseId)`) as a `user` message.
     */
    get memoryTool(): AnthropicToolDefinition;
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
     * Search memories and format the results for Anthropic tool use.
     *
     * @param query - Natural-language search query.
     * @param opts  - Search options (limit, type, namespace).
     * @returns An object containing the ranked memory entries, a JSON string,
     *   and a `toToolResult(toolUseId)` factory that builds a `tool_result`
     *   content block ready to send back as a `user` message.
     */
    searchMemories(query: string, opts?: AnthropicSearchMemoriesOptions): Promise<AnthropicMemorySearchResult>;
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
    getMemoryContext(messages: ConversationMessage[], opts?: AnthropicGetMemoryContextOptions): Promise<string>;
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
export declare function createAnthropicMemory(config?: AnthropicMemoryConfig): Promise<CreateAnthropicMemoryResult>;
//# sourceMappingURL=anthropic.d.ts.map