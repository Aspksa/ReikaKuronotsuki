/**
 * Deterministic temporal event memory: extraction, update/cancel
 * resolution, and reminder listing. No LLM on any path — regex intent
 * detection plus the deterministic parser in `./temporal.js`, mirroring
 * the `src/revert.ts` pattern.
 *
 * Cross-harness continuity: every harness (any model, any process) shares
 * the same DB file and runs the same parsing/resolution rules, so an
 * event stored by model A is updatable by model B. The update path reads
 * the event's CURRENT row from the store (not from conversation state),
 * so there is no per-harness state to drift.
 *
 * @module @memos/event-memory
 */
import { type TemporalDuration, type TemporalGrain } from "./temporal.js";
import type { MemoryNode, ScoredMemory, SearchFilter } from "./types.js";
/** Event status lifecycle. */
export type EventStatus = "scheduled" | "recurring" | "cancelled";
/**
 * Structured event payload stored in `metadata.event`.
 *
 * - `kind`: canonical event noun ("meeting", "appointment", "reminder").
 * - `label`: human noun phrase ("meeting", "dentist appointment").
 * - `at`: ISO-8601 datetime of the event.
 * - `grain`: temporal resolution of the parse.
 * - `status`: "scheduled" events feed reminders; "recurring" (year-less
 *   or every-X references) and "cancelled" never do.
 * - `reminder_at`: ISO-8601; when the reminder fires (defaults to `at`).
 */
export interface EventMetadata {
    kind: string;
    label: string;
    at: string;
    grain: TemporalGrain;
    status: EventStatus;
    reminder_at: string;
}
/** Result of `detectEvent`. */
export interface DetectedEvent extends EventMetadata {
}
/** A natural-language event update or cancellation. */
export interface EventUpdate {
    intent: "update" | "cancel";
    /** Named event kind ("meeting"), absent for bare "it". */
    kind?: string;
    /** New absolute-ish time (parsed against `now`), for updates. */
    newTime?: {
        at: string;
        grain: TemporalGrain;
    };
    /** Bare relative offset ("3 days later") — anchored to the EVENT's
     *  current datetime, not to now. */
    duration?: TemporalDuration;
    /** Name of the pattern that fired (debugging / docs). */
    pattern: string;
}
/**
 * Detect a schedulable event in free text: an event noun co-occurring
 * with a temporal expression.
 *
 * Guard (deterministic): dates without a year ("my birthday is June 1")
 * or recurring references ("every Monday") yield `status: "recurring"` —
 * they are stored as structured events but NEVER produce reminders.
 *
 * @param content — The memory text.
 * @param now     — Reference time for temporal parsing.
 * @returns The detected event, or null when no event noun + temporal
 *   expression co-occur.
 */
export declare function detectEvent(content: string, now: Date): DetectedEvent | null;
/**
 * Detect an event update/cancellation command in free text.
 *
 * Returns null when: no update/cancel intent; intent present but no
 * resolvable new time (fail safe — the write proceeds as a normal
 * memory); or the text names no actionable target. An update intent
 * WITHOUT a new time or duration is not an update — e.g. "we moved the
 * meeting" (no when) must not touch the stored event.
 *
 * @param content — The memory text.
 * @param now     — Reference time for absolute-ish new times.
 */
export declare function detectEventUpdate(content: string, now: Date): EventUpdate | null;
/**
 * Extract the named event kind from an update/cancel utterance.
 * "that meeting" → "meeting"; "the dentist appointment" → "appointment";
 * bare "it" → undefined.
 */
export declare function extractEventKind(content: string): string | undefined;
/**
 * Split a `memos remind "<text>" at <temporal-expression>` command.
 * The temporal expression is the text after the LAST " at " whose suffix
 * parses as a temporal expression (deterministic).
 *
 * @returns `{ text, temporal }`, or null when no trailing temporal
 *   expression is found.
 */
export declare function splitRemindText(input: string): {
    text: string;
    temporal: string;
} | null;
/** True when the node is a currently-open scheduled event. */
export declare function isScheduledEventNode(node: MemoryNode): boolean;
/** Minimal read surface `listReminders` needs (MemOS satisfies it). */
export interface ReminderSource {
    search(filter: SearchFilter): Promise<ScoredMemory[]>;
}
export interface ListRemindersOptions {
    /** Reference time ("now"); Date or Unix ms. */
    now: Date | number;
    /** When true, only reminders with reminder_at <= now. */
    dueOnly?: boolean;
    /** Namespace to scan (default: all namespaces). */
    namespace?: string;
    /** Scan cap (default 10_000 — same local-scan approach as other
     *  maintenance passes in the codebase; v1 simplicity over an index). */
    limit?: number;
}
export interface ReminderEntry {
    id: string;
    kind: string;
    label: string;
    at: string;
    grain: TemporalGrain;
    reminderAt: string;
    content: string;
    createdAt: number;
    /** True when reminderAt <= now at listing time. */
    due: boolean;
}
/**
 * List scheduled event reminders.
 *
 * Scans currently-valid (valid_to null), non-quarantined nodes carrying
 * `metadata.event.status === "scheduled"`. Deterministic ordering:
 * reminder_at ascending, then createdAt ascending, then id ascending.
 *
 * v1 note: this is a full local scan (like the decay/consolidation
 * passes), not an index lookup — fine for a local-first store, revisit
 * with a metadata index if reminder volume grows.
 *
 * Honest scope: MemOS SURFACES due reminders; it does not push-notify.
 * Delivery/notification is the harness's job — poll `memos_reminders`
 * (or `memos reminders --due`) on the harness's own schedule.
 */
export declare function listReminders(source: ReminderSource, opts: ListRemindersOptions): Promise<ReminderEntry[]>;
//# sourceMappingURL=event-memory.d.ts.map