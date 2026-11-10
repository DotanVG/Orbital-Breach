'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');

const repo = path.resolve(__dirname, '../..');
const head = path.resolve(process.env.OB_HARNESS_HEAD_ROOT || repo);
const outDir = path.resolve(process.env.OB_HARNESS_OUT_DIR || path.join(repo, 'dist/qa-animated'));
const poses = path.resolve(process.env.OB_HARNESS_POSES || path.join(__dirname, 'actor-placements.json'));
const requireFromClient = createRequire(path.join(head, 'client/package.json'));
const { chromium } = process.env.OB_HARNESS_PLAYWRIGHT ? require(path.resolve(process.env.OB_HARNESS_PLAYWRIGHT)) : requireFromClient('playwright');
const versions = {
  sphere: { root: path.resolve(process.env.OB_HARNESS_SPHERE_ROOT || path.join(repo, '../ob-tickbench-base')), kind: 'sphere', expected: '36f81cc' },
  staging: { root: path.resolve(process.env.OB_HARNESS_STAGING_ROOT || path.join(repo, '../ob-dot129-staging-5826a03')), kind: 'mesh', expected: '8e14f19' },
  head: { root: head, kind: 'mesh' },
};
const warmup = 40, ticks = 240, repeats = 3;
const cases = [['hit', 1], ['miss', 1], ['hit', 10], ['miss', 10]];

