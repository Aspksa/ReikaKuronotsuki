/**
 * Parser for third-party AI memory exports — ChatGPT data exports and
 * Claude data exports — feeding `MemOS.importExternal`.
 *
 * The design goal is tolerance: vendor export shapes change without
 * notice, so the parser sniffs each item rather than trusting a fixed
 * schema, extracts whatever text fields exist, and reports what it
 * skipped. Recognized shapes:
 *
 * - ChatGPT data export (`conversations.json`): an array of
 *   `{ title, mapping: { <id>: { message: { author: { role }, content:
 *   { parts: string[] } } } } }` trees — user turns are extracted.
 * - Claude data export (`conversations.json`): an array of
 *   `{ name, chat_messages: [{ sender: "human", text, created_at }] }` —
 *   human turns are extracted. A directory export is scanned for every
 *   `*.json` / `*.jsonl` file and each candidate is sniffed.
 * - Slack export (directory): `channels.json` + `users.json` plus one
 *   folder per channel with per-day message files
 *   (`{ user, text, ts }`) — all messages are extracted with author and
 *   channel attribution.
 * - Flat memory lists: an array of strings or of objects with
 *   `content` / `text` / `title` / `memory` string fields (covers
 *   `memories.json`-style exports from both vendors).
 * - Wrapper objects: `{ conversations: [...] }` or `{ memories: [...] }`.
 *
 * Dedupe is by SHA-256 of the normalized content (whitespace-collapsed,
 * lowercased), so the same message appearing in several files — or twice
 * in one export — is imported once.
 *
 * @module @mem-os/external-import
 */
export type ExternalImportSource = "auto" | "chatgpt" | "claude" | "slack" | "generic";
export type DetectedExportSource = "chatgpt" | "claude" | "slack" | "generic";
export interface ExternalMemoryItem {
    content: string;
    /** Creation timestamp in Unix ms, when the export carried one. */
    createdAt?: number;
    /** Human-readable author name, when the export carried one. */
    author?: string;
    /** Channel / conversation label, when the export carried one. */
    channel?: string;
    /** Conversation title, when the export carried one. */
    conversation?: string;
}
export interface ParsedExternalExport {
    items: ExternalMemoryItem[];
    detected: DetectedExportSource;
    /** Items recognized structurally but yielding no usable text. */
    skipped: number;
}
/**
 * Parse a parsed-JSON export payload into memory items.
 *
 * @param raw — The decoded JSON value (or a JSON string).
 * @param source — `"auto"` sniffs the shape; explicit values force a
 *   parser (useful when auto-detection misreads a custom format).
 */
export declare function parseExternalMemoryExport(raw: unknown, source?: ExternalImportSource, maxItems?: number): ParsedExternalExport;
/**
 * SHA-256 of the normalized content (whitespace-collapsed, lowercased).
 * The dedupe key for imports.
 */
export declare function contentHash(content: string): string;
/**
 * Scan an export directory for a vendor source and parse everything
 * found, with content-hash dedupe across files.
 *
 * - `slack`: reads the official Slack export layout (`channels.json`,
 *   `users.json`, per-channel per-day message files).
 * - `chatgpt` / `claude`: walks the directory for `*.json` files
 *   (each sniffed as a conversation export) and `*.jsonl` files
 *   (each line sniffed as a message).
 */
export declare function parseExportDirectory(dir: string, source: "chatgpt" | "claude" | "slack", maxItems?: number): Promise<ParsedExternalExport>;
/**
 * Parse an official Slack export directory:
 * `channels.json` + `users.json` at the root, one folder per channel
 * with per-day message files (`[{ user, text, ts }]`).
 */
export declare function parseSlackExportDirectory(dir: string, maxItems?: number): Promise<ParsedExternalExport>;
/** Structured insight extracted from imported text. */
export type SynthesizedKind = "decision" | "preference" | "milestone";
export interface SynthesizedInsight {
    kind: SynthesizedKind;
    /** The source sentence, trimmed (max 400 chars). */
    text: string;
}
/**
 * Rule-based post-import pass: pull structured decisions, preferences,
 * and milestones out of imported messages. Each match is the source
 * *sentence* (not the whole message), classified by the first matching
 * rule (decision > preference > milestone). No LLM — pure regex over
 * sentence-split text.
 */
export declare function synthesizeImportInsights(items: ReadonlyArray<{
    content: string;
}>): SynthesizedInsight[];
//# sourceMappingURL=external-import.d.ts.map