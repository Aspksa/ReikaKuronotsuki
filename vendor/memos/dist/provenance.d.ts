/**
 * Provenance-tiered trust for MemOS — the provenance-trust security layer.
 *
 * 2026 is the year memory became the attack surface (InjecMEM/COLM 2026:
 * one ordinary interaction poisons memory with 35.6% end-to-end success;
 * Trojan Hippo: dormant payloads persist through 100 benign sessions;
 * AgentPoison >80% ASR at <0.1% poison rate; ClawHavoc poisoned AI skill
 * packages). A local-first memory store should know *where* each memory
 * came from and treat channels unequally — so every memory carries a
 * provenance tier, assigned at write time and fused into recall scoring.
 *
 * Tier ordering (highest trust first):
 *
 * - `user-verified` — explicitly confirmed by the user (never assigned
 *   automatically — only via an explicit `provenance` opt or `verify()`).
 * - `user`          — ordinary user statements (the default for direct
 *   `store()` writes, which carry `source: "user_input"`).
 * - `tool-output`   — results returned by tools (`source: "tool_output"`).
 * - `chat`          — model-generated content (`source: "agent_inferred"`
 *   or `source: "system"`).
 * - `imported`      — bulk imports from ChatGPT/Claude/Slack exports
 *   (`source: "external_data"`).
 *
 * Default rule (documented here and in docs/provenance-trust.md): when
 * `store()` is called without an explicit `provenance`, the tier is
 * derived from `source` via {@link defaultProvenanceForSource}.
 * `user-verified` is the only tier that can never be assigned by the
 * default rule — it requires an explicit user confirmation step.
 *
 * Everything here is dependency-free and LLM-free: tier assignment and
 * trust fusion are pure local computation, safe for the hot path.
 *
 * @module @mem-os/provenance
 */
import type { MemoryNode, MemorySource, ProvenanceTier, ScoredMemory } from "./types.js";
/**
 * Canonical tier ordering, highest trust first. The index is the
 * authority for "higher tier wins" comparisons.
 */
export declare const PROVENANCE_TIER_ORDER: readonly ProvenanceTier[];
/**
 * Tiers whose content a host agent should confirm before acting on,
 * rather than silently injecting as context. Quarantined-then-released
 * memories are untrusted regardless of tier (see
 * {@link isUntrustedForAgent}).
 */
export declare const LOW_TRUST_TIERS: ReadonlySet<ProvenanceTier>;
/**
 * Per-tier trust multiplier fused into retrieval scoring (see
 * `fuseResults` in src/retrieval.ts). Deliberately gentle: the top tier
 * is untouched and the bottom tier keeps 72% of its relevance score, so
 * provenance nudges ranking without overriding relevance.
 */
export declare const PROVENANCE_TRUST: Record<ProvenanceTier, number>;
/**
 * Default strength of the provenance multiplier in score fusion
 * (`score *= 1 - strength * (1 - tierTrust)`). 0.5 keeps the maximum
 * penalty (imported tier) at ~14% — measurable but never dominant.
 * Override per deployment via `config.fusion.provenanceWeightStrength`
 * (0 disables it).
 */
export declare const DEFAULT_PROVENANCE_WEIGHT_STRENGTH = 0.5;
/** Metadata key stamped on a memory released from quarantine. */
export declare const QUARANTINE_RELEASED_METADATA_KEY = "releasedFromQuarantine";
/** Runtime guard for the tier union (storage rows may predate the column). */
export declare function isProvenanceTier(value: unknown): value is ProvenanceTier;
/**
 * Default provenance tier for a write, derived from its `source`.
 *
 * - `user_input`    → `user` (ordinary user statements)
 * - `tool_output`   → `tool-output`
 * - `agent_inferred`→ `chat` (model-generated)
 * - `system`        → `chat` (machine-generated)
 * - `external_data` → `imported` (bulk imports)
 *
 * `user-verified` is never returned here: explicit user confirmation is
 * the only path to the top tier.
 */
export declare function defaultProvenanceForSource(source: MemorySource): ProvenanceTier;
/**
 * Resolve the provenance tier for a write: an explicit, valid
 * `provenance` option always wins; otherwise the source-derived
 * default applies.
 */
export declare function resolveProvenance(opts: {
    provenance?: ProvenanceTier;
    source: MemorySource;
}): ProvenanceTier;
/** Compare two tiers: negative when `a` outranks `b`. */
export declare function compareProvenanceTier(a: ProvenanceTier, b: ProvenanceTier): number;
/**
 * Whether a memory's provenance channel is low-trust for agent
 * consumption: tier `imported` / `tool-output`, or a memory that was
 * quarantined and later released (its tier alone no longer tells the
 * story — the release marker does).
 */
export declare function isUntrustedForAgent(node: Pick<MemoryNode, "provenance" | "quarantined" | "metadata">): boolean;
/**
 * Quarantine visibility for a recall filter. Storage excludes
 * quarantined rows by default (`includeQuarantined` unset or false);
 * `includeQuarantined: true` shows everything; `quarantinedOnly: true`
 * shows only quarantined rows (the review queue).
 */
export declare function quarantineVisible(quarantined: boolean, filter: {
    includeQuarantined?: boolean;
    quarantinedOnly?: boolean;
}): boolean;
/**
 * The trust multiplier for one tier at a given fusion strength:
 * `1 - strength * (1 - tierTrust)`. Uniform across a result set, so a
 * same-tier corpus (e.g. the retrieval eval's all-`user` facts) keeps
 * byte-identical ranking — the weight is provably neutral there.
 */
export declare function provenanceMultiplier(tier: ProvenanceTier, strength?: number): number;
/**
 * Stamp trust flags onto search results headed for an agent: the
 * provenance tier, a citable `[mem:hex]` token tracing the memory to
 * its source episode, and `untrustedSource` for low-trust channels.
 * Pure — returns new result objects, never mutates the input.
 */
export declare function decorateTrustFlags(results: ScoredMemory[]): ScoredMemory[];
//# sourceMappingURL=provenance.d.ts.map