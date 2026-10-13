/**
 * Render a memory graph snapshot as a Mermaid flowchart.
 *
 * Shared by the CLI (`memos graph --mermaid`) and the MCP server
 * (`memos://graph` resource) so both emit identical, GitHub-renderable
 * diagrams. Node labels are sanitized for Mermaid's `["..."]` syntax and
 * ids are rewritten to guaranteed-valid, collision-free identifiers.
 *
 * @module @mem-os/graph-mermaid
 */
import type { GraphSnapshot } from "./types.js";
export declare function graphToMermaid(graph: GraphSnapshot): string;
//# sourceMappingURL=graph-mermaid.d.ts.map