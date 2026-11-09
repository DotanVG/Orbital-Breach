#!/usr/bin/env node
/**
 * SessionStart hook — Claude Code on the web only.
 *
 * Installs root, client, and server dependencies so tests and typechecks
 * work immediately in remote sessions. The root package.json (vitest
 * harness + concurrently) is tracked. vercel.json pins installCommand and
 * buildCommand to client/, so Vercel does not build this harness.
 *
 * Local sessions exit immediately — developer machines install themselves.
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
  // Fallback only. The tracked package.json is the source of truth.
  writeFileSync(rootPackageJson, harnessPackageJson);
  console.log("session-start: restored missing root package.json (vitest harness)");
}

function install(label, cwd) {
  console.log(`session-start: npm install (${label})`);
  execSync("npm install --no-audit --no-fund", { cwd, stdio: "inherit" });
}

install("root", root);
install("client", join(root, "client"));
install("server", join(root, "server"));

console.log("session-start: dependencies ready — `npm test` runs from the repo root");
