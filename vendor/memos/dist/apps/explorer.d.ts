/**
 * MCP Apps memory explorer — an interactive graph UI served as a `ui://`
 * resource (MCP Apps, ratified Jan 2026).
 *
 * The explorer renders the MemOS entity/memory graph as a self-contained,
 * CSP-locked HTML payload: no external network fetches, no CDN scripts —
 * the SVG renderer, pan/zoom, and filters are all hand-rolled in the
 * payload. The bitemporal "as-of" scrubber re-queries the graph at any past
 * timestamp through the host: each scrub position sends a structured `read`
 * request over the `postMessage` bridge, the host performs a server-side
 * `resources/read` at that timestamp (the existing as-of read path), and the
 * app swaps in the returned snapshot. Nodes are colored by provenance
 * tier, edges labeled by relation type.
 *
 * Consent model (the important part): the app itself is UNPRIVILEGED. It
 * cannot touch the database. Mutating actions (forget, link, release from
 * quarantine) are expressed as structured *intents* posted to the host via
 * `postMessage`; the host translates each intent into a normal MCP
 * `tools/call` (see {@link intentToToolCall}) so the HOST's consent UI
 * applies exactly as if the agent had called the tool itself. Read-path
 * interactions (pan/zoom/filter/scrub) need no consent.
 *
 * Where the host has no MCP Apps support the same resource serves a
 * text/markdown fallback (mermaid diagram + summary) instead of the HTML
 * app — see {@link resolveExplorerMode}.
 *
 * Everything here is deterministic and LLM-free.
 *
 * @module @mem-os/apps-explorer
 */
import { UriTemplate, type Variables } from "@modelcontextprotocol/server";
import type { GraphSnapshot, MemoryEdge, MemoryNode, ProvenanceTier } from "../types.js";
/** Canonical resource URI for the explorer app. */
export declare const EXPLORER_APP_URI = "ui://memos/explorer";
/**
 * URI template registered on the MCP server. Query variables:
 * - `asOf`      — unix ms; render the graph as of a past timestamp
 *                 (bitemporal time-travel) instead of live.
 * - `mode`      — `app` forces the HTML app, `text` forces the markdown
 *                 fallback. Unset: auto-detect from the host signal,
 *                 defaulting to the safe `text` fallback.
 * - `nodeLimit` — override the node cap (clamped to 1..1000).
 * - `edgeLimit` — override the edge cap (clamped to 1..2000).
 */
export declare const EXPLORER_URI_TEMPLATE = "ui://memos/explorer{?asOf,mode,nodeLimit,edgeLimit}";
/**
 * URI template for the explorer resource with correct optional-query
 * matching.
 *
 * The SDK's built-in `UriTemplate.match()` compiles `{?a,b,...}` into a
 * regex that requires *every* variable to be present, in declaration order —
 * so `ui://memos/explorer?mode=app` would never match
 * `ui://memos/explorer{?asOf,mode,nodeLimit,edgeLimit}`. This subclass keeps
 * the standard template string (so `resources/templates/list` advertises the
 * documented template) but overrides matching: the path must be exactly
 * `ui://memos/explorer`, and any subset of the documented query parameters
 * may be present, in any order. Unknown query parameters are ignored.
 */
