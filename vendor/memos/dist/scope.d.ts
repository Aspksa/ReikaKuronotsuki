/**
 * Multi-scope memory — hierarchical namespace composition.
 *
 * Scopes are the promoted, first-class interface over raw namespaces.
 * A scope is a set of typed keys (`user` / `agent` / `run`) composed —
 * in that fixed order — into the underlying namespace string:
 *
 *   { user: "alice", agent: "coder", run: "r1" }
 *     → "u:alice/a:coder/r:r1"
 *
 * Because scopes map onto namespace strings, retrieval can be
 * hierarchical: querying with `{ user: "alice" }` (prefix match)
 * surfaces every memory stored under any of Alice's agents and runs,
 * while `{ user: "alice", run: "r1" }` narrows to one run. Exact
 * matching is available via `scopeMatch: "exact"`.
 *
 * @module @mem-os/scope
 */
import type { MemoryScope } from "./types.js";
/** Compose a scope object into its canonical namespace string. */
export declare function composeScope(scope: MemoryScope): string;
/**
 * Parse a CLI-scope string into a MemoryScope. Accepts both tag and long
 * forms, comma- or slash-separated:
 *   "user:alice,agent:coder" · "u:alice/a:coder/r:r1"
 */
export declare function parseScopeArg(value: string): MemoryScope;
/** Escape LIKE wildcards so user values can't widen a prefix match. */
export declare function escapeLikePrefix(value: string): string;
//# sourceMappingURL=scope.d.ts.map