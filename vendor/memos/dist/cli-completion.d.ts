/**
 * Shell completion for the `memos` CLI.
 *
 * `memos completion <bash|zsh|fish>` prints a completion script to stdout.
 * The scripts are generated from the canonical command list in
 * `./cli-help.js` plus the per-command flag table below, so they can never
 * drift out of sync with the CLI itself.
 *
 * Install:
 *   # bash
 *   memos completion bash >> ~/.bashrc
 *   # zsh (needs a dir on your $fpath, e.g. ~/.zfunc)
 *   memos completion zsh > ~/.zfunc/_memos
 *   # fish
 *   memos completion fish > ~/.config/fish/completions/memos.fish
 *
 * @module @memos/cli-completion
 */
export type CompletionShell = "bash" | "zsh" | "fish";
export declare const COMPLETION_SHELLS: readonly CompletionShell[];
/**
 * Escape a string for embedding in a single-quoted shell string.
 * Both zsh and fish treat backslash as literal inside single quotes, so
 * `\'` does NOT escape — the portable idiom is '\'' (end quote, escaped
 * quote, reopen quote). CodeQL js/incomplete-sanitization flags the
 * backslash form.
 */
export declare function shSingleQuoteEscape(s: string): string;
/** Generate the completion script for a shell, or null for unknown shells. */
export declare function getCompletionScript(shell: string): string | null;
//# sourceMappingURL=cli-completion.d.ts.map