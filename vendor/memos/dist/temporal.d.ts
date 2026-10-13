/**
 * Deterministic temporal parsing for MemOS — no LLM on any path.
 *
 * Why hand-rolled instead of `chrono`:
 * - `npm install chrono` resolves to a *timezone-offset* library, not a
 *   date parser (the parser lives in `chrono-node`).
 * - `chrono-node` (v2.10.1, evaluated 2026-09-19) is zero-dependency and
 *   dual CJS/ESM with types, but ships ~7MB of locale data and its
 *   weekday/time-of-day defaults ("at 3pm" at 18:00 silently rolls to
 *   tomorrow, multi-expression sentences need ad-hoc disambiguation)
 *   would still need a deterministic wrapper for MemOS's exact phrase
 *   set. A minimal hand-rolled parser is smaller, has zero dependencies,
 *   and every rule below is explicit and testable. Revisit if the phrase
 *   set grows beyond the documented grammar.
 *
 * Grammar (all case-insensitive, evaluated against an explicit `now`):
 * - Relative: "in 2 hours", "in 3 days", "3 days later"
 * - Day words: "today", "tonight" (= today 21:00), "tomorrow"
 * - Weekdays: "Monday", "on Monday", "this Thursday", "next Friday",
 *   "last Friday"
 * - Month/day: "Sept 24", "September 24th" (year-less → yearCertain=false)
 * - ISO: "2026-09-24"
 * - Times: "at 3pm", "at 2:30pm", "at 15:00", "noon", "midnight"
 *   (a bare time attaches to today, rolling to tomorrow when past)
 * - Date+time adjacency merges: "tomorrow at 2pm", "at 3pm tomorrow"
 *
 * Deterministic rules (documented, no guessing):
 * 1. When several temporal expressions occur, the LAST one wins — this
 *    mirrors how speakers refine ("tomorrow, on Monday" → Monday).
 * 2. Adjacent date+date ("tomorrow on Monday") refines to the second date.
 * 3. Adjacent date+time merges into one datetime.
 * 4. Bare/"on" weekday = next occurrence strictly after today;
 *    "this <day>" = upcoming occurrence including today; "next <day>" =
 *    next occurrence strictly after today; "last <day>" = most recent
 *    past occurrence.
 * 5. Day-grain results resolve to local start-of-day 00:00 (an all-day
 *    event starts when the day starts), except "tonight" → 21:00.
 *
 * @module @memos/temporal
 */
/** Temporal resolution of a parsed expression. */
export type TemporalGrain = "day" | "hour" | "minute";
export interface ParsedTemporal {
    /** Resolved local datetime. */
    at: Date;
    /** Resolution: day (date only), hour, or minute. */
    grain: TemporalGrain;
    /** The exact source text that produced this parse. */
    text: string;
    /** False when the expression carried no year ("Sept 24", "June 1"). */
    yearCertain: boolean;
}
/** A bare relative offset ("3 days later") awaiting an anchor. */
export interface TemporalDuration {
    years: number;
    months: number;
    weeks: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    /** The exact source text that produced this duration. */
    text: string;
}
/**
 * Parse the temporal expression(s) in free text.
 *
 * Deterministic given `now`: no system clock reads, no randomness, no LLM.
 * When several expressions occur, the LAST one wins (speaker-refinement
 * rule); adjacent date+time pairs merge ("tomorrow at 2pm"), and adjacent
 * date+date pairs refine to the second ("tomorrow on Monday" → Monday).
 *
 * @param text — Free text possibly containing a temporal expression.
 * @param now  — Reference time; ALL resolution is relative to this.
 * @returns The parsed expression, or null when none is found.
 */
export declare function parseTemporal(text: string, now: Date): ParsedTemporal | null;
/**
 * Parse a bare relative offset ("3 days later", "in 2 hours") as a
 * DURATION — no anchor applied. Used for event updates ("moved 3 days
 * later"), where the anchor is the event's current datetime, NOT now.
 *
 * @param text — Free text possibly containing a relative offset.
 * @returns The duration, or null when no offset is found.
 */
export declare function parseDuration(text: string): TemporalDuration | null;
/**
 * Apply a duration to an anchor date (calendar-aware for months/years).
 * Deterministic: same anchor + same duration = same result.
 */
export declare function addDuration(anchor: Date, d: TemporalDuration): Date;
//# sourceMappingURL=temporal.d.ts.map