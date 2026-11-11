'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const output = path.resolve(process.env.BENCH_OUT || path.join(root, 'out/animated-mesh'));
const variants = process.env.BENCH_PROFILE ? [['staging', process.env.BENCH_STAGING]] : [
  ['staging', process.env.BENCH_STAGING], ['head', process.env.BENCH_HEAD || root],
];
const entry = fs.readFileSync(path.join(__dirname, 'animated-entry.js'), 'utf8');
const transforms = fs.readFileSync(process.env.BENCH_TRANSFORMS || path.join(__dirname, 'animated-transforms.json'));
const profile = Boolean(process.env.BENCH_PROFILE);
const sha = cwd => execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    p95: sorted[Math.ceil(sorted.length * .95) - 1], p99: sorted[Math.ceil(sorted.length * .99) - 1] };
}

// Diagnostic source instrumentation only, never writes into either measured tree.
// Timings are inclusive; subtract nested categories when reading the profile.
function instrument(code, id) {
  code = code.replaceAll('\r\n', '\n');
  const wrap = (open, close, name) => {
    const start = code.indexOf(open);
    if (start < 0) throw Error(`Profile anchor missing: ${name}`);
    const body = start + open.length, end = code.indexOf(close, body);
    if (end < 0) throw Error(`Profile end missing: ${name}`);
    code = code.slice(0, body) + `const __start=performance.now();try{` + code.slice(body, end) +
      `}finally{const p=globalThis.__profile;if(p){p.times['${name}']=(p.times['${name}']||0)+performance.now()-__start;p.calls['${name}']=(p.calls['${name}']||0)+1;}}` + code.slice(end);
  };
  const count = (anchor, name, amount = '1') => {
    if (!code.includes(anchor)) throw Error(`Count anchor missing: ${name}`);
    code = code.replace(anchor, anchor + `if(globalThis.__profile){const c=globalThis.__profile.counts;c['${name}']=(c['${name}']||0)+(${amount});}`);
  };
  if (id.endsWith('/player/hitSurface.ts')) {
    wrap('const prepare=()=>{', '\n  };', 'prepare');
    wrap('const query: HitSurfaceQuery=(start,end)=>{', '\n  };', 'query');
    wrap('if(!state.ready.has(c)) {', '\n        }', 'skin');
    wrap('function envelopeBounds(envelope: BoneEnvelope, matrices: Matrix4[], toWorld: Matrix4, bound=new Box3()): Box3 {', '\n}', 'envelope');
    count('for(const [bone,local] of envelope.boxes) {', 'boneBoxesTransformed');
    count('chunks.forEach((envelope,c)=>{', 'patchesScanned');
    count('meshes.forEach((mesh,m)=>{', 'meshesScanned');
    count('if(!segmentIntersectsBounds(start,end,bounds[m].min,bounds[m].max)) return;', 'meshesSurvived');
    count('// Topology/zone ownership is shared with the unoptimized sampler.\n', 'verticesAfterActorBounds', 'mesh.geometry.attributes.position.count');
    count('// Topology/zone ownership is shared with the unoptimized sampler.\n', 'trianglesAfterActorBounds', '(mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count)/3');
    count('// Topology/zone ownership is shared with the unoptimized sampler.\n', 'bonesAfterActorBounds', 'mesh.skeleton.bones.length');
    count('if(!segmentIntersectsBounds(start,end,bound.min,bound.max)) return;', 'patchesSurvived');
    code = code.replace('const surfaces: HitSurface[]=[],point=new Vector3();', 'const surfaces: HitSurface[]=[],point=new Vector3();const __bones=new Set();');
    code = code.replace('let cached=state.chunks.get(c);', 'for(const bone of envelope.boxes.keys()) __bones.add(m+":"+bone);let cached=state.chunks.get(c);');
    code = code.replace('    return surfaces;', '    if(globalThis.__profile){const c=globalThis.__profile.counts;c.bonesAfterPatchBounds=(c.bonesAfterPatchBounds||0)+__bones.size;}return surfaces;');
    count('skinnedVertexCount++;', 'verticesSkinned');
    count('surfaces.push(...cached);', 'trianglesSelected', 'cached[0].indices.length/3');
  }
  if (id.endsWith('/shared/projectileCollider.ts')) {
    wrap('export function segmentIntersectsBounds(start: Vec3, end: Vec3, min: Vec3, max: Vec3): boolean {', '\n}', 'aabb');
    code = code.replace('return lo<=hi;', `if(globalThis.__profile){const c=globalThis.__profile.counts;const k=lo<=hi?'aabbAccepted':'aabbRejected';c[k]=(c[k]||0)+1;}return lo<=hi;`);
    wrap('export function segmentHitSurface(start: Vec3, end: Vec3, surfaces: readonly HitSurface[]): SurfaceHit | null {', '\n}', 'triangles');
    code = code.replace('for (let i=patch.first;i<patch.first+patch.count;i+=3) {', `if(globalThis.__profile){const c=globalThis.__profile.counts;c.triangleTests=(c.triangleTests||0)+patch.count/3;}for (let i=patch.first;i<patch.first+patch.count;i+=3) {`);
  }
  if (id.endsWith('/game/projectileSystem.ts')) {
    count('for (const actor of actorTargets) {', 'actorsScanned');
    count('if (actor.id === projectile.getOwnerId()) continue;', 'actorsEligible');
    count('if (actor.getSurfaces.mayIntersect && !actor.getSurfaces.mayIntersect(oldPos, newPos)) continue;', 'actorsSurvived');
  }
  return code;
}

