/**
 * Command-driven belief revision ("natural-language revert").
 *
 * MemOS has a bitemporal validity ledger (`valid_from`/`valid_to` on nodes
 * and edges) and a contradiction-detection pipeline — but invalidation only
 * fires on *detected* contradictions. This module provides the missing
 * primitive: detecting a *revert command* in user/agent text, locally, with
 * no LLM on the hot path (patterns + entity/scope resolution only).
 *
 * Intent model:
 * - "last" scope — "revert that", "undo what I just told you",
 *   "forget the last thing", "that last thing was wrong", "go back".
 *   Resolves to the most recent currently-valid, non-audit memory in the
 *   namespace (durable across processes: a CLI invocation is its own
 *   session, so "last" means the newest write in the store).
 * - "named" scope — "revert what I said about the dentist",
 *   "undo the dentist appointment". Resolves to the best-matching memory
 *   for the named entity.
 *
 * Disambiguation rule (documented, deterministic):
 * - When several memories match a named target, the most recently created
 *   valid memory wins; every other match is returned as an `alternative`
 *   so the caller (CLI dry-run, MCP dry_run) can confirm before executing.
 * - `forget <named entity>` is deliberately NOT revert intent — it is the
 *   existing `memos_forget` semantic (delete the memory), not a request to
 *   restore an older version. Only `forget the last thing` / `forget what
 *   I said` (no entity named) counts as revert intent.
 *
 * @module @memos/revert
 */
import type { RevertScopeInput } from "./types.js";
export type { RevertScopeInput };
export type RevertScopeKind = "last" | "named" | "unknown";
export interface RevertIntent {
    /** True when the text contains a revert command. */
    detected: boolean;
    /** Which scope the command carries; "unknown" when not detected. */
    scope: RevertScopeKind;
    /** Normalized target phrase for named scope, e.g. "the dentist". */
    target?: string;
    /** Name of the pattern that fired (debugging / docs). */
    pattern?: string;
}
/**
 * Normalize a captured target phrase: trim, strip trailing punctuation,
 * then surrounding quotes (order matters for `"the gym"!`), collapse
 * whitespace.
 */
export declare function normalizeRevertTarget(raw: string): string;
/**
 * Detect a revert command in free text. Local-only: regex patterns, no LLM.
 *
 * @param text — The user/agent utterance.
 * @returns The detected intent, or `{ detected: false, scope: "unknown" }`.
 */
export declare function detectRevertIntent(text: string): RevertIntent;
export interface ParsedRevertArgs {
    scope: RevertScopeInput;
    dryRun: boolean;
    reason?: string;
    actor?: string;
    namespace?: string;
    /** Human-readable error when the args don't form a valid revert. */
    error?: string;
}
/**
 * Parse `memos revert` CLI arguments (pure, no side effects — testable).
 *
 *   memos revert --last [--dry-run] [--reason <r>] [--actor <a>]
 *   memos revert --id <id> [--dry-run] ...
 *   memos revert --about <entity> [--dry-run] ...
 *   memos revert "<natural language>" [--dry-run] ...
 *
 * Flags that take a value: --id, --about, --reason, --actor, --namespace.
 */
export declare function parseRevertCliArgs(args: string[]): ParsedRevertArgs;
//# sourceMappingURL=revert.d.ts.map