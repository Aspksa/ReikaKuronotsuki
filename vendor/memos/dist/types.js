/**
 * MemOS — Universal memory layer for AI agents.
 *
 * Core type definitions. Every interface and type in the system
 * is defined here to provide a single source of truth for the
 * data model across modules.
 *
 * @module @memos/types
 */
/**
 * Default trust score for each provenance source.
 */
export const DEFAULT_TRUST_SCORES = {
    user_input: 1.0,
    agent_inferred: 0.7,
    tool_output: 0.6,
    external_data: 0.5,
    system: 0.3,
};
//# sourceMappingURL=types.js.map