/**
 * Encrypted cross-machine sync (bundle format v2).
 *
 * Export memories to an encrypted bundle file, move it to another machine
 * (via cloud drive, USB, etc.), and import it there. The bundle is encrypted
 * with AES-256-GCM; the storage medium never sees plaintext.
 *
 * ## Threat model (v2)
 *
 * - The sync bundle may be stored on untrusted storage (cloud drives, USB
 *   sticks, email). EVERYTHING about each record — id, content, type,
 *   tags, timestamps, namespace, metadata — is encrypted client-side
 *   before writing the bundle. Each record gets a fresh random nonce.
 * - Bundle metadata (`version`, `exportedAt`, `salt`, `recordCount`) is
 *   plaintext but AUTHENTICATED: it is bound into every record's
 *   AES-GCM additional authenticated data (AAD). Tampering with it
 *   fails decryption.
 * - The encryption key is derived from a user passphrase via PBKDF2
 *   (100k iterations, SHA-256) or read directly from a key file. The key
 *   never leaves the user's devices.
 * - An attacker with the bundle but not the key learns only: the bundle
 *   version, export timestamp, salt, record count, and per-record
 *   ciphertext sizes. They do NOT learn IDs, content, types, tags,
 *   timestamps, or any other memory field.
 * - This does NOT protect against an attacker who obtains the passphrase
 *   or key file. Choose a strong passphrase.
 * - This does NOT hide access patterns (when you sync, how many records).
 *
 * ## Conflict semantics
 *
 * - `skip-existing` (default): records with IDs already in the local store
 *   are skipped. New records are imported with their original IDs and
 *   timestamps.
 * - `last-write-wins`: if a record exists locally, the version with the
 *   newer `updatedAt` wins and replaces the local copy (same ID,
 *   incoming timestamps preserved). On equal timestamps the local copy
 *   is kept (deterministic tiebreak).
 * - Content-identical records are never duplicated: if any local record
 *   already has the same content hash, the incoming record is skipped.
 *
 * ## Local-first
 *
 * The local SQLite database remains the source of truth. Sync is additive:
 * export writes a snapshot, import merges into the local store. Import
 * never deletes records except replacing the single conflicting record
 * under `last-write-wins`.
 *
 * ## Transport
 *
 * Transport is manual: you move the bundle file yourself (cloud drive,
 * USB stick, `scp`, …). There is no network sync backend — the bundle
 * file IS the transport, and the encryption above is what makes that safe.
 *
 * @module @memos/sync
 */
import type { MemoryType, MemorySource, MemoryPool, ProvenanceTier } from "./types.js";
import type { MemOS } from "./memory.js";
/**
 * A single memory record as exported in the bundle. Every field lands
 * inside the encrypted payload — nothing record-specific is plaintext.
 */
export interface SyncRecord {
    id: string;
    content: string;
    summary?: string;
    type: MemoryType;
    tags: string[];
    importance: number;
    /** Creation timestamp (Unix ms). */
    createdAt: number;
    /** Last-modified timestamp (Unix ms). */
    updatedAt: number;
    namespace: string;
    metadata: Record<string, unknown>;
    source?: MemorySource;
    provenance?: ProvenanceTier;
    pool?: MemoryPool;
    /** TTL expiration as Unix timestamp (seconds). null = no expiration. */
    expiresAt?: number | null;
    validFrom?: number | null;
    validTo?: number | null;
    harness?: string;
}
/** A single encrypted record in the bundle — opaque bytes only. */
export interface EncryptedRecord {
    /** Base64-encoded nonce for AES-GCM. */
    nonce: string;
    /** Base64-encoded ciphertext (AES-256-GCM). */
    ciphertext: string;
    /** Base64-encoded auth tag. */
    tag: string;
}
/**
 * The encrypted sync bundle format (v2).
 *
 * `version`, `exportedAt`, `salt`, and `recordCount` are plaintext but
 * authenticated via the GCM AAD of every record (see `buildAAD`).
 */
