/**
 * Rule-based semantic triple extraction for write-time structuring.
 *
 * Extracts (subject, predicate, object) triples from memory content at
 * store time. Inspired by Memori's "Advanced Augmentation" pipeline, which
 * converts unstructured dialogue into semantic triples for precise
 * retrieval — but rule-based and local-first (no LLM needed).
 *
 * This is experimental and opt-in. Triples are stored in node metadata
 * (`metadata.triples`) and can boost retrieval when the query's triples
 * match stored triples.
 *
 * The extractor uses simple SVO patterns. It's heuristic, not perfect —
 * but it's fast, deterministic, and testable through the accuracy gate.
 */
export interface SemanticTriple {
    subject: string;
    predicate: string;
    object: string;
}
/**
 * Extract semantic triples from text.
 * Returns array of {subject, predicate, object}.
 */
export declare function extractTriples(text: string): SemanticTriple[];
/**
 * Check if a query triple matches a stored triple.
 * Matches on subject+predicate, or subject+object overlap.
 */
export declare function triplesMatch(queryTriples: SemanticTriple[], storedTriples: SemanticTriple[]): boolean;
//# sourceMappingURL=triple-extraction.d.ts.map