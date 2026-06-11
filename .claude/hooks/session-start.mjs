#!/usr/bin/env node
/**
 * SessionStart hook — Claude Code on the web only.
 *
 * The root package.json (vitest harness + concurrently) is deliberately
 * gitignored (see .gitignore: "Root-level dev tooling — not part of
 * deployable code"), so a fresh clone cannot run `npm test`. This hook
 * recreates it and installs root + client + server dependencies so tests
 * and typechecks work immediately in remote sessions.
 *
 * Local sessions exit immediately — developer machines manage their own
 * root package.json. Vercel never sees this file: vercel.json pins
 * installCommand/buildCommand to client/ only, and the file stays
 * untracked either way.
 */
import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

if (process.env.CLAUDE_CODE_REMOTE !== "true") {
  process.exit(0);
}

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// Keep in sync with the "Root harness package.json" section of docs/TESTING.md.
const harnessPackageJson = `{
  "name": "orbital-breach-root",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "concurrently \\"npm run dev --prefix server\\" \\"npm run dev --prefix client\\""
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "@vitest/coverage-v8": "^3.2.4",
    "concurrently": "^9.1.0",
    "vitest": "^3.2.4"
  }
}
`;

const rootPackageJson = join(root, "package.json");
if (!existsSync(rootPackageJson)) {
  writeFileSync(rootPackageJson, harnessPackageJson);
  console.log("session-start: created gitignored root package.json (vitest harness)");
}

function install(label, cwd) {
  console.log(`session-start: npm install (${label})`);
  execSync("npm install --no-audit --no-fund", { cwd, stdio: "inherit" });
}

install("root", root);
install("client", join(root, "client"));
install("server", join(root, "server"));

console.log("session-start: dependencies ready — `npm test` runs from the repo root");
