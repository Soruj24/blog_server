/**
 * Dev runner without native binaries.
 *
 * `tsx watch` needs esbuild.exe, and `typescript@7` ships a native tsc.exe — both
 * are blocked on this machine by Windows Smart App Control ("An Application
 * Control policy has blocked this file"), which surfaces as `spawn UNKNOWN`.
 *
 * This script does the same job with pure JavaScript tooling:
 *   1. `tsc --watch` compiles src -> dist on every change (typescript@5 is JS)
 *   2. `node --watch dist/index.js` restarts the server when dist changes
 *
 * Usage: node scripts/dev.mjs
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tscEntry = path.join(root, "node_modules", "typescript", "lib", "tsc.js");
const entryPoint = path.join(root, "dist", "index.js");
const FIRST_COMPILE_TIMEOUT_MS = 180_000;

if (!existsSync(tscEntry)) {
  console.error("[dev] typescript is not installed. Run: npm install");
  process.exit(1);
}

/** @type {import("node:child_process").ChildProcess[]} */
const children = [];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(code), 100);
}

function track(child) {
  children.push(child);
  child.on("exit", (code) => {
    if (!shuttingDown) shutdown(code ?? 0);
  });
  return child;
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("[dev] compiling with tsc --watch ...");

const tsc = track(
  spawn(
    process.execPath,
    [tscEntry, "-p", "tsconfig.json", "--watch", "--preserveWatchOutput", "--pretty", "false"],
    { cwd: root, stdio: ["ignore", "pipe", "inherit"] },
  ),
);

tsc.on("error", (error) => {
  console.error("[dev] could not start tsc:", error.message);
  shutdown(1);
});

/** Resolves once tsc has finished its first compilation (errors or not). */
let announceFirstCompile;
const firstCompile = new Promise((resolve) => {
  announceFirstCompile = resolve;
});
let sawFirstCompile = false;

tsc.stdout.setEncoding("utf8");
tsc.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  if (!sawFirstCompile && chunk.includes("Watching for file changes")) {
    sawFirstCompile = true;
    announceFirstCompile();
  }
});

const timedOut = new Promise((resolve) =>
  setTimeout(() => resolve("timeout"), FIRST_COMPILE_TIMEOUT_MS).unref(),
);
const tscExited = new Promise((resolve) => tsc.on("exit", () => resolve("exit")));

const reason = await Promise.race([firstCompile, timedOut, tscExited]);

if (shuttingDown) {
  // Nothing to do: a signal or a crash already started the shutdown.
} else if (reason === "exit") {
  console.error("[dev] tsc exited before the first compilation finished.");
  shutdown(1);
} else if (reason === "timeout") {
  console.error(`[dev] tsc did not finish within ${FIRST_COMPILE_TIMEOUT_MS / 1000}s.`);
  shutdown(1);
} else {
  console.log("[dev] starting node --watch dist/index.js");
  track(
    spawn(process.execPath, ["--watch", entryPoint], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    }),
  );
}
