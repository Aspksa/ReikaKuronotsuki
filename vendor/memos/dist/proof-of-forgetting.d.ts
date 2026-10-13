/**
 * Cryptographic proof of forgetting.
 *
 * When a memory is deleted via `forget()`, memos already writes a
 * tombstone entry to the hash-chained tamper log. This module adds:
 *
 * - `proveForget()`: Export a signed deletion certificate containing
 *   the node ID, deletion timestamp, content hash, and tamper-log
 *   sequence number. The certificate proves *what* was deleted and *when*.
 * - `verifyForget()`: Verify a certificate against the tamper log —
 *   checks the entry exists, the chain is intact, and the hashes match.
 *
 * This is the "prove it" for GDPR Article 17: not "trust us, it's deleted"
 * but a cryptographically verifiable artifact. Zero competitors ship this.
 */
import type { TamperLogEntry } from "./types.js";
export interface DeletionCertificate {
    /** The deleted node's ID. */
    nodeId: string;
    /** Unix ms when the deletion occurred. */
    deletedAt: number;
    /** SHA-256 hex of the deleted node's content. */
    contentHash: string;
    /** Tamper-log sequence number of the forget entry. */
    tamperSeq: number;
    /** Hash of the tamper-log entry (chain link). */
    entryHash: string;
    /** Previous entry hash (chain continuity). */
    prevHash: string;
    /** Certificate format version. */
    version: 1;
}
/**
 * Create a deletion certificate from a tamper-log forget entry.
 *
 * @param entry - The tamper-log entry with op="forget" for the deleted node.
 * @returns A verifiable deletion certificate, or null if the entry is not a forget.
 */
export declare function createDeletionCertificate(entry: TamperLogEntry): DeletionCertificate | null;
/**
 * Verify a deletion certificate against tamper-log entries.
 *
 * Checks:
 * 1. A forget entry exists at the certificate's sequence number.
 * 2. The entry's hashes match the certificate.
 * 3. The chain is intact (prevHash links correctly).
 *
 * @param cert - The certificate to verify.
 * @param entries - Tamper-log entries (must include the forget entry and its predecessor).
 * @returns True if the certificate is valid.
 */
export declare function verifyDeletionCertificate(cert: DeletionCertificate, entries: TamperLogEntry[]): boolean;
/**
 * Hash content for the certificate (SHA-256 hex).
 */
export declare function hashContent(content: string): string;
//# sourceMappingURL=proof-of-forgetting.d.ts.map