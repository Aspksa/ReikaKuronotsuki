/**
 * Beta channel: track every fully-successful main commit.
 *
 * Users who opt in (`memos beta enable`) are prompted to update whenever a
 * new main commit lands with all required CI workflows green. `memos update`
 * installs that commit from source so beta users always run the latest
 * verified code — not just the latest npm publish.
 *
 * "Fully successful" = the latest runs of the CI, Prebuilds, and CodeQL
 * workflows for the commit are all completed with conclusion "success".
 * This mirrors the project's standing rule: never call a commit done until
 * its jobs are terminal and green.
 *
 * Network access is fail-open everywhere: a failed check never breaks a
 * memos command; it just skips the notice.
 *
 * @module @memos/updater
 */
export declare const GITHUB_REPO = "Markgatcha/memos";
/** Workflows that must all be green for a commit to count as "fully successful". */
export declare const REQUIRED_WORKFLOWS: readonly ["CI", "Prebuilds", "CodeQL"];
/** How often the automatic beta notice may hit the network (cached otherwise). */
export declare const UPDATE_CHECK_INTERVAL_MS: number;
/** Network timeout for update checks — never hang a CLI invocation. */
export declare const FETCH_TIMEOUT_MS = 8000;
export interface GreenCommit {
    sha: string;
    message: string;
    date: string;
}
interface WorkflowRun {
    name: string;
    status: string;
    conclusion: string | null;
}
/** Minimal fetch shape — loose enough for test doubles. */
export type FetchImpl = (url: string, init?: Record<string, unknown>) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
}>;
/**
 * Pure check: is this set of workflow runs "fully successful"?
 * The GitHub API returns runs newest-first, so the first run per workflow
 * name is the latest. Every required workflow must have a latest run that
 * is completed with a success conclusion.
 */
export declare function isFullySuccessful(runs: WorkflowRun[]): boolean;
/**
 * Find the newest main commit whose CI, Prebuilds, and CodeQL runs are all
 * green. Walks back up to `maxCommits` (the newest commit may still have
 * jobs queued). Returns null when nothing qualifies — never throws for
 * network issues; callers decide how to report that.
 */
export declare function findLatestGreenCommit(opts?: {
    fetchImpl?: FetchImpl;
    maxCommits?: number;
}): Promise<GreenCommit | null>;
/** Where beta checkouts and the install marker live. */
export declare function memosHomeDir(): string;
/**
 * Identify what's currently installed, for comparison against a green SHA.
 * Priority: $MEMOS_HOME/.install-ref (written by install.sh and updates),
 * then `git rev-parse HEAD` when running from a checkout, then the npm
 * package version as `npm:<version>`. Returns null when nothing is known.
 */
export declare function resolveInstalledRef(opts?: {
    memosHome?: string;
}): string | null;
export interface BetaState {
    beta: boolean;
    lastUpdateCheck?: number;
}
export declare function readBetaState(configPath: string): BetaState;
/** Read-modify-write that preserves every other key in the config file. */
export declare function writeBetaState(configPath: string, patch: Partial<BetaState>): void;
export interface InstallDeps {
    memosHome: string;
    nodeBin: string;
    /** Injectable for tests. Throws on non-zero exit. */
    runCmd: (cmd: string, args: string[], cwd: string) => void | Promise<void>;
    /** Injectable for tests. */
    download: (url: string, destPath: string) => Promise<void>;
}
/**
 * Download the tarball for a green commit, `pnpm install` + `pnpm build` it,
 * and repoint $MEMOS_HOME/bin/memos at the fresh build. Writes
 * $MEMOS_HOME/.install-ref so future checks know what's installed. Keeps the
 * newest KEEP_BETA_VERSIONS checkouts and prunes older ones.
 */
export declare function installFromCommit(sha: string, deps: InstallDeps): Promise<{
    installDir: string;
}>;
export {};
//# sourceMappingURL=updater.d.ts.map