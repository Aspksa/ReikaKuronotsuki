/**
 * Session hooks — automatic fact extraction at session end.
 *
 * Claude Code and OpenCode can run a hook when a session ends. This module
 * provides:
 *
 * - `parseClaudeTranscript()` / `parseClaudeTranscriptText()`: convert a
 *   Claude Code JSONL transcript into `ConversationMessage[]` for
 *   `MemOS.extractFacts()`.
 * - `parsePlainTranscript()`: convert `User:`/`Assistant:` plain-text
 *   transcripts.
 * - `parseTranscriptFile()`: try Claude JSONL first, fall back to
 *   plain text when it yields nothing (used by both `extract-facts`
 *   and `session-hook`).
 * - `findOpenCodeSessionMessages()`: load an ended OpenCode session's
 *   messages from OpenCode's data dir (backs `--opencode-session`).
 * - `session-hook` (in the CLI): the hook entrypoint — reads hook JSON
 *   from stdin (Claude Code SessionEnd format) or `--opencode-session`,
 *   extracts the transcript, and stores durable facts via
 *   `extractFacts({ autoStore: true })`.
 * - `claudeCodeHookConfig()` / `openCodePluginSource()`: setup artifacts.
 *
 * The hook feeds the existing extraction/storage path — it never drops or
 * rewrites memories, it only calls `extractFacts` with `autoStore: true`.
 *
 * @module @memos/session-hooks
 */
import type { ConversationMessage } from "./types.js";
/** Hook input JSON (Claude Code SessionEnd format). */
export interface SessionHookInput {
    session_id?: string;
    transcript_path?: string;
    cwd?: string;
    hook_event_name?: string;
    reason?: string;
}
/** Result of running the session hook. */
export interface SessionHookResult {
    /** Whether the hook ran successfully. */
    ok: boolean;
    /** Number of facts extracted. */
    facts: number;
    /** Number of facts stored. */
    stored: number;
    /** Number of duplicates skipped. */
    duplicates: number;
    /** Human-readable message. */
    message: string;
}
/**
 * Parse a Claude Code JSONL transcript into conversation messages.
 *
 * Each line is a JSON object with `type` ("user" | "assistant") and a
 * `message` object containing `role` and `content` (string or array of
 * content blocks). Only text content is extracted; tool calls/results
 * are skipped.
 */
export declare function parseClaudeTranscript(transcriptPath: string): ConversationMessage[];
/**
 * Parse Claude Code JSONL transcript text into conversation messages.
 * Malformed lines are skipped. Returns an empty array when no line
 * yields a message — callers that want a plain-text fallback should use
 * `parseTranscriptFile()` instead of treating this as an error.
 */
export declare function parseClaudeTranscriptText(text: string): ConversationMessage[];
/**
 * Parse a transcript file of unknown format.
 *
 * Tries Claude Code JSONL first; when that yields no messages but the
 * file is non-empty, falls back to plain-text parsing (`User:` /
 * `Assistant:` prefixes). This is the entrypoint both `extract-facts`
 * and `session-hook` use — previously the fallback was dead code
 * because the JSONL parser returned `[]` instead of throwing.
 */
export declare function parseTranscriptFile(transcriptPath: string): ConversationMessage[];
/**
 * Parse a plain-text or markdown transcript into conversation messages.
 * Lines starting with "User:" / "Human:" become user messages;
 * "Assistant:" / "Claude:" become assistant messages.
 */
export declare function parsePlainTranscript(text: string): ConversationMessage[];
/**
 * Candidate OpenCode data directories, in priority order.
 *
 * OpenCode resolves its data dir as `$XDG_DATA_HOME/opencode`, falling
 * back to the platform default (`~/.local/share/opencode` on Linux,
 * `~/Library/Application Support/opencode` on macOS). There is no
 * `OPENCODE_DATA_DIR` env var in OpenCode itself — honor the real
 * `XDG_DATA_HOME` override here instead.
 */
export declare function openCodeDataDirs(): string[];
/**
 * Load the user/assistant messages of an OpenCode session.
 *
 * Current OpenCode persists sessions in SQLite at
 * `<dataDir>/opencode.db` (tables `session`, `message`, `part`; message
 * rows carry `session_id` plus a JSON `data` column with `role` and
 * `time.created`, part rows carry `message_id` plus a JSON `data`
 * column where `type: "text"` parts hold the visible text in
 * `data.text`). Older installs used JSON files at
 * `<dataDir>/storage/message/<sessionId>/<messageId>.json` and
 * `<dataDir>/storage/part/<messageId>/<partId>.json` — tried as a
 * fallback when the database is absent or unreadable.
 *
 * Returns an empty array when the session cannot be found — the caller
 * (session-hook) treats that as fail-open, not an error.
 *
 * @param sessionId The OpenCode session ID (from the `session.deleted` event).
 * @param dataDir   Override the data directory (e.g. in tests). When
 *                  omitted, `openCodeDataDirs()` is searched in order.
 */
export declare function findOpenCodeSessionMessages(sessionId: string, dataDir?: string): ConversationMessage[];
/**
 * Generate the Claude Code SessionEnd hook configuration.
 * Add to `.claude/settings.json` (project) or `~/.claude/settings.json` (user).
 */
export declare function claudeCodeHookConfig(memosBin?: string): object;
/**
 * Generate an OpenCode plugin that runs fact extraction on session end.
 * Save as `.opencode/plugins/memos-session-hook.ts` (or .js).
 */
export declare function openCodePluginSource(memosBin?: string): string;
/**
 * Format hook setup instructions for a target harness.
 */
export declare function sessionHookInstructions(target: string, memosBin?: string): string;
//# sourceMappingURL=session-hooks.d.ts.map