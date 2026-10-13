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
import { execSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
export const GITHUB_REPO = "Markgatcha/memos";
/** Workflows that must all be green for a commit to count as "fully successful". */
export const REQUIRED_WORKFLOWS = ["CI", "Prebuilds", "CodeQL"];
/** How often the automatic beta notice may hit the network (cached otherwise). */
export const UPDATE_CHECK_INTERVAL_MS = 6 * 3600 * 1000;
/** Network timeout for update checks — never hang a CLI invocation. */
export const FETCH_TIMEOUT_MS = 8000;
/** How many source checkouts to keep under $MEMOS_HOME/beta. */
const KEEP_BETA_VERSIONS = 2;
async function gh(path, fetchImpl) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetchImpl(`https://api.github.com${path}`, {
            headers: {
                Accept: "application/vnd.github+json",
                "User-Agent": "memos-updater",
            },
            signal: ctrl.signal,
        });
        if (!res.ok) {
            throw new Error(`GitHub API ${res.status} for ${path}`);
        }
        return (await res.json());
    }
    finally {
        clearTimeout(timer);
    }
}
async function fetchLatestCommits(n, fetchImpl) {
    const data = await gh(`/repos/${GITHUB_REPO}/commits?sha=main&per_page=${n}`, fetchImpl);
    return data.map((c) => ({
        sha: c.sha,
        message: c.commit.message,
        date: c.commit.author?.date ?? "",
    }));
}
async function fetchRunsForSha(sha, fetchImpl) {
    const data = await gh(`/repos/${GITHUB_REPO}/actions/runs?head_sha=${sha}&per_page=100`, fetchImpl);
    return data.workflow_runs.map((r) => ({
        name: r.name,
        status: r.status,
        conclusion: r.conclusion,
    }));
}
/**
 * Pure check: is this set of workflow runs "fully successful"?
 * The GitHub API returns runs newest-first, so the first run per workflow
 * name is the latest. Every required workflow must have a latest run that
 * is completed with a success conclusion.
 */
export function isFullySuccessful(runs) {
    const latestByName = new Map();
    for (const run of runs) {
        if (!latestByName.has(run.name))
            latestByName.set(run.name, run);
    }
    return REQUIRED_WORKFLOWS.every((name) => {
        const run = latestByName.get(name);
        return !!run && run.status === "completed" && run.conclusion === "success";
    });
}
/**
 * Find the newest main commit whose CI, Prebuilds, and CodeQL runs are all
 * green. Walks back up to `maxCommits` (the newest commit may still have
 * jobs queued). Returns null when nothing qualifies — never throws for
 * network issues; callers decide how to report that.
 */
export async function findLatestGreenCommit(opts = {}) {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const maxCommits = opts.maxCommits ?? 10;
    const commits = await fetchLatestCommits(maxCommits, fetchImpl);
    for (const commit of commits) {
        const runs = await fetchRunsForSha(commit.sha, fetchImpl);
        if (isFullySuccessful(runs))
            return commit;
    }
    return null;
}
/** Where beta checkouts and the install marker live. */
export function memosHomeDir() {
    return process.env.MEMOS_HOME || join(process.env.HOME || "~", ".memos");
}
/**
 * Identify what's currently installed, for comparison against a green SHA.
 * Priority: $MEMOS_HOME/.install-ref (written by install.sh and updates),
 * then `git rev-parse HEAD` when running from a checkout, then the npm
 * package version as `npm:<version>`. Returns null when nothing is known.
 */
