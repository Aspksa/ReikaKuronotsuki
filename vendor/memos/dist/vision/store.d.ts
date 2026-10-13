/**
 * Content-addressed blob store for image memories.
 *
 * Image bytes never go into SQLite. A 400 KB JPEG dragged through the
 * WAL, the encrypted-sync channel, and the tamper-log hash chain would
 * cost far more than the bytes are worth — all three are tuned for small
 * text rows. Instead the DB stores a reference (`img_<sha256[0:12]>`)
 * and the file lives in a sibling directory next to the database.
 *
 * Content addressing gives three properties for free:
 * - **Dedupe:** identical bytes stored twice cost one file. The write
 *   path hashes before creating a node, so a repeated image produces a
 *   single blob and (in the same namespace) a single node.
 * - **Integrity:** the ref is derived from the digest, so a truncated
 *   or corrupted file is detectable by re-hashing.
 * - **Portability:** the root is derived from the database path, so a
 *   store moves as a unit.
 *
 * Dependency-free by design — MemOS carries only three runtime deps and
 * prizes that, so image dimensions are read straight from the PNG IHDR
 * and JPEG SOFn headers rather than pulling in an image library. WebP
 * and GIF report `0x0` dimensions rather than failing: the dimensions
 * are used for prompt context, not for correctness.
 *
 * @module @memos/vision/store
 */
import type { ImageInput, ImageKind } from "../types.js";
/**
 * Thrown when image bytes are rejected before anything is persisted.
 * Fail-closed: the caller must not write a node when this is thrown.
 */
export declare class ImageRejectedError extends Error {
    readonly kind: "mime" | "size" | "empty";
    constructor(message: string, kind: "mime" | "size" | "empty");
}
/** What a stored image looks like once written. */
export interface StoredImage {
    /** Content-addressed key, `img_<sha256[0:12]>`. */
    ref: string;
    /** Absolute path of the blob file. */
    path: string;
    /** Full hex digest of the bytes. */
    sha256: string;
    /** Detected pixel width, or 0 when the header could not be parsed. */
    width: number;
    /** Detected pixel height, or 0 when the header could not be parsed. */
    height: number;
    /** Size of the stored blob in bytes. */
    bytes: number;
    /** Sniffed MIME type. */
    mime: string;
}
/** Derive the blob-store root from a database path (`<dbDir>/memos-images`). */
export declare function blobRoot(dbPath: string): string;
/** Build the content-addressed ref for a digest. */
export declare function refFor(sha256: string): string;
/**
 * Detect the MIME type from magic bytes rather than trusting the
 * caller's declared type — a `.png` name on JPEG bytes would otherwise
 * be stored and later mis-decoded by a vision model.
 */
export declare function sniffMime(bytes: Uint8Array): string | null;
/**
 * Read pixel dimensions from the container header.
 *
 * PNG: bytes 16-19 (big-endian width), 20-23 (height) after the 8-byte
 * signature and the 4-byte length + 4-byte "IHDR" chunk type.
 * JPEG: walk the marker segments to the first SOFn; width/height are
 * big-endian 16-bit fields at a fixed offset within that frame header.
 * Anything else returns `0x0` — dimensions are prompt context, not
 * correctness, and a failed parse must never fail a write.
 */
export declare function readDimensions(bytes: Uint8Array, mime: string): {
    width: number;
    height: number;
};
/**
 * Write image bytes to the blob store, content-addressed.
 *
 * Idempotent: writing the same bytes twice rewrites the same file with
 * the same content, so a repeated call is a no-op on disk and returns
 * an identical `StoredImage`. Callers still dedupe at the NODE level
 * (same digest in the same namespace → one node) in `memory.ts`.
 *
 * @throws {@link ImageRejectedError} when the bytes are empty, an
 * unrecognised format, or above `maxBytes`.
 */
export declare function writeImage(bytes: Buffer | Uint8Array, declaredMime: string | undefined, root: string, maxBytes: number): StoredImage;
/** Read a blob back by ref. Returns null when it is missing. */
export declare function readImage(ref: string, root: string): Buffer | null;
/**
 * Resolve a ref to an on-disk path, tolerating any of the accepted
 * extensions (the format is recorded in the metadata, but the store
 * stays addressable by ref alone so a pack consumer holding only
 * `[img:…]` can still resolve it).
 */
export declare function resolveRef(ref: string, root: string): string | null;
/** Delete a blob by ref. Returns true when a file was removed. */
export declare function deleteRef(ref: string, root: string): boolean;
/**
 * Coarse classification from MIME type only.
 *
 * Deliberately NOT content analysis: `photo` vs `screenshot` cannot be
 * told apart from a header, and guessing would put a wrong label in
 * every image node. `chart`/`diagram`/`memo` are caller-declared via
 * `addImageMemory({ kind })`; the sniffed value is the safe default.
 */
export declare function kindFromMime(mime: string): ImageKind;
/**
 * Delete blobs that no live node references anymore.
 *
 * Called explicitly (never on a background timer) because eviction
 * (`forgetByDecay`, `archive`) deletes nodes, and a blob whose node is
 * gone is unreachable garbage. Returns how many files were removed so
 * maintenance commands can report it.
 */
export declare function purgeOrphanImages(root: string, liveRefs: ReadonlySet<string>): number;
/** Size of a stored blob in bytes, or null when missing. */
export declare function imageSize(path: string): number | null;
/**
 * Normalize every accepted {@link ImageInput} shape into raw bytes plus
 * a declared MIME type.
 *
 * Resolution order matters: a `data:` URL is checked BEFORE a path
 * (both are strings), and base64-with-explicit-mime is checked before
 * the fetch path (both can be objects). Bytes pass through untouched —
 * the caller's `writeImage` sniffs the true format from the header
 * anyway, so a wrong declared MIME can never mislabel the blob.
 *
 * `file:` and `http(s):` URLs are fetched; everything else that looks
 * like a URL but isn't fetchable throws rather than being guessed at.
 */
export declare function normalizeImageInput(input: ImageInput): Promise<{
    bytes: Buffer;
    mime: string | undefined;
}>;
//# sourceMappingURL=store.d.ts.map