/**
 * Redact secret-looking material from text before it reaches a log.
 *
 * Defense in depth for CodeQL js/clear-text-logging: the top-level CLI
 * catch-all logs `err.message`, and a future error message could echo a
 * cipher key, passphrase, or token. UUIDs (memory IDs) and ordinary words
 * are left alone so logs stay debuggable.
 *
 * @module @memos/redact
 */
export declare function redactSecrets(text: string): string;
//# sourceMappingURL=redact.d.ts.map