#!/usr/bin/env node

"use strict";

const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { existsSync, readFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const relevantSourcePaths = [
  "client/src",
  "server/src",
  "shared",
  "tests",
  "docs",
  "AGENTS.md",
  "CLAUDE.md",
  "WORKFLOW.md",
  "README.md",
  "client/package.json",
  "client/tsconfig.json",
  "client/vite.config.ts",
  "server/package.json",
  "server/tsconfig.json",
  "tsconfig.test.json",
  "vitest.config.ts",
  "vercel.json",
];

try {
  const root = resolve(
    execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim(),
  );
  const output = join(root, "graphify-out");
  const graph = join(output, "graph.json");
  if (!existsSync(graph)) process.exit(0);

  const metadata = readSmallJson(join(output, "project-metadata.json"));
  const head = git(root, ["rev-parse", "HEAD"]).trim();
  const builtAtCommit = metadata?.graph?.builtAtCommit || null;
  const expectedPackageHash = metadata?.localFileHashes?.["package.json"];
  const packageChanged =
    !expectedPackageHash ||
    expectedPackageHash !== fileHash(join(root, "package.json"));
  const dirty = Boolean(
    git(root, [
      "status",
      "--porcelain",
      "--untracked-files=normal",
      "--",
      ...relevantSourcePaths,
    ]).trim(),
  );
  const mayBeStale =
    !builtAtCommit ||
    builtAtCommit !== head ||
    packageChanged ||
    dirty ||
    existsSync(join(output, "needs_update"));
  const freshness = mayBeStale
    ? " It may be stale; check status or update it before relying on it."
    : "";

  process.stdout.write(
    "A local Graphify graph is available. For unfamiliar, architectural, debugging, cross-cutting or likely multi-file work, query it before broad exploration; always verify authoritative source before editing." +
      freshness +
      "\n",
  );
} catch {
  // Optional local tooling must never interrupt a session.
  process.exit(0);
}

function git(root, args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1500,
    });
  } catch {
    return "";
  }
}

function readSmallJson(file) {
  try {
    const raw = readFileSync(file, "utf8");
    if (raw.length > 1024 * 1024) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function fileHash(file) {
  try {
    return createHash("sha256").update(readFileSync(file)).digest("hex");
  } catch {
    return null;
  }
}