export interface SyncBundle {
    version: number;
    /** ISO timestamp of export. Authenticated, not secret. */
    exportedAt: string;
    /** Base64-encoded PBKDF2 salt (bundle-wide). Authenticated, not secret. */
    salt: string;
    /** Number of records. Must equal records.length; authenticated. */
    recordCount: number;
    records: EncryptedRecord[];
}
/** Conflict resolution strategy for import. */
export type SyncStrategy = "skip-existing" | "last-write-wins";
/** Result of an import operation. */
export interface SyncImportResult {
    imported: number;
    skipped: number;
    updated: number;
    errors: string[];
}
/**
 * Derive a 32-byte AES key from a passphrase using PBKDF2.
 */
export declare function deriveKey(passphrase: string, salt: Buffer): Buffer;
/**
 * Build the AES-GCM additional authenticated data for a bundle.
 * Binds the plaintext bundle metadata to every record's ciphertext so
 * any tampering with version/exportedAt/salt/recordCount fails auth.
 * Key order is fixed so encrypt and decrypt compute identical bytes.
 */
export declare function buildAAD(bundle: {
    version: number;
    exportedAt: string;
    salt: string;
    recordCount: number;
}): Buffer;
/**
 * Encrypt a plaintext string with AES-256-GCM.
 * `aad`, when given, is authenticated but not encrypted.
 * Returns { nonce, ciphertext, tag } as base64 strings.
 */
export declare function encryptRecord(plaintext: string, key: Buffer, aad?: Buffer): {
    nonce: string;
    ciphertext: string;
    tag: string;
};
/**
 * Decrypt a record. Throws if the key is wrong, data is tampered,
 * or the AAD does not match.
 */
export declare function decryptRecord(encrypted: {
    nonce: string;
    ciphertext: string;
    tag: string;
}, key: Buffer, aad?: Buffer): string;
/**
 * Content hash for dedup: SHA-256 over the record's content.
 */
export declare function contentHash(content: string): string;
/**
 * Create an encrypted sync bundle (v2) from memory records.
 *
 * Every record field is encrypted; only the bundle envelope
 * (version/exportedAt/salt/recordCount) is plaintext, and it is
 * authenticated via GCM AAD.
 */
export declare function createBundle(records: SyncRecord[], keyOrPassphrase: Buffer | string): SyncBundle;
/**
 * Decrypt all records in a bundle. Returns validated SyncRecords with
 * their original IDs and timestamps.
 *
 * Rejects v1 bundles outright: v1 left record IDs and timestamps in
 * plaintext and cannot be upgraded safely — re-export from the source
 * machine with the current memos.
 */
export declare function decryptBundle(bundle: SyncBundle, keyOrPassphrase: Buffer | string): SyncRecord[];
/**
 * Write a bundle to a file (JSON).
 */
export declare function writeBundle(path: string, bundle: SyncBundle): void;
/**
 * Read a bundle from a file. Validates the envelope shape only —
 * decryption (which authenticates the envelope) happens in
 * `decryptBundle`.
 */
export declare function readBundle(path: string): SyncBundle;
/**
 * Merge decrypted records into a MemOS instance, preserving original
 * IDs and timestamps.
 *
 * - Content-identical records (by SHA-256 of content) are never
 *   duplicated: skipped when any local record already has the hash.
 * - `skip-existing`: IDs already present are skipped.
 * - `last-write-wins`: when the incoming `updatedAt` is newer than the
 *   local one, the local record is replaced (same ID, incoming
 *   timestamps preserved). Equal timestamps keep the local copy.
 */
export declare function importRecords(memos: MemOS, records: SyncRecord[], strategy: SyncStrategy): Promise<SyncImportResult>;
/**
 * Resolve the sync key from CLI options.
 * Priority: --key-file > --key > MEMOS_SYNC_KEY env var.
 * When none is provided, throws — the CLI prompts interactively on a TTY.
 */
/**
 * Resolve the sync key from CLI options.
 * Priority: --passphrase-file > --passphrase > MEMOS_SYNC_KEY env var.
 * When none is provided, throws — the CLI prompts interactively on a TTY.
 *
 * Note: the flag is --passphrase (not --key) because --key is already the
 * global at-rest database encryption key in the CLI.
 */
export declare function resolveSyncKey(opts: {
    passphrase?: string;
    passphraseFile?: string;
}): Buffer | string;
//# sourceMappingURL=sync.d.ts.map