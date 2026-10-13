/**
 * Shared CLI help data: the canonical command list, did-you-mean suggestions,
 * and per-command usage text for `memos <command> --help`.
 *
 * Kept in its own module (no process.argv reads) so it can be unit-tested.
 *
 * @module @memos/cli-help
 */
/** Every command the CLI actually implements (mirrors the dispatch in cli.ts). */
export declare const CLI_COMMANDS: readonly string[];
/**
 * Suggest the most likely intended command for a typo'd input.
 * Returns null when nothing is close enough to be helpful.
 */
export declare function suggestCommand(input: string): string | null;
/** Usage text for one command, or null for unknown commands. */
export declare function getCommandHelp(command: string): string | null;
//# sourceMappingURL=cli-help.d.ts.map