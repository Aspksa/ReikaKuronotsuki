/**
 * `memos repl` — interactive read-eval-print loop.
 *
 * Drop into a shell against a live MemOS instance:
 *
 *   $ memos repl
 *   memos> store "User prefers dark mode"
 *   Stored memory: 1ea66691-…
 *   memos> search dark mode
 *   Found 1 memories:
 *     [preference] User prefers dark mode
 *   memos> flush-embeddings
 *   Flushed embedding queue. Pending: 0, running: 0.
 *   memos> graph
 *   Memory Graph: 1 nodes, 0 edges
 *   memos> exit
 *
 * Why this exists: a CLI tool that doesn't ship a REPL gets played
 * with once and forgotten. A REPL keeps the developer in the loop
 * for an order of magnitude longer. It also doubles as a smoke
 * test — `echo "store x; search x; exit" | memos repl` is a
 * useful CI sanity check.
 *
 * The dispatch function is exported separately from the readline
 * loop so the test suite can exercise it without driving a real
 * TTY. See `__tests__/repl.test.ts`.
 *
 * @module @memos/repl
 */
import type { MemOS } from "./memory.js";
/**
 * ReplHandlers — owns the printable output stream and the exit
 * predicate. Tests construct this directly; `runRepl` builds one
 * for a real readline interface.
 */
export interface ReplHandlers {
    /** Dispatch one line of input. The result lands in `out`. */
    dispatch(line: string, out: string[]): Promise<void>;
    /** True for `exit` / `quit` / `q` — caller should break the loop. */
    shouldExit(line: string): boolean;
}
/**
 * Construct a ReplHandlers for a given MemOS instance.
 *
 * The handlers are pure with respect to `memos` — they only read
 * from the instance and write to the `out` array. That makes
 * them safe to construct in tests and to swap out for a real
 * readline interface at runtime.
 */
export declare function createReplHandlers(memos: MemOS): ReplHandlers;
/**
 * Run the interactive REPL. Connects the dispatcher to a readline
 * interface on stdin/stdout and exits when the user types one of
 * the exit commands.
 */
export declare function runRepl(memos: MemOS): Promise<void>;
//# sourceMappingURL=repl.d.ts.map