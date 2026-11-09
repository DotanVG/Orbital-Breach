#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const EXPECTED_VERSION = "0.9.30";
const GRAPHIFY_DISTRIBUTION = `graphifyy==${EXPECTED_VERSION}`;
const DEFAULT_QUERY_BUDGET = "1600";

const repoRoot = findRepoRoot();
const graphOut = join(repoRoot, "graphify-out");
const graphPath = join(graphOut, "graph.json");
const metadataPath = join(graphOut, "project-metadata.json");

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
  "package.json",
  "client/package.json",
  "client/tsconfig.json",
  "client/vite.config.ts",
  "server/package.json",
  "server/tsconfig.json",
  "tsconfig.test.json",
  "vitest.config.ts",
  "vercel.json",
];

process.chdir(repoRoot);

const [command = "help", ...commandArgs] = process.argv.slice(2);

try {
  assertLocalArguments(commandArgs);
  switch (command) {
    case "build":
      buildGraph(commandArgs);
      break;
    case "update":
      updateGraph(commandArgs);
      break;
    case "query":
      queryGraph(commandArgs);
      break;
    case "path":
      graphCommand("path", commandArgs, 2);
      break;
    case "explain":
      graphCommand("explain", commandArgs, 1);
      break;
    case "cluster":
      clusterGraph(commandArgs);
      break;
    case "watch":
      graphCommand("watch", [".", ...commandArgs], 0, { record: false });
      break;
    case "status":
      printStatus();
      break;
    case "check":
      checkIntegration();
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      fail(`Unknown command "${command}". Run "node scripts/graphify.mjs help".`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

function buildGraph(args) {
  const started = Date.now();
  const tool = resolveGraphify({ allowEphemeral: true });
  backupExistingGraph();

  const requestedBackend = optionValue(args, "--backend");
  const forcedCodeOnly = args.includes("--code-only");
  if (requestedBackend && forcedCodeOnly) {
    throw new Error("Choose either --code-only or --backend, not both.");
  }
  const autoClaude = !requestedBackend && !forcedCodeOnly && hasExecutable("claude");
  const backend = requestedBackend || (autoClaude ? "claude-cli" : null);
  let mode = forcedCodeOnly ? "code-only" : backend ? `semantic-${backend}` : "code-only";

  const extraArgs = withoutFlag(args, "--force");
  let extractArgs = ["extract", ".", "--force", ...extraArgs];
  if (!requestedBackend && !forcedCodeOnly) {
    extractArgs.push(...(backend ? ["--backend", backend] : ["--code-only"]));
  }

  let extractStatus = runGraphify(tool, extractArgs, { allowFailure: autoClaude });
  if (extractStatus !== 0 && autoClaude) {
    console.warn(
      "[graphify] Claude CLI semantic extraction failed; retrying the full build with deterministic code-only extraction.",
    );
    mode = "code-only-fallback";
    extractArgs = [
      "extract",
      ".",
      "--force",
      ...removeBackendOptions(extraArgs),
      "--code-only",
    ];
    extractStatus = runGraphify(tool, extractArgs, { allowFailure: false });
  }

  if (extractStatus !== 0) {
    throw new Error(`Graphify extraction exited with status ${extractStatus}.`);
  }
  const extractionTokens = analysisTokenUsage();

  const clusterArgs = ["cluster-only", "."];
  if (backend && mode !== "code-only-fallback") {
    clusterArgs.push("--backend", backend);
  }
  let clusterStatus = runGraphify(tool, clusterArgs, {
    allowFailure: Boolean(backend),
  });
  if (clusterStatus !== 0 && backend) {
    console.warn(
      "[graphify] Semantic community labeling failed; retrying deterministic local clustering.",
    );
    clusterStatus = runGraphify(tool, ["cluster-only", "."], {
      allowFailure: false,
    });
  }
  if (clusterStatus !== 0) {
    throw new Error(`Graphify clustering exited with status ${clusterStatus}.`);
  }

  recordMetadata(tool, {
    operation: "build",
    extractionMode: mode,
    durationSeconds: secondsSince(started),
    tokenUsage: combinedTokenUsage(extractionTokens, reportTokenUsage()),
  });
  printStatus();
}

function updateGraph(args) {
  requireGraph();
  const started = Date.now();
  const tool = resolveGraphify({ allowEphemeral: true });
  if (hasOption(args, "--force") || args.includes("--code-only")) {
    throw new Error(
      "Incremental updates preserve semantic documentation; use a full build "
        + "for an intentional forced or code-only rebuild.",
    );
  }
  const requestedBackend = optionValue(args, "--backend");
  const autoBackend = !requestedBackend;
  const backend = requestedBackend || (hasExecutable("claude") ? "claude-cli" : null);
  const extractArgs = ["extract", ".", ...args];
  if (!requestedBackend && backend) {
    extractArgs.push("--backend", backend, "--max-concurrency", "1");
  }
  const graphMtimeBefore = statSync(graphPath).mtimeMs;
  let status = runGraphify(tool, extractArgs, { allowFailure: autoBackend });

  if (status !== 0 && autoBackend) {
    console.warn(
      "[graphify] Manifest-gated extraction was unavailable; "
        + "falling back to Graphify's safe full-code AST update.",
    );
    status = runGraphify(tool, ["update", "."], { allowFailure: false });
    if (status !== 0) {
      throw new Error(`Graphify update exited with status ${status}.`);
    }
    recordMetadata(tool, {
      operation: "update",
      extractionMode: "native-full-code-ast-update-fallback",
      durationSeconds: secondsSince(started),
    });
    printStatus();
    return;
  }
  if (status !== 0) {
    throw new Error(`Graphify incremental update exited with status ${status}.`);
  }
  const extractionTokens = analysisTokenUsage();
  const graphChanged = statSync(graphPath).mtimeMs > graphMtimeBefore;

  if (graphChanged) {
    const clusterArgs = ["cluster-only", "."];
    if (backend) clusterArgs.push("--backend", backend);
    let clusterStatus = runGraphify(tool, clusterArgs, {
      allowFailure: autoBackend && Boolean(backend),
    });
    if (clusterStatus !== 0 && autoBackend && backend) {
      console.warn(
        "[graphify] Semantic community labeling failed; "
          + "retrying deterministic local clustering.",
      );
      clusterStatus = runGraphify(tool, ["cluster-only", "."], {
        allowFailure: false,
      });
    }
    if (clusterStatus !== 0) {
      throw new Error(`Graphify clustering exited with status ${clusterStatus}.`);
    }
  } else {
    console.log(
      "[graphify] Manifest found no changed inputs; "
        + "report and HTML were left untouched.",
    );
  }

  recordMetadata(tool, {
    operation: "update",
    extractionMode: "manifest-gated-incremental-ast-and-semantic-docs",
    durationSeconds: secondsSince(started),
    tokenUsage: combinedTokenUsage(
      extractionTokens,
      graphChanged ? reportTokenUsage() : null,
    ),
  });
  printStatus();
}

function queryGraph(args) {
  requireGraph();
  if (args.length === 0 || args[0].startsWith("-")) {
    throw new Error('Usage: node scripts/graphify.mjs query "<question>" [--dfs] [--budget N]');
  }
  const requestedBudget = optionValue(args, "--budget");
  if (requestedBudget !== null) {
    const budget = Number(requestedBudget);
    if (!Number.isInteger(budget) || budget < 1 || budget > 4000) {
      throw new Error("Query budget must be an integer from 1 to 4000 tokens.");
    }
  }
  const bounded = hasOption(args, "--budget")
    ? args
    : [...args, "--budget", DEFAULT_QUERY_BUDGET];
  graphCommand("query", bounded, 1, { record: false });
}

function graphCommand(
  graphifyCommand,
  args,
  minimumArguments,
  { record = false } = {},
) {
  if (graphifyCommand !== "watch") {
    requireGraph();
  }
  const positionalCount = args.filter((arg) => !arg.startsWith("-")).length;
  if (positionalCount < minimumArguments) {
    throw new Error(
      `Not enough arguments for "${graphifyCommand}". Run "node scripts/graphify.mjs help".`,
    );
  }
  const started = Date.now();
  const tool = resolveGraphify({ allowEphemeral: true });
  const status = runGraphify(tool, [graphifyCommand, ...args], {
    allowFailure: false,
  });
  if (status !== 0) {
    throw new Error(`Graphify ${graphifyCommand} exited with status ${status}.`);
  }
  if (record && existsSync(graphPath)) {
    recordMetadata(tool, {
      operation: graphifyCommand,
      extractionMode: graphifyCommand,
      durationSeconds: secondsSince(started),
    });
  }
}

function clusterGraph(args) {
  requireGraph();
  const started = Date.now();
  const tool = resolveGraphify({ allowEphemeral: true });
  const status = runGraphify(tool, ["cluster-only", ".", ...args], {
    allowFailure: false,
  });
  if (status !== 0) {
    throw new Error(`Graphify cluster-only exited with status ${status}.`);
  }
  recordMetadata(tool, {
    operation: "cluster",
    extractionMode: "cluster-only",
    durationSeconds: secondsSince(started),
    tokenUsage: combinedTokenUsage(null, reportTokenUsage()),
  });
  printStatus();
}

function runGraphify(tool, args, { allowFailure }) {
  console.log(
    `[graphify] ${tool.mechanism}; graphify ${tool.version || "version unknown"}`,
  );
  const result = spawnSync(tool.command, [...tool.prefix, ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      GRAPHIFY_OUT: "graphify-out",
      GRAPHIFY_NO_TIPS: "1",
    },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) {
    if (allowFailure) {
      console.warn(`[graphify] ${result.error.message}`);
      return 1;
    }
    throw result.error;
  }
  const status = result.status ?? 1;
  if (status !== 0 && !allowFailure) {
    throw new Error(`Command exited with status ${status}: graphify ${args[0]}`);
  }
  return status;
}

function resolveGraphify({ allowEphemeral }) {
  const candidates = [];
  if (process.env.GRAPHIFY_EXECUTABLE) {
    candidates.push({
      command: process.env.GRAPHIFY_EXECUTABLE,
      prefix: [],
      mechanism: "GRAPHIFY_EXECUTABLE",
    });
  }

  const direct = executablePath("graphify");
  if (direct) {
    candidates.push({
      command: direct,
      prefix: [],
      mechanism: "PATH executable",
    });
  }

  for (const python of pythonCandidates()) {
    if (pythonHasGraphify(python.command, python.prefix)) {
      candidates.push({
        command: python.command,
        prefix: [...python.prefix, "-m", "graphify"],
        mechanism: python.mechanism,
        interpreter: pythonInterpreter(python.command, python.prefix),
      });
    }
  }

  const seen = new Set();
  const mismatched = [];
  for (const candidate of candidates) {
    const key = JSON.stringify([candidate.command, candidate.prefix]);
    if (seen.has(key)) continue;
    seen.add(key);
    const version = graphifyVersion(candidate.command, candidate.prefix);
    if (version) {
      const resolved = {
        ...candidate,
        version,
        executable: candidate.command,
        interpreter:
          candidate.interpreter || discoverInstalledGraphifyInterpreter(),
      };
      if (version === EXPECTED_VERSION) return resolved;
      mismatched.push(resolved);
    }
  }

  if (allowEphemeral && executablePath("uvx")) {
    return {
      command: executablePath("uvx"),
      prefix: ["--from", GRAPHIFY_DISTRIBUTION, "graphify"],
      mechanism: `uvx pinned fallback (${GRAPHIFY_DISTRIBUTION})`,
      version: EXPECTED_VERSION,
      executable: executablePath("uvx"),
      interpreter: null,
    };
  }
  if (allowEphemeral && executablePath("pipx")) {
    return {
      command: executablePath("pipx"),
      prefix: ["run", "--spec", GRAPHIFY_DISTRIBUTION, "graphify"],
      mechanism: `pipx run pinned fallback (${GRAPHIFY_DISTRIBUTION})`,
      version: EXPECTED_VERSION,
      executable: executablePath("pipx"),
      interpreter: null,
    };
  }

  if (mismatched.length) {
    const allowed = /^(1|true|yes)$/i.test(
      process.env.GRAPHIFY_ALLOW_UNVERIFIED_VERSION || "",
    );
    if (allowed) {
      console.warn(
        `[graphify] Intentionally using unverified Graphify ${mismatched[0].version}; expected ${EXPECTED_VERSION}.`,
      );
      return mismatched[0];
    }
    throw new Error(
      `Found Graphify ${mismatched[0].version}, but this workflow is verified with ${EXPECTED_VERSION}. `
        + `Install the pinned tool with uv tool install --reinstall "${GRAPHIFY_DISTRIBUTION}", `
        + `or set GRAPHIFY_ALLOW_UNVERIFIED_VERSION=1 only for an intentional compatibility test.`,
    );
  }

  throw new Error(
    `Graphify is not installed. Install the verified distribution with: uv tool install "${GRAPHIFY_DISTRIBUTION}"`,
  );
}

function pythonCandidates() {
  const candidates = [];
  const activeEnvironments = [
    ["VIRTUAL_ENV", process.env.VIRTUAL_ENV],
    ["CONDA_PREFIX", process.env.CONDA_PREFIX],
  ];
  for (const [label, directory] of activeEnvironments) {
    if (!directory) continue;
    const python = join(
      directory,
      process.platform === "win32" ? "Scripts" : "bin",
      process.platform === "win32" ? "python.exe" : "python",
    );
    if (existsSync(python)) {
      candidates.push({
        command: python,
        prefix: [],
        mechanism: `${label} Python module`,
      });
    }
  }

  const uv = executablePath("uv");
  if (uv) {
    const result = capture(uv, ["tool", "dir"]);
    if (result.ok && result.stdout.trim()) {
      const python = join(
        result.stdout.trim(),
        "graphifyy",
        process.platform === "win32" ? "Scripts" : "bin",
        process.platform === "win32" ? "python.exe" : "python",
      );
      if (existsSync(python)) {
        candidates.push({
          command: python,
          prefix: [],
          mechanism: "uv tool Python module",
        });
      }
    }
  }

  const pipx = executablePath("pipx");
  if (pipx) {
    const result = capture(pipx, [
      "environment",
      "--value",
      "PIPX_LOCAL_VENVS",
    ]);
    if (result.ok && result.stdout.trim()) {
      const python = join(
        result.stdout.trim(),
        "graphifyy",
        process.platform === "win32" ? "Scripts" : "bin",
        process.platform === "win32" ? "python.exe" : "python",
      );
      if (existsSync(python)) {
        candidates.push({
          command: python,
          prefix: [],
          mechanism: "pipx Python module",
        });
      }
    }
  }

  for (const executable of [
    process.env.PYTHON,
    executablePath("python"),
    executablePath("python3"),
  ]) {
    if (executable) {
      candidates.push({
        command: executable,
        prefix: [],
        mechanism: "Python module",
      });
    }
  }

  const pyLauncher = executablePath("py");
  if (pyLauncher) {
    candidates.push({
      command: pyLauncher,
      prefix: ["-3"],
      mechanism: "Windows py launcher module",
    });
  }
  return candidates;
}

function pythonHasGraphify(command, prefix) {
  return capture(command, [
    ...prefix,
    "-c",
    "import graphify; print(graphify.__file__)",
  ]).ok;
}

function pythonInterpreter(command, prefix) {
  const result = capture(command, [
    ...prefix,
    "-c",
    "import sys; print(sys.executable)",
  ]);
  return result.ok ? result.stdout.trim() : null;
}

function discoverInstalledGraphifyInterpreter() {
  for (const python of pythonCandidates()) {
    if (pythonHasGraphify(python.command, python.prefix)) {
      return pythonInterpreter(python.command, python.prefix);
    }
  }
  return null;
}

function graphifyVersion(command, prefix) {
  const result = capture(command, [...prefix, "--version"]);
  if (!result.ok) return null;
  const match = `${result.stdout}\n${result.stderr}`.match(
    /graphify\s+([0-9]+(?:\.[0-9]+){1,3})/i,
  );
  return match?.[1] || null;
}

function executablePath(name) {
  if (!name) return null;
  if (isAbsolute(name) && existsSync(name)) return realpathSync(name);
  const finder = process.platform === "win32" ? "where.exe" : "which";
  const result = capture(finder, [name]);
  if (!result.ok) return null;
  const first = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return first || null;
}

function hasExecutable(name) {
  return Boolean(executablePath(name));
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    ok: !result.error && result.status === 0,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function analysisTokenUsage() {
  const analysis = readJson(join(graphOut, ".graphify_analysis.json"), {});
  const input = Number(analysis?.tokens?.input);
  const output = Number(analysis?.tokens?.output);
  if (!Number.isFinite(input) && !Number.isFinite(output)) return null;
  return {
    input: Number.isFinite(input) ? input : 0,
    output: Number.isFinite(output) ? output : 0,
    measured: true,
  };
}

function reportTokenUsage() {
  const report = safeRead(join(graphOut, "GRAPH_REPORT.md"));
  const match = report.match(
    /Token cost:\s*([\d,]+)\s*input\s*[·|]\s*([\d,]+)\s*output/i,
  );
  if (!match) return null;
  return {
    input: Number(match[1].replaceAll(",", "")),
    output: Number(match[2].replaceAll(",", "")),
    measured: true,
  };
}

function combinedTokenUsage(extraction, communityLabeling) {
  const extract = extraction || { input: 0, output: 0, measured: false };
  const labels = communityLabeling || { input: 0, output: 0, measured: false };
  return {
    extraction: extract,
    communityLabeling: labels,
    total: {
      input: extract.input + labels.input,
      output: extract.output + labels.output,
      measured: extract.measured || labels.measured,
    },
  };
}

function recordMetadata(tool, run) {
  if (!existsSync(graphPath)) {
    throw new Error("Graphify completed without producing graphify-out/graph.json.");
  }
  mkdirSync(graphOut, { recursive: true });

  const graph = readJson(graphPath, {});
  const manifest = readJson(join(graphOut, "manifest.json"), {});
  const previous = readJson(metadataPath, null);
  const includedFiles = Object.keys(manifest)
    .map(normalizeManifestPath)
    .filter(Boolean)
    .sort();
  const included = new Set(includedFiles.map(normalizeSlash));
  const trackedFiles = gitLines(["ls-files", "-z"], "\0").map(normalizeSlash);
  const skippedTrackedFiles = trackedFiles
    .filter((file) => !included.has(file))
    .sort();
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const links = Array.isArray(graph.links)
    ? graph.links
    : Array.isArray(graph.edges)
      ? graph.edges
      : [];
  const communities = new Set(
    nodes
      .map((node) => node.community)
      .filter((community) => community !== null && community !== undefined),
  );
  const head = gitText(["rev-parse", "HEAD"]);
  const sourceDirty = relevantSourceDirty();
  const builtAtCommit = graph.built_at_commit || null;
  const needsUpdate = existsSync(join(graphOut, "needs_update"));
  const current =
    Boolean(builtAtCommit) &&
    builtAtCommit === head &&
    !sourceDirty &&
    !needsUpdate;
  const generatedAt = new Date().toISOString();
  const operationRecord = {
    ...run,
    recordedAt: generatedAt,
    tokenUsage: run.tokenUsage ?? null,
    gitCommit: head || null,
    workingTreeHadUncommittedSourceChanges: sourceDirty,
  };
  const fullBuild = run.operation === "build"
    ? operationRecord
    : previous?.fullBuild ?? null;

  const metadata = {
    schemaVersion: 1,
    generatedAt,
    graphify: {
      distribution: GRAPHIFY_DISTRIBUTION,
      executableName: "graphify",
      moduleName: "graphify",
      version: tool.version || null,
      expectedVersion: EXPECTED_VERSION,
      mechanism: tool.mechanism,
      executable: tool.executable || null,
      pythonInterpreter: tool.interpreter || null,
    },
    run: operationRecord,
    fullBuild,
    lastOperation: operationRecord,
    files: {
      includedCount: includedFiles.length,
      included: includedFiles,
      skippedTrackedCount: skippedTrackedFiles.length,
      skippedTracked: skippedTrackedFiles,
    },
    graph: {
      outputPath: graphOut,
      nodeCount: nodes.length,
      edgeCount: links.length,
      communityCount: communities.size,
      builtAtCommit,
      outputs: {
        json: existsSync(graphPath),
        html: existsSync(join(graphOut, "graph.html")),
        report: existsSync(join(graphOut, "GRAPH_REPORT.md")),
        manifest: existsSync(join(graphOut, "manifest.json")),
      },
    },
    tokens: fullBuild?.tokenUsage ?? operationRecord.tokenUsage,
    git: {
      commit: head || null,
      workingTreeHadUncommittedSourceChanges: sourceDirty,
    },
    localFileHashes: {
      "package.json": fileHash(join(repoRoot, "package.json")),
    },
    freshness: {
      needsUpdateMarker: needsUpdate,
      current,
      reason: freshnessReason({
        graphExists: true,
        builtAtCommit,
        head,
        sourceDirty,
        needsUpdate,
      }),
    },
  };
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

function printStatus() {
  const status = graphStatus();
  console.log(`Graph: ${status.graphExists ? "available" : "absent (optional)"}`);
  console.log(`Current: ${status.current ? "yes" : "no"}`);
  console.log(`Reason: ${status.reason}`);
  console.log(`Output ignored by Git: ${status.outputIgnored ? "yes" : "NO"}`);
  if (status.builtAtCommit) {
    console.log(`Graph commit: ${status.builtAtCommit}`);
  }
  if (status.head) {
    console.log(`Current commit: ${status.head}`);
  }
  if (status.metadata?.graph) {
    const graph = status.metadata.graph;
    console.log(
      `Graph size: ${graph.nodeCount ?? "?"} nodes, ${graph.edgeCount ?? "?"} edges, ${graph.communityCount ?? "?"} communities`,
    );
  }
  try {
    const tool = resolveGraphify({ allowEphemeral: false });
    console.log(
      `Graphify: ${tool.version} (${tool.mechanism})${tool.version !== EXPECTED_VERSION ? `; expected ${EXPECTED_VERSION}` : ""}`,
    );
    if (tool.interpreter) {
      console.log(`Python: ${tool.interpreter}`);
    }
  } catch {
    console.log(
      `Graphify: not installed (optional; install ${GRAPHIFY_DISTRIBUTION} to build or query)`,
    );
  }
}

function graphStatus() {
  const graphExists = existsSync(graphPath);
  const metadata = readJson(metadataPath, null);
  const head = gitText(["rev-parse", "HEAD"]);
  const sourceDirty = relevantSourceDirty();
  const needsUpdate = existsSync(join(graphOut, "needs_update"));
  const expectedPackageHash = metadata?.localFileHashes?.["package.json"];
  const localConfigChanged = Boolean(
    graphExists
      && (!expectedPackageHash
        || expectedPackageHash !== fileHash(join(repoRoot, "package.json"))),
  );
  let builtAtCommit = metadata?.graph?.builtAtCommit || null;
  if (!builtAtCommit && graphExists) {
    builtAtCommit = readJson(graphPath, {})?.built_at_commit || null;
  }
  const current =
    graphExists &&
    Boolean(builtAtCommit) &&
    builtAtCommit === head &&
    !sourceDirty &&
    !localConfigChanged &&
    !needsUpdate;
  return {
    graphExists,
    metadata,
    head,
    sourceDirty,
    localConfigChanged,
    needsUpdate,
    builtAtCommit,
    current,
    reason: freshnessReason({
      graphExists,
      builtAtCommit,
      head,
      sourceDirty,
      localConfigChanged,
      needsUpdate,
    }),
    outputIgnored: gitExitCode([
      "check-ignore",
      "--quiet",
      "--",
      "graphify-out/probe",
    ]) === 0,
  };
}

function freshnessReason({
  graphExists,
  builtAtCommit,
  head,
  sourceDirty,
  localConfigChanged = false,
  needsUpdate,
}) {
  const reasons = [];
  if (!graphExists) reasons.push("no local graph");
  if (graphExists && !builtAtCommit) reasons.push("generation commit is unknown");
  if (builtAtCommit && head && builtAtCommit !== head) {
    reasons.push("graph commit differs from HEAD");
  }
  if (sourceDirty) reasons.push("relevant source or documentation is modified");
  if (localConfigChanged) reasons.push("ignored root package.json changed");
  if (needsUpdate) reasons.push("Graphify reports a pending semantic update");
  return reasons.length ? reasons.join("; ") : "graph matches HEAD and relevant source is clean";
}

function checkIntegration() {
  const checks = [];
  const requiredFiles = [
    ".claude/skills/graphify/SKILL.md",
    ".agents/skills/graphify/SKILL.md",
    ".claude/settings.json",
    ".codex/config.toml",
    ".codex/hooks.json",
    ".graphifyignore",
    "scripts/graphify-session-start.cjs",
  ];
  for (const file of requiredFiles) {
    checks.push({
      ok: existsSync(join(repoRoot, file)),
      message: `${file} exists`,
    });
  }

  const adapter = safeRead(join(repoRoot, ".agents/skills/graphify/SKILL.md"));
  checks.push({
    ok: adapter.includes("../../../.claude/skills/graphify/SKILL.md"),
    message: "Codex adapter references the canonical Claude skill",
  });
  checks.push({
    ok: parseableJson(join(repoRoot, ".claude/settings.json")),
    message: "Claude settings are valid JSON",
  });
  checks.push({
    ok: parseableJson(join(repoRoot, ".codex/hooks.json")),
    message: "Codex hooks are valid JSON",
  });
  const codexConfig = safeRead(join(repoRoot, ".codex/config.toml"));
  checks.push({
    ok:
      /\bhooks\s*=\s*true\b/.test(codexConfig) &&
      /\bcodex_hooks\s*=\s*true\b/.test(codexConfig),
    message: "Codex enables canonical hooks and the current CLI compatibility alias",
  });
  checks.push({
    ok:
      gitExitCode([
        "check-ignore",
        "--quiet",
        "--",
        "graphify-out/probe",
      ]) === 0,
    message: "generated graph output is ignored",
  });

  let failed = false;
  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"}: ${check.message}`);
    failed ||= !check.ok;
  }

  if (existsSync(graphPath)) {
    try {
      const tool = resolveGraphify({ allowEphemeral: false });
      runGraphify(tool, ["check-update", "."], { allowFailure: true });
    } catch {
      console.log("WARN: Graphify is not installed; graph freshness check skipped.");
    }
  } else {
    console.log("PASS: local graph is absent and remains optional.");
  }
  printStatus();
  if (failed) process.exitCode = 1;
}

function backupExistingGraph() {
  if (!existsSync(graphPath)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const directory = join(
    tmpdir(),
    `graphify-${basename(repoRoot).replace(/[^a-z0-9_-]/gi, "-")}-${stamp}`,
  );
  cpSync(graphOut, directory, { recursive: true, errorOnExist: true });
  console.log(`[graphify] Existing local graph backed up to ${directory}`);
}

function relevantSourceDirty() {
  const result = capture("git", [
    "status",
    "--porcelain",
    "--untracked-files=normal",
    "--",
    ...relevantSourcePaths,
  ]);
  return !result.ok || Boolean(result.stdout.trim());
}

function requireGraph() {
  if (!existsSync(graphPath)) {
    throw new Error(
      'No local graph exists. Run "node scripts/graphify.mjs build" first, or continue ordinary work without Graphify.',
    );
  }
}

function normalizeManifestPath(file) {
  if (!file) return null;
  const value = String(file);
  if (!isAbsolute(value)) return normalizeSlash(value);
  const rel = relative(repoRoot, value);
  if (rel === ".." || rel.startsWith(`..${sep}`)) {
    return null;
  }
  return normalizeSlash(rel);
}

function normalizeSlash(file) {
  return String(file).replaceAll("\\", "/").replace(/^\.\//, "");
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function safeRead(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function fileHash(file) {
  try {
    return createHash("sha256").update(readFileSync(file)).digest("hex");
  } catch {
    return null;
  }
}

function parseableJson(file) {
  try {
    JSON.parse(readFileSync(file, "utf8"));
    return true;
  } catch {
    return false;
  }
}

function gitText(args) {
  const result = capture("git", args);
  return result.ok ? result.stdout.trim() : "";
}

function gitLines(args, separator = "\n") {
  const text = gitText(args);
  return text ? text.split(separator).filter(Boolean) : [];
}

function gitExitCode(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    windowsHide: true,
    stdio: "ignore",
  });
  return result.status ?? 1;
}

function findRepoRoot() {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0 || !result.stdout?.trim()) {
    throw new Error("Run this command from inside the Orbital Breach Git checkout.");
  }
  return resolve(result.stdout.trim());
}

function hasOption(args, name) {
  return args.some((arg) => arg === name || arg.startsWith(`${name}=`));
}

function assertLocalArguments(args) {
  const forbidden = [
    "--out",
    "--output",
    "--graph",
    "--global",
    "--no-gitignore",
    "--postgres",
    "--google-workspace",
    "--allow-partial",
  ];
  const hit = args.find((arg) =>
    forbidden.some((flag) => arg === flag || arg.startsWith(`${flag}=`)),
  );
  if (hit) {
    throw new Error(
      `${hit} is disabled by the repository wrapper so all graph input and output stay checkout-local.`,
    );
  }
}

function optionValue(args, name) {
  const equals = args.find((arg) => arg.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || null : null;
}

function withoutFlag(args, flag) {
  return args.filter((arg) => arg !== flag);
}

function removeBackendOptions(args) {
  const result = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--backend") {
      index += 1;
      continue;
    }
    if (arg.startsWith("--backend=")) continue;
    result.push(arg);
  }
  return result;
}

function secondsSince(started) {
  return Number(((Date.now() - started) / 1000).toFixed(3));
}

function printHelp() {
  console.log(`Orbital Breach Graphify workflow (${GRAPHIFY_DISTRIBUTION})

Usage:
  node scripts/graphify.mjs build [--code-only|--backend NAME]
  node scripts/graphify.mjs update [--force|--no-cluster]
  node scripts/graphify.mjs query "<question>" [--dfs] [--budget N]
  node scripts/graphify.mjs path "<source>" "<target>"
  node scripts/graphify.mjs explain "<node>"
  node scripts/graphify.mjs status
  node scripts/graphify.mjs check
  node scripts/graphify.mjs cluster
  node scripts/graphify.mjs watch

Build is a full, backed-up rebuild. Update is manifest-gated and incremental.
Query output is
bounded to ${DEFAULT_QUERY_BUDGET} tokens unless --budget is supplied. Generated output stays
under graphify-out/ and is never committed.`);
}

function fail(message) {
  console.error(`[graphify] ${message}`);
  process.exitCode = 1;
}
