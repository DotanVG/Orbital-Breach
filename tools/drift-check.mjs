#!/usr/bin/env node
// Advisory phase-0 bootstrap shared by the three games; see PROVENANCE.md.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import console from 'node:console';
import process from 'node:process';

const profiles = {
  'BeatEmPie-Phaser': { package: 'beatempie-phaser', csp: 'vercel.json', eslint: 'eslint.config.js', analytics: 'public/analytics.js' },
  'Count-Dawn': { package: 'count-dawn', csp: 'vercel.json', eslint: 'eslint.config.js', analytics: 'public/analytics.js' },
  'Orbital-Breach': { package: 'orbital-breach-root', csp: 'vercel.json', eslint: null, analytics: 'client/public/analytics.js' },
};
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let findings = 0;

async function main() {
  const positional = args.filter((arg) => arg !== '--strict');
  const repoFlag = positional.indexOf('--repo');
  const explicitRepo = repoFlag === -1 ? undefined : positional.splice(repoFlag, 2)[1];
  if (positional.length !== 1 || positional[0].startsWith('--') || (repoFlag !== -1 && !explicitRepo)) {
    throw new Error('Usage: node tools/drift-check.mjs <sibling-path-or-url> [--repo Repo-Name] [--strict]');
  }
  const target = positional[0];
  const localPackage = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).name;
  const localRepo = Object.keys(profiles).find((name) => profiles[name].package === localPackage);
  if (!localRepo) throw new Error('Unknown local repository package name');

  let remote;
  let siblingRepo = explicitRepo;
  if (/^https?:\/\//.test(target)) {
    remote = new URL(target);
    if (remote.username || remote.password || remote.search || remote.hash) {
      throw new Error('Use a repository URL without credentials, query parameters or fragments');
    }
    const parts = remote.pathname.split('/').filter(Boolean);
    if (remote.hostname === 'github.com') {
      if (parts.length !== 2 || parts[0] !== 'DotanVG') throw new Error('GitHub URL must name a DotanVG sibling repository');
      siblingRepo ??= parts[1].replace(/\.git$/, '');
      remote = new URL(`https://raw.githubusercontent.com/DotanVG/${siblingRepo}/staging/`);
    } else {
      if (remote.hostname === 'raw.githubusercontent.com' && parts[0] === 'DotanVG') siblingRepo ??= parts[1];
      if (!remote.pathname.endsWith('/')) remote.pathname += '/';
    }
  } else {
    const siblingPackage = JSON.parse(await readFile(resolve(target, 'package.json'), 'utf8')).name;
    siblingRepo ??= Object.keys(profiles).find((name) => profiles[name].package === siblingPackage);
  }
  if (!Object.hasOwn(profiles, siblingRepo)) throw new Error('Unknown sibling; use --repo with one of the three repository names');
  if (siblingRepo === localRepo) throw new Error('Choose a different sibling repository');
  console.log(`${localRepo} vs ${siblingRepo}; LF-normalized text, advisory${strict ? ' (strict exit enabled)' : ''}`);

  for (const key of ['csp', 'eslint', 'analytics']) {
    const localPath = profiles[localRepo][key];
    const siblingPath = profiles[siblingRepo][key];
    if (!localPath || !siblingPath) {
      console.log(`SKIP ${key}: Orbital-Breach has no ESLint config; no equivalent to compare`);
      continue;
    }
    try {
      const local = (await readFile(resolve(root, localPath), 'utf8')).replace(/\r\n/g, '\n');
      let sibling;
      if (remote) {
        const response = await globalThis.fetch(new URL(siblingPath, remote), { signal: globalThis.AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        sibling = await response.text();
      } else sibling = await readFile(resolve(target, siblingPath), 'utf8');
      sibling = sibling.replace(/\r\n/g, '\n');
      if (local === sibling) {
        console.log(`SAME ${localPath} <-> ${siblingPath}`);
        continue;
      }
      findings++;
      const hash = (text) => createHash('sha256').update(text).digest('hex');
      console.log(`DIFF ${localPath} <-> ${siblingPath}\n  local SHA256 ${hash(local)}\n  sibling SHA256 ${hash(sibling)}`);
      const left = local.split('\n');
      const right = sibling.split('\n');
      let changed = 0;
      for (let i = 0; i < Math.max(left.length, right.length); i++) {
        if (left[i] === right[i]) continue;
        changed++;
        if (changed <= 8) console.log(`  line ${i + 1}\n  - ${left[i]?.slice(0, 180) ?? '<absent>'}\n  + ${right[i]?.slice(0, 180) ?? '<absent>'}`);
      }
      console.log(`  ${changed} differing line positions; preview limited to 8 positions / 180 characters per line`);
    } catch {
      findings++;
      console.log(`ERROR ${localPath} <-> ${siblingPath}: could not read comparison (check path, URL or network)`);
    }
  }
  console.log(`${findings} differing or unreadable file pair(s). Differences can be intentional; see PROVENANCE.md.`);
}

try { await main(); } catch (error) { findings++; console.error(error.message); }
process.exitCode = strict && findings ? 1 : 0;
