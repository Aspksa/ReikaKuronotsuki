/**
 * Memory-grounded citations.
 *
 * Every memory injected into a context pack can carry a citable token
 * like `[mem:a3f9]`: short enough to quote in an agent's answer, stable
 * enough to trace back to the full source memory. `resolveCitation`
 * (on `MemOS`) turns a token back into the memory — its text,
 * timestamps, source, and tags — and `memos cite <id>` exposes the same
 * lookup on the CLI.
 *
 * Token scheme: `mem:` + the first 4 hex chars of the node id (dashes
 * stripped, lowercase). Four chars keeps citations cheap in the prompt;
 * when two pack items would collide, the pack renderer lengthens the
 * colliding tokens until they are unique *within the pack* (git-style).
 * Globally, `resolveCitation` prefix-matches the token against stored
 * ids and reports `ambiguous` with the candidate list instead of
 * guessing when a short token matches more than one memory.
 *
 * @module @mem-os/citations
 */
import type { MemoryNode } from "./types.js";
/** Minimum/maximum hex length accepted in a citation token. */
export declare const CITATION_MIN_HEX = 4;
export declare const CITATION_MAX_HEX = 32;
/**
 * The citable short id for a memory: first 4 hex chars of the node id
 * (dashes stripped, lowercase). Non-hex ids fall back to the first 4
 * characters as-is.
 */
export declare function shortCitationId(id: string): string;
/** Render the citation token for a memory id, e.g. `[mem:a3f9]`. */
export declare function citationToken(id: string): string;
/** Render a citation token with an explicit hex body (pack renderer). */
export declare function citationTokenForHex(hex: string): string;
/**
 * Normalize user input to a hex prefix: accepts `[mem:a3f9]`, bare
 * `a3f9`, a full dashed uuid, or a dashless id. Returns null when the
 * input carries no usable hex.
 */
export declare function parseCitationToken(input: string): string | null;
/** Outcome of tracing a citation token back to its source memory. */
export type CitationResolution = {
    status: "resolved";
    token: string;
    memory: MemoryNode;
} | {
    status: "not_found";
    token: string;
} | {
    status: "ambiguous";
    token: string;
    candidates: MemoryNode[];
};
/**
 * Assign citation tokens to pack items, unique within the pack.
 * Tokens start at 4 hex chars and lengthen (git-style) only for items
 * that would otherwise collide.
 */
export declare function assignCitationTokens(ids: string[]): Map<string, string>;
/**
 * Render a citation resolution exactly as the `memos cite` CLI prints
 * it (shared so tests assert on the real output bytes).
 */
export declare function formatCitationResolution(resolution: CitationResolution, asJson?: boolean): string;
//# sourceMappingURL=citations.d.ts.map