export function resolveInstalledRef(opts = {}) {
    const home = opts.memosHome ?? memosHomeDir();
    try {
        const refPath = join(home, ".install-ref");
        if (existsSync(refPath)) {
            const ref = readFileSync(refPath, "utf-8").trim();
            if (ref)
                return ref;
        }
    }
    catch {
        /* fall through */
    }
    try {
        const here = dirname(fileURLToPath(import.meta.url));
        const sha = execSync("git rev-parse HEAD", {
            cwd: join(here, ".."),
            stdio: ["ignore", "pipe", "ignore"],
            timeout: 5000,
        })
            .toString()
            .trim();
        if (/^[0-9a-f]{40}$/.test(sha))
            return sha;
    }
    catch {
        /* fall through */
    }
    try {
        const here = dirname(fileURLToPath(import.meta.url));
        const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf-8"));
        if (pkg.version)
            return `npm:${pkg.version}`;
    }
    catch {
        /* fall through */
    }
    return null;
}
export function readBetaState(configPath) {
    try {
        const raw = JSON.parse(readFileSync(configPath, "utf-8"));
        return {
            beta: raw["beta"] === true,
            ...(typeof raw["lastUpdateCheck"] === "number"
                ? { lastUpdateCheck: raw["lastUpdateCheck"] }
                : {}),
        };
    }
    catch {
        return { beta: false };
    }
}
/** Read-modify-write that preserves every other key in the config file. */
export function writeBetaState(configPath, patch) {
    let existing = {};
    try {
        existing = JSON.parse(readFileSync(configPath, "utf-8"));
    }
    catch {
        /* start fresh */
    }
    mkdirSync(dirname(configPath), { recursive: true });
    const next = { ...existing, ...patch };
    // Drop the beta key entirely when disabled so the file stays clean.
    if (patch.beta === false && !("lastUpdateCheck" in patch)) {
        delete next["beta"];
    }
    writeFileSync(configPath, JSON.stringify(next, null, 2) + "\n");
}
function defaultRunCmd(cmd, args, cwd) {
    execSync([cmd, ...args].map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" "), { cwd, stdio: "inherit" });
}
async function defaultDownload(url, destPath) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120_000);
    try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok || !res.body) {
            throw new Error(`download failed: ${res.status} for ${url}`);
        }
        await pipeline(res.body, createWriteStream(destPath));
    }
    finally {
        clearTimeout(timer);
    }
}
/** Find a pnpm we can build with: PATH first, then corepack. */
async function resolvePnpm(runCmd, cwd) {
    try {
        await runCmd("pnpm", ["--version"], cwd);
        return { cmd: "pnpm", prefixArgs: [] };
    }
    catch {
        /* try corepack */
    }
    try {
        await runCmd("corepack", ["pnpm", "--version"], cwd);
        return { cmd: "corepack", prefixArgs: ["pnpm"] };
    }
    catch {
        /* no pnpm available */
    }
    throw new Error("beta updates build from source and need pnpm: install it from https://pnpm.io/installation, then run `memos update` again.");
}
/**
 * Download the tarball for a green commit, `pnpm install` + `pnpm build` it,
 * and repoint $MEMOS_HOME/bin/memos at the fresh build. Writes
 * $MEMOS_HOME/.install-ref so future checks know what's installed. Keeps the
 * newest KEEP_BETA_VERSIONS checkouts and prunes older ones.
 */
export async function installFromCommit(sha, deps) {
    const { memosHome, nodeBin, runCmd, download } = deps;
    const betaDir = join(memosHome, "beta");
    const installDir = join(betaDir, sha);
    mkdirSync(betaDir, { recursive: true });
    const pnpm = await resolvePnpm(runCmd, tmpdir());
    const tarball = join(tmpdir(), `memos-beta-${sha.slice(0, 12)}-${Date.now()}.tar.gz`);
    try {
        await download(`https://github.com/${GITHUB_REPO}/archive/${sha}.tar.gz`, tarball);
        rmSync(installDir, { recursive: true, force: true });
        mkdirSync(installDir, { recursive: true });
        await runCmd("tar", ["-xzf", tarball, "-C", installDir, "--strip-components=1"], tmpdir());
        // The repo is pnpm-only (packageManager pin); mirror what CI does.
        await runCmd(pnpm.cmd, [...pnpm.prefixArgs, "install", "--frozen-lockfile"], installDir);
        await runCmd(pnpm.cmd, [...pnpm.prefixArgs, "build"], installDir);
        const cliJs = join(installDir, "dist", "cli.js");
        if (!existsSync(cliJs)) {
            throw new Error(`build did not produce ${cliJs}`);
        }
        // Repoint $MEMOS_HOME/bin/memos at the fresh build (same wrapper style
        // as scripts/install.sh's fallback path).
        const binDir = join(memosHome, "bin");
        mkdirSync(binDir, { recursive: true });
        const memosBin = join(binDir, "memos");
        writeFileSync(memosBin, `#!/bin/sh\nexec "${nodeBin}" "${cliJs}" "$@"\n`, {
            mode: 0o755,
        });
        writeFileSync(join(memosHome, ".install-ref"), sha + "\n");
        // Prune old checkouts, newest first.
        const entries = readdirSync(betaDir, { withFileTypes: true })
            .filter((e) => e.isDirectory() && /^[0-9a-f]{40}$/.test(e.name))
            .map((e) => e.name)
            .sort()
            .reverse();
        for (const old of entries.slice(KEEP_BETA_VERSIONS)) {
            rmSync(join(betaDir, old), { recursive: true, force: true });
        }
        return { installDir };
    }
    finally {
        rmSync(tarball, { force: true });
    }
}
//# sourceMappingURL=updater.js.map