export declare class ExplorerUriTemplate extends UriTemplate {
    constructor();
    match(uri: string): Variables | null;
}
/** Default cap on nodes embedded in one payload (keeps it small). */
export declare const EXPLORER_NODE_CAP = 150;
/** Default cap on edges embedded in one payload. */
export declare const EXPLORER_EDGE_CAP = 400;
/** Hard ceiling for client-overridden caps. */
export declare const EXPLORER_NODE_CAP_MAX = 1000;
export declare const EXPLORER_EDGE_CAP_MAX = 2000;
/** Characters of node content embedded per node. */
export declare const EXPLORER_CONTENT_CHARS = 280;
/**
 * postMessage protocol identifier. The app posts
 * `{ protocol: "memos-explorer/1", kind: "intent", intent, params, requestId }`
 * to `window.parent`; hosts translate intents via {@link intentToToolCall}
 * and reply with `{ protocol: "memos-explorer/1", kind: "intent-result", ... }`.
 *
 * Read-path time travel uses a second message pair so scrubbing the as-of
 * slider re-queries the server instead of filtering the embedded snapshot
 * client-side: the app posts
 * `{ protocol: "memos-explorer/1", kind: "read", requestId, asOf: number|null }`
 * (`asOf: null` = live graph) and the host performs an MCP `resources/read`
 * of `ui://memos/explorer?mode=app` (plus `&asOf=<ms>` when set) and replies
 * with `{ protocol: "memos-explorer/1", kind: "snapshot", requestId, ok, html?, error? }`
 * where `html` is the raw resource text — the app extracts the new snapshot
 * from its `<script id="memos-snapshot">` tag and re-renders. Reads need no
 * consent. If the host never answers (no bridge support) the app falls back
 * to filtering its embedded snapshot locally.
 */
export declare const EXPLORER_PROTOCOL = "memos-explorer/1";
/** Node fill color per provenance tier (highest trust → greenest). */
export declare const PROVENANCE_TIER_COLORS: Record<ProvenanceTier, string>;
/** Edge stroke color per relation type. */
export declare const EDGE_RELATION_COLORS: Record<string, string>;
/** Intents the app may emit (all go through host consent). */
export declare const SUPPORTED_INTENTS: readonly ["forget", "link", "release-quarantine"];
export type ExplorerIntentName = (typeof SUPPORTED_INTENTS)[number];
/** Compact, JSON-safe node projection embedded in the app payload. */
export interface ExplorerNode {
    id: string;
    content: string;
    contentTruncated: boolean;
    type: string;
    importance: number;
    trustScore: number;
    /** Provenance tier string; "unknown" when the row predates the column. */
    provenance: string;
    quarantined: boolean;
    quarantineReason: string | null;
    validFrom: number | null;
    validTo: number | null;
    createdAt: number;
    /** Citable `[mem:hex]` token for this memory. */
    citation: string;
}
/** Compact, JSON-safe edge projection embedded in the app payload. */
export interface ExplorerEdge {
    id: string;
    sourceId: string;
    targetId: string;
    relation: string;
    weight: number;
    validFrom: number | null;
    validTo: number | null;
}
/** Everything the app needs, in one JSON blob. */
export interface ExplorerSnapshot {
    nodes: ExplorerNode[];
    edges: ExplorerEdge[];
    /** Pre-cap totals, so the UI can say "showing 150 of 1,204". */
    totalNodes: number;
    totalEdges: number;
    truncated: boolean;
    /** When the snapshot was generated (unix ms). */
    generatedAt: number;
    /** As-of timestamp when rendered for a past moment, else null (live). */
    asOf: number | null;
}
export interface SnapshotOptions {
    nodeCap?: number;
    edgeCap?: number;
    /** Pre-filter to this bitemporal timestamp (unix ms). */
    asOf?: number;
}
/**
 * Build the capped, JSON-safe snapshot the app embeds. Nodes are taken in
 * importance order (most important first); edges are kept only when both
 * endpoints survived the node cap, in weight order. Pass `asOf` to
 * pre-filter to a bitemporal timestamp (same predicates as the server
 * as-of read path).
 */
export declare function buildExplorerSnapshot(graph: GraphSnapshot, opts?: SnapshotOptions): ExplorerSnapshot;
/**
 * Node as-of predicate — identical to the SQLite as-of read path
 * (`valid_from <= t AND (valid_to IS NULL OR valid_to >= t)`).
 */
export declare function isNodeValidAt(node: Pick<MemoryNode, "validFrom" | "validTo"> | Pick<ExplorerNode, "validFrom" | "validTo">, atTime: number): boolean;
/**
 * Edge as-of predicate — identical to the SQLite edge as-of read path,
 * which uses strict `valid_to > t` (see `queryEdges({ validAt })`): an
 * edge closed in the same millisecond as the query is already historical.
 */
