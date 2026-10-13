/**
 * Testable CLI command logic for the quarantine review queue.
 *
 * The CLI dispatches `memos quarantine list|release` through these
 * helpers so the output format is asserted in unit tests rather than
 * through awkward subprocess runs.
 */
import type { MemOS } from "./memory.js";
import type { MemoryNode } from "./types.js";
/**
 * Render the quarantine review queue. JSON mode emits the raw nodes;
 * human mode prints one line per memory: `[mem:hex]`-style short id,
 * quarantine reason, and the first ~120 chars of content.
 */
export declare function formatQuarantineList(nodes: MemoryNode[], json: boolean): string;
/**
 * Release a memory from quarantine and render the result. JSON mode
 * emits the updated node; human mode confirms the release while
 * reminding the operator that the memory keeps its low-trust marking
 * for agent consumption.
 */
export declare function releaseQuarantined(memos: MemOS, id: string, json: boolean): Promise<string>;
//# sourceMappingURL=quarantine-commands.d.ts.map