async function run(name, tree, repeat) {
  if (!tree) throw Error('BENCH_STAGING must name the frozen staging checkout');
  tree = path.resolve(tree);
  let server, browser;
  const errors = [];
  try {
    const { createServer } = await import(pathToFileURL(path.join(tree, 'client/node_modules/vite/dist/node/index.js')).href);
    server = await createServer({ root: path.join(tree, 'client'), configLoader: 'runner', cacheDir: path.join(output, `vite-${name}-${profile ? 'profile' : 'bench'}`),
      server: { host: '127.0.0.1', port: 0 }, plugins: [{
        name: 'animated-mesh-bench', enforce: 'pre',
        configureServer(s) { s.middlewares.use((req, res, next) => {
          if (req.url === '/__transforms') { res.setHeader('Content-Type', 'application/json'); res.end(transforms); }
          else if (req.url === '/__bench') { res.setHeader('Content-Type', 'text/html'); res.end('<script type="module" src="/__bench-entry.js"></script>'); }
          else next();
        }); },
        resolveId(id) { if (id === '/__bench-entry.js') return '\0bench-entry'; },
        load(id) { if (id === '\0bench-entry') return entry; },
        transform(code, id) { if (profile) return instrument(code, id.replaceAll('\\', '/')); },
      }] });
    await server.listen();
    const { chromium } = require(process.env.BENCH_PLAYWRIGHT || 'playwright');
    browser = await chromium.launch({ headless: true, ...(process.env.BENCH_CHROME ? { executablePath: process.env.BENCH_CHROME } : {}) });
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    const failedResponse = new Promise((_, reject) => page.on('response', response => {
      if (response.status() >= 400) reject(Error(`HTTP ${response.status()}: ${response.url()}`));
    }));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__bench`);
    await Promise.race([page.waitForFunction(() => window.ready, null, { timeout: 180000 }), failedResponse]);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const cases = await page.evaluate(opts => window.measure(opts), { warmup: 40, frames: 240, profile });
    if (errors.length) throw Error(errors.join('\n'));
    const source = createHash('sha256');
    for (const file of ['client/src/player/hitSurface.ts', 'client/src/player/boneTriangleLists.ts', 'client/src/game/projectileSystem.ts', 'shared/projectileCollider.ts']) {
      source.update(file); if (fs.existsSync(path.join(tree, file))) source.update(fs.readFileSync(path.join(tree, file)));
    }
    return { name, repeat, commit: sha(tree), sourceHash: source.digest('hex'), browser: await browser.version(), cases };
  } finally { await browser?.close(); await server?.close(); }
}
module.exports = { stats };
if (require.main === module) (async () => {
  fs.mkdirSync(output, { recursive: true });
  const runs = [];
  for (let repeat = 0; repeat < (profile ? 1 : 3); repeat++) for (const [name, tree] of variants) {
    console.log('Measuring', name, repeat, profile ? '(instrumented profile)' : '');
    const result = await run(name, tree, repeat);
    runs.push(result);
    fs.writeFileSync(path.join(output, `${profile ? 'profile' : 'bench'}-${name}-${repeat}.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(Object.fromEntries(Object.entries(result.cases).map(([key, c]) => [key, { ...stats(c.times), actorHits: c.actorHits, zones: c.zones, profile: c.profile }]))));
  }
  const summary = {};
  for (const [name] of variants) {
    summary[name] = {};
    for (const key of Object.keys(runs[0].cases)) {
      const cases = runs.filter(r => r.name === name).map(r => r.cases[key]);
      const zones = {};
      for (const c of cases) for (const [z, count] of Object.entries(c.zones)) zones[z] = (zones[z] || 0) + count;
      summary[name][key] = { ...stats(cases.flatMap(c => c.times)), actorHits: cases.reduce((n, c) => n + c.actorHits, 0),
        shots: cases.reduce((n, c) => n + c.shots, 0), skinnedVertices: cases.reduce((n, c) => n + c.skinnedVertices, 0), zones };
    }
  }
  fs.writeFileSync(path.join(output, profile ? 'profile-summary.json' : 'summary.json'), JSON.stringify(summary, null, 2));
})().catch(e => { console.error(e); process.exitCode = 1; });