export declare function isEdgeValidAt(edge: Pick<MemoryEdge, "validFrom" | "validTo"> | Pick<ExplorerEdge, "validFrom" | "validTo">, atTime: number): boolean;
/**
 * The as-of scrubber's filter: re-evaluate a snapshot at a past timestamp.
 * This is the graceful-degradation path for the time slider — the same
 * predicates the server uses, applied client-side to the embedded
 * snapshot — used only when the host does not implement the `read` bridge
 * (see {@link EXPLORER_PROTOCOL}). With a supporting host, every scrub
 * position re-queries the server via `resources/read?asOf=` instead.
 */
export declare function filterSnapshotAsOf(snapshot: ExplorerSnapshot, atTime: number): ExplorerSnapshot;
export type ExplorerMode = "app" | "text";
/**
 * Probe a `resources/read` request `_meta` for host MCP Apps support.
 * Returns true/false on an explicit signal, null when the host says
 * nothing (the common case for older clients).
 */
export declare function probeHostAppsSupport(meta: unknown): boolean | null;
export interface ResolveModeOptions {
    /** Raw `mode` URI-template variable (`app` | `text`), if given. */
    modeParam?: string | null;
    /** The `resources/read` request `_meta` (host signal probe). */
    meta?: unknown;
}
/**
 * Decide whether to serve the HTML app or the markdown fallback.
 *
 * 1. An explicit `?mode=app|text` always wins.
 * 2. Otherwise an explicit host Apps signal in `_meta` wins.
 * 3. Otherwise fail closed to the `text` fallback: a host that cannot
 *    render the app must never receive a raw HTML blob it would dump as
 *    markup into the conversation.
 */
export declare function resolveExplorerMode(opts: ResolveModeOptions): ExplorerMode;
export interface IntentToolCall {
    /** MCP tool name — the host calls this via the standard tools/call path. */
    tool: string;
    args: Record<string, unknown>;
}
export type IntentTranslation = {
    ok: true;
    intent: ExplorerIntentName;
    call: IntentToolCall;
} | {
    ok: false;
    error: string;
};
/**
 * Translate a UI intent (posted by the app via `postMessage`) into the MCP
 * tool call the host must issue. Pure and zod-validated: unknown intents
 * and malformed params are rejected here, before any host consent UI.
 *
 * The host — never this module, never the app — performs the actual
 * `tools/call`, so the host's consent model applies to every mutation.
 * The app itself has no credentials and no database access.
 */
export declare function intentToToolCall(raw: unknown): IntentTranslation;
export interface FallbackOptions {
    asOf?: number | null;
}
/**
 * Build the graceful-degradation payload: the mermaid diagram (reusing
 * `graphToMermaid`, the same renderer as `memos://graph`) plus a summary.
 * Served when {@link resolveExplorerMode} picks `"text"`.
 */
export declare function buildExplorerFallbackMarkdown(snapshot: ExplorerSnapshot, opts?: FallbackOptions): string;
export interface HtmlOptions {
    asOf?: number | null;
}
/**
 * Build the single-file HTML app payload.
 *
 * Security properties (asserted by tests):
 * - `<meta http-equiv="Content-Security-Policy">` locks the document down:
 *   no network, no plugins, inline scripts/styles only.
 * - No external URLs anywhere in the payload (no CDNs, fonts, images).
 * - An HTML comment states the host-side requirement:
 *   `<iframe sandbox="allow-scripts">` (no `allow-same-origin`).
 * - The app is unprivileged: the only outbound channel is `postMessage`
 *   intents to the host; there is no database access from this layer.
 */
export declare function buildExplorerHtml(snapshot: ExplorerSnapshot, opts?: HtmlOptions): string;
//# sourceMappingURL=explorer.d.ts.map