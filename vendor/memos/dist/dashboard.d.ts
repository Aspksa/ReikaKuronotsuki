/**
 * Local dashboard — a browser UI for the MemOS memory store.
 *
 * `memos dashboard` starts a local HTTP server (no external dependencies)
 * serving a single-page dashboard for browsing, searching, and visualizing
 * the memory graph. No MCP Apps host required.
 *
 * API:
 *   GET /api/memories?limit=50&offset=0  — list memories
 *   GET /api/search?q=...&limit=20        — search memories
 *   GET /api/memory/:id                   — get one memory
 *   GET /api/graph                        — graph nodes + edges
 *   GET /api/stats                        — store statistics
 *
 * @module @memos/dashboard
 */
import type { MemOS } from "./memory.js";
export interface DashboardOptions {
    port?: number;
    open?: boolean;
}
/**
 * Start the local dashboard server.
 * Returns the server instance and the URL.
 */
export declare function startDashboard(memos: MemOS, opts?: DashboardOptions): Promise<{
    url: string;
    close: () => Promise<void>;
}>;
//# sourceMappingURL=dashboard.d.ts.map