function stats(frames) {
  assert.equal(frames.length, ticks * repeats);
  const sorted = [...frames].sort((a, b) => a - b);
  return { mean: frames.reduce((a, b) => a + b, 0) / frames.length, p95: sorted[Math.ceil(frames.length * .95) - 1], p99: sorted[Math.ceil(frames.length * .99) - 1] };
}
async function measure(key, repeat) {
  const variant = versions[key];
  let server, browser;
  const errors = [];
  try {
    const { createServer } = await import(pathToFileURL(path.join(variant.root, 'client/node_modules/vite/dist/node/index.js')).href);
    const adapter = variant.kind === 'sphere'
      ? `import { projectileBodyTarget } from ${JSON.stringify('/@fs/' + variant.root.replaceAll('\\', '/') + '/shared/projectileCollider.ts')};
         function targetState() { return {}; }
         function targetFields(a) { const body=projectileBodyTarget(a.wrapper.position,a.wrapper.quaternion,'FLOATING'); return {pos:new THREE.Vector3().copy(body.center),radius:body.radius}; }`
      : `import { lazyHitSurfaces } from '/src/player/hitSurface.ts';
         function targetState(wrapper) { return {getSurfaces:lazyHitSurfaces(wrapper)}; }
         function targetFields(a) { return {getSurfaces:a.getSurfaces}; }`;
    const entry = fs.readFileSync(path.join(__dirname, 'animated-scene.mjs'), 'utf8').replace('__TARGET_IMPORT__', adapter);
    server = await createServer({
      root: path.join(variant.root, 'client'), configLoader: 'runner',
      server: { host: '127.0.0.1', port: 0 },
      plugins: [{
        name: 'animated-projectile-qa',
        configureServer(s) {
          s.middlewares.use((req, res, next) => {
            if (req.url === '/__poses') { res.setHeader('Content-Type', 'application/json'); return res.end(fs.readFileSync(poses)); }
            if (req.url === '/__shot-qa') { res.setHeader('Content-Type', 'text/html'); return res.end('<html><body><script type="module" src="/__shot-entry.js"></script></body></html>'); }
            next();
          });
        },
        resolveId(id) { if (id === '/__shot-entry.js') return 'virtual:animated-shot-qa'; },
        load(id) { if (id === 'virtual:animated-shot-qa') return entry; },
      }],
    });
    await server.listen();
    browser = await chromium.launch({ headless: true, ...(process.env.OB_HARNESS_CHROME ? { executablePath: path.resolve(process.env.OB_HARNESS_CHROME) } : {}) });
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__shot-qa`);
    await page.waitForFunction(() => window.ready, null, { timeout: 180000 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const update = await page.evaluate(settings => window.measure(settings), { warmup, ticks, cases });
    assert.deepEqual(errors, [], 'Browser errors');
    return { version: key, repeat, browser: await browser.version(), update };
  } finally {
    await browser?.close();
    await server?.close();
  }
}
async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  for (const v of Object.values(versions)) {
    v.commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: v.root, encoding: 'utf8', windowsHide: true }).trim();
    if (v.expected) assert.ok(v.commit.startsWith(v.expected), `Unexpected frozen commit: ${v.commit}`);
    v.dirty = !!execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: v.root, encoding: 'utf8', windowsHide: true }).trim();
    if (v.expected) assert.equal(v.dirty, false, 'Frozen variant must be clean');
  }
  const started = new Date().toISOString(), runs = [];
  // One benchmark invocation, three interleaved repeats. Never retry a target.
  for (let repeat = 0; repeat < repeats; repeat++) for (const key of Object.keys(versions)) {
    console.log(`BEGIN ${key} repeat ${repeat + 1}`);
    const run = await measure(key, repeat);
    runs.push(run);
    fs.writeFileSync(path.join(outDir, `${key}-repeat${repeat + 1}.json`), JSON.stringify(run, null, 2));
    console.log(`END ${key} repeat ${repeat + 1}`);
  }
  const aggregate = {};
  for (const key of Object.keys(versions)) {
    aggregate[key] = {};
    for (const [mode, every] of cases) {
      const name = `${mode}_every${every}`, data = runs.filter(r => r.version === key).map(r => r.update[name]);
      const zoneCounts = {};
      for (const d of data) for (const [zone, n] of Object.entries(d.zoneCounts)) zoneCounts[zone] = (zoneCounts[zone] ?? 0) + n;
      aggregate[key][name] = { ...stats(data.flatMap(d => d.frames)), actorHits: data.reduce((n, d) => n + d.actorHits, 0), spawnedShots: data.reduce((n, d) => n + d.spawnedShots, 0), zoneCounts };
    }
  }
  const sameCounts = (a, b) => a.actorHits === b.actorHits && a.spawnedShots === b.spawnedShots && JSON.stringify(Object.entries(a.zoneCounts).sort()) === JSON.stringify(Object.entries(b.zoneCounts).sort());
  const zoneParity = Object.keys(aggregate.head).every(name => sameCounts(aggregate.staging[name], aggregate.head[name]))
    && runs.filter(r => r.version === 'head').every(r => Object.keys(r.update).every(name => sameCounts(r.update[name], runs.find(s => s.version === 'staging' && s.repeat === r.repeat).update[name])));
  const acceptance = { hitEvery1P95: aggregate.head.hit_every1.p95 < 16.67, missEvery10Mean: aggregate.head.miss_every10.mean <= 1.04, zoneParity };
  const result = { started, finished: new Date().toISOString(), versions, warmup, ticks, repeats, cpuThrottleRate: 4, animated: true, aggregate, acceptance };
  fs.writeFileSync(path.join(outDir, 'FRAME_COMPARE_ANIMATED.json'), JSON.stringify(result, null, 2));
  const lines = ['# Animated FLOATING projectile comparison', '', 'Headless Chrome; CDP 4x CPU throttle; 8 actors; dt=1/60; Alien_Swimming plus both arm corrections every frame; 40 warmup + 240 measured frames; 3 interleaved repeats: sphere, staging, head. Only ProjectileSystem.update is timed.', '', '| Case | Sphere mean / p95 / p99 ms | Staging mesh mean / p95 / p99 ms | Head capsules mean / p95 / p99 ms |', '| --- | ---: | ---: | ---: |'];
  for (const name of Object.keys(aggregate.head)) {
    const cells = Object.keys(versions).map(key => { const d = aggregate[key][name]; return [d.mean, d.p95, d.p99].map(n => n.toFixed(3)).join(' / '); });
    lines.push(`| ${name} | ${cells.join(' | ')} |`);
  }
  lines.push('', '| Variant | Case | actorHits / shots | Zones |', '| --- | --- | ---: | --- |');
  for (const [key, data] of Object.entries(aggregate)) for (const [name, d] of Object.entries(data)) lines.push(`| ${key} | ${name} | ${d.actorHits} / ${d.spawnedShots} | ${JSON.stringify(d.zoneCounts)} |`);
  lines.push('', 'Sphere has no hit-zone field; its hits are recorded as unclassified.', '', `Staging/head zone and hit parity (each repeat and aggregate): ${zoneParity ? 'PASS' : 'FAIL'}.`, `Head hit_every1 p95 < 16.67 ms: ${acceptance.hitEvery1P95 ? 'PASS' : 'FAIL'}.`, `Head miss_every10 mean <= 1.04 ms: ${acceptance.missEvery10Mean ? 'PASS' : 'FAIL'}.`, '', ...Object.entries(versions).map(([key, v]) => `${key}: ${v.commit}${v.dirty ? ' (working tree changes)' : ''}`));
  fs.writeFileSync(path.join(outDir, 'ANIMATED_SUMMARY.md'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
