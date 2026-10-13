/**
 * Human-readable timestamp formatting for recalled memories.
 *
 * From Honcho: LLMs reason better about time when they see explicit
 * absolute + relative timestamps ("2026-09-28 — 6 days ago") instead
 * of raw epoch milliseconds. The TimeQA step-back paper showed +12pts
 * from better temporal grounding.
 *
 * Pure rendering helper — does not affect retrieval scoring.
 */
/**
 * Format an epoch-ms timestamp as "YYYY-MM-DD — N days ago".
 *
 * @param epochMs - Timestamp in epoch milliseconds
 * @param now - Reference time (defaults to Date.now())
 */
export declare function formatMemoryTimestamp(epochMs: number, now?: number): string;
//# sourceMappingURL=timestamp-format.d.ts.map