/**
 * MCP server for MemOS — Model Context Protocol 2026-07-28.
 *
 * Built on the official `@modelcontextprotocol/server` v2 SDK, which
 * implements the 2026-07-28 spec (stateless core, `server/discover`,
 * per-request `_meta` envelope, `ttlMs`/`cacheScope` on list results,
 * `outputSchema` on tools). The SDK's `serveStdio` entry is dual-era:
 * it speaks the modern 2026-07-28 protocol AND falls back to the legacy
 * 2025-era `initialize` handshake for older clients.
 *
 * Transport: stdio only (the shipped transport). HTTP/SSE is deferred.
 */
import { McpServer } from "@modelcontextprotocol/server";
import { MemOS } from "./memory.js";
import type { MemOSConfig } from "./types.js";
export interface McpToolAnnotations {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
}
/**
 * Per-tool annotations, keyed by tool name. Shared by the live server
 * registration (the wire path) and the static TOOL_METADATA below so the
 * two can never disagree.
 */
export declare const TOOL_ANNOTATIONS: Record<string, McpToolAnnotations>;
/**
 * Create a fully-configured McpServer instance for MemOS.
 * Exported for testing and advanced use cases.
 */
export declare function createMcpServer(memos: MemOS): McpServer;
/**
 * Run the MemOS MCP server over stdio.
 *
 * Speaks MCP protocol revision 2026-07-28 (modern stateless core with
 * `server/discover`) and falls back to the legacy 2025-era `initialize`
 * handshake for older clients. Blocks until the connection closes.
 */
export declare function runMcpServer(config?: MemOSConfig): Promise<void>;
export interface McpToolInfo {
    name: string;
    description: string;
    annotations: McpToolAnnotations;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
}
/**
 * Return static metadata about the MCP tools exposed by MemOS.
 * Useful for programmatic consumers and tests that need tool definitions
 * without spinning up a live server connection.
 *
 * Kept in the SAME ORDER as the live `registerTools` registrations —
 * the annotations test asserts the two surfaces match exactly, so a
 * reorder here must be mirrored there.
 */
export declare function getMcpTools(): readonly McpToolInfo[];
//# sourceMappingURL=mcp.d.ts.map