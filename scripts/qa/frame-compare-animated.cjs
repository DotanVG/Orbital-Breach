'use strict';
process.env.PLAYWRIGHT_BROWSERS_PATH = 'C:/Users/dotan/AppData/Local/ms-playwright';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { pathToFileURL } = require('url');
const { chromium } = require('C:/Users/dotan/terminals/local-agents/nova-ob-colliders/qa-tools/node_modules/playwright');

const OUT_DIR = 'C:/Users/dotan/terminals/local-agents/nova-ob-dot129';
const POSES = 'C:/Users/dotan/terminals/local-agents/nova-ob-shotcost/qa/browser-poses.json';
const CHROME = 'C:/Users/dotan/AppData/Local/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe';

function gitSha(root) {
  try { return execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}

const VERSIONS = {
  stagingMesh: {
    label: 'pre-merge staging mesh (86012ba, no query reuse)',
    root: 'C:/Users/dotan/src/ob-dot129-staging-mesh',
    kind: 'mesh',
  },
  headDot129: {
    label: 'PR 238 head mesh (2c961b7, query reuse)',
    root: 'C:/Users/dotan/src/ob-dot129-hit-perf',
    kind: 'mesh',
  },
};

const WARMUP = 40;
const TICKS = 240;
const REPEATS = 3;
const CASES = [
  ['hit', 1],
  ['miss', 1],
  ['hit', 10],
  ['miss', 10],
];

function stats(v) {
  const s = [...v].sort((a, b) => a - b);
  return {
    n: s.length,
    meanMs: s.reduce((a, b) => a + b, 0) / s.length,
    p95Ms: s[Math.ceil(s.length * 0.95) - 1],
    p99Ms: s[Math.ceil(s.length * 0.99) - 1],
  };
}

const meshEntry = `import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { lazyHitSurfaces } from '/src/player/hitSurface.ts';
import { ProjectileSystem } from '/src/game/projectileSystem.ts';
import { PlayerAnimationController, ANIM_FLOAT } from '/src/player/playerAnimationController.ts';
import { applyFloatArmTilt } from '/src/player/playerAimPose.ts';
import { ALIEN_OFFSET_Y, ALIEN_OFFSET_Z, ALIEN_ROTATION_Y, ALIEN_SCALE } from '/src/player/alienTransform.ts';

const data = await (await fetch('/__poses')).json();
const loader = new GLTFLoader();

async function loadRig(url) {
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;
  root.scale.setScalar(ALIEN_SCALE);
  root.position.set(0, ALIEN_OFFSET_Y, ALIEN_OFFSET_Z);
  root.rotation.y = ALIEN_ROTATION_Y;
  return { root, animations: gltf.animations };
}

const actors = [];
for (let i = 0; i < 8; i++) {
  const pose = new THREE.ObjectLoader().parse(data.groups[i]);
  pose.updateMatrixWorld(true);
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  pose.getWorldPosition(pos);
  pose.getWorldQuaternion(quat);
  const body = await loadRig('/models/Alien.glb');
  const helmet = await loadRig('/models/Alien_Helmet.glb');
  const wrapper = new THREE.Group();
  wrapper.add(body.root, helmet.root);
  wrapper.position.copy(pos);
  wrapper.quaternion.copy(quat);
  const animation = new PlayerAnimationController();
  animation.registerRig(body.root, body.animations);
  animation.registerRig(helmet.root, helmet.animations);
  animation.setTargetAnimation(ANIM_FLOAT);
  animation.tickMixers(1);
  animation.restoreFloatRightArmPose();
  applyFloatArmTilt(animation.getRigs());
  wrapper.updateMatrixWorld(true);
  actors.push({ wrapper, animation, getSurfaces: lazyHitSurfaces(wrapper) });
}

window.actors = actors;
window.THREE = THREE;
window.ProjectileSystem = ProjectileSystem;
window.advancePose = function(dt) {
  for (const a of actors) {
    a.animation.tickMixers(dt);
    a.animation.restoreFloatRightArmPose();
    applyFloatArmTilt(a.animation.getRigs());
    a.wrapper.updateMatrixWorld(true);
  }
};
window.headAim = function(i) {
  let head = null;
  actors[i].wrapper.traverse((n) => { if (n.isBone && n.name === 'Head' && !head) head = n; });
  const p = new THREE.Vector3();
  if (head) head.getWorldPosition(p);
  else actors[i].wrapper.getWorldPosition(p);
  return p;
};
window.makeTargets = function() {
  return actors.map((a, i) => ({
    id: String(i),
    team: i % 2,
    active: true,
    getSurfaces: a.getSurfaces,
  }));
};
window.ready = true;`;

async function measureVersion(key, repeat) {
  const ver = VERSIONS[key];
  let browser, server;
  const result = {
    version: key,
    label: ver.label,
    kind: ver.kind,
    root: ver.root,
    commit: gitSha(ver.root),
    animated: true,
    phase: 'FLOATING',
    mixerDt: 1 / 60,
    repeat,
    headless: true,
    cpuThrottleRate: 4,
    warmup: WARMUP,
    ticks: TICKS,
    errors: [],
  };
  try {
    const { createServer } = await import(pathToFileURL(ver.root + '/client/node_modules/vite/dist/node/index.js').href);
    server = await createServer({
      root: ver.root + '/client',
      configLoader: 'runner',
      server: { host: '127.0.0.1', port: 0 },
      plugins: [{
        name: 'frame-anim-qa',
        configureServer(s) {
          s.middlewares.use((req, res, next) => {
            if (req.url === '/__poses') {
              res.setHeader('Content-Type', 'application/json');
              return res.end(fs.readFileSync(POSES));
            }
            if (req.url === '/__shot-qa') {
              res.setHeader('Content-Type', 'text/html');
              return res.end('<html><body><script type="module" src="/__shot-entry.js"></script></body></html>');
            }
            next();
          });
        },
        resolveId(id) { if (id === '/__shot-entry.js') return 'virtual:shot-qa'; },
        load(id) { if (id === 'virtual:shot-qa') return meshEntry; },
      }],
    });
    await server.listen();
    browser = await chromium.launch({
      headless: true,
      executablePath: CHROME,
    });
    const page = await browser.newPage();
    page.on('pageerror', (e) => result.errors.push(String(e)));
    await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/__shot-qa');
    await page.waitForFunction(() => window.ready, null, { timeout: 180000 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    result.browser = await browser.version();
    result.update = await page.evaluate(({ warmup, ticks, cases }) => {
      const out = {};
      for (const [mode, fireEvery] of cases) {
        const system = new ProjectileSystem(new THREE.Scene());
        const frames = [];
        let actorHits = 0, spawnedShots = 0;
        const zoneShares = {};
        for (let t = -warmup; t < ticks; t++) {
          window.advancePose(1 / 60);
          const targets = window.makeTargets();
          if (t % fireEvery === 0) {
            for (let i = 0; i < 8; i++) {
              if (t >= 0) spawnedShots++;
              const aim = window.headAim((i + 1) % 8).clone();
              aim.z -= 0.4;
              if (mode === 'miss') aim.y += 4;
              system.spawn(aim, new THREE.Vector3(0, 0, 1), i % 2, String(i));
            }
          }
          const s = performance.now();
          system.update(1 / 60, [], [], targets, () => {}, (hit) => {
            if (t >= 0) {
              actorHits++;
              const z = hit && hit.zone ? String(hit.zone) : 'unknown';
              zoneShares[z] = (zoneShares[z] || 0) + 1;
            }
          });
          if (t >= 0) frames.push(performance.now() - s);
        }
        system.clear();
        const sorted = [...frames].sort((a, b) => a - b);
        const st = {
          n: sorted.length,
          meanMs: sorted.reduce((a, b) => a + b, 0) / sorted.length,
          p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
          p99Ms: sorted[Math.ceil(sorted.length * 0.99) - 1],
        };
        out[mode + '_every' + fireEvery] = {
          perFrame: st,
          amortizedMeanMsPerSpawnedShot: frames.reduce((a, b) => a + b, 0) / spawnedShots,
          actorHits,
          spawnedShots,
          zoneShares,
          fireEveryFrames: fireEvery,
          players: 8,
          dt: 1 / 60,
          frames,
        };
      }
      return out;
    }, { warmup: WARMUP, ticks: TICKS, cases: CASES });
    result.status = result.errors.length ? 'failed' : 'passed';
  } catch (e) {
    result.status = 'blocked';
    result.failure = e.stack || String(e);
  } finally {
    await browser?.close();
    await server?.close();
  }
  return result;
}

function aggregate(runs) {
  const cases = {};
  for (const run of runs) {
    if (!run.update) continue;
    for (const [name, data] of Object.entries(run.update)) {
      if (!cases[name]) cases[name] = { frames: [], actorHits: 0, spawnedShots: 0, zoneShares: {}, repeats: [] };
      cases[name].frames.push(...data.frames);
      cases[name].actorHits += data.actorHits;
      cases[name].spawnedShots += data.spawnedShots;
      if (data.zoneShares) {
        for (const [z, n] of Object.entries(data.zoneShares)) {
          cases[name].zoneShares[z] = (cases[name].zoneShares[z] || 0) + n;
        }
      }
      cases[name].repeats.push({
        repeat: run.repeat,
        perFrame: data.perFrame,
        actorHits: data.actorHits,
        spawnedShots: data.spawnedShots,
        zoneShares: data.zoneShares,
        amortizedMeanMsPerSpawnedShot: data.amortizedMeanMsPerSpawnedShot,
      });
    }
  }
  const out = {};
  for (const [name, c] of Object.entries(cases)) {
    out[name] = {
      perFrame: stats(c.frames),
      amortizedMeanMsPerSpawnedShot: c.frames.reduce((a, b) => a + b, 0) / c.spawnedShots,
      actorHits: c.actorHits,
      spawnedShots: c.spawnedShots,
      zoneShares: c.zoneShares,
      fireEveryFrames: Number(name.split('every')[1]),
      players: 8,
      dt: 1 / 60,
      repeats: c.repeats,
    };
  }
  return out;
}

(async () => {
  fs.mkdirSync(path.join(OUT_DIR, 'qa-animated'), { recursive: true });
  const order = ['stagingMesh', 'headDot129'];
  const runs = [];
  const started = new Date().toISOString();
  const headSha = gitSha(VERSIONS.headDot129.root);
  const baseSha = gitSha(VERSIONS.stagingMesh.root);
  for (let r = 0; r < REPEATS; r++) {
    for (const key of order) {
      console.error('BEGIN', key, 'repeat', r, new Date().toISOString());
      const one = await measureVersion(key, r);
      console.error('END', key, 'repeat', r, one.status, one.failure ? one.failure.slice(0, 800) : JSON.stringify({
        commit: one.commit,
        cases: one.update && Object.fromEntries(Object.entries(one.update).map(([k, v]) => [k, { mean: v.perFrame.meanMs, p95: v.perFrame.p95Ms, p99: v.perFrame.p99Ms, hits: v.actorHits, zones: v.zoneShares }])),
      }));
      const slim = { ...one, update: one.update && Object.fromEntries(Object.entries(one.update).map(([k, v]) => {
        const { frames, ...rest } = v;
        return [k, rest];
      })) };
      fs.writeFileSync(path.join(OUT_DIR, 'qa-animated', `${key}-repeat${r}.json`), JSON.stringify({ ...one, update: slim.update }, null, 2));
      runs.push(one);
      if (one.status !== 'passed') {
        fs.writeFileSync(path.join(OUT_DIR, 'FRAME_COMPARE_ANIMATED.json'), JSON.stringify({ status: 'failed', started, runs: runs.map((x) => ({ version: x.version, repeat: x.repeat, status: x.status, failure: x.failure, errors: x.errors })) }, null, 2));
        process.exitCode = 1;
        return;
      }
    }
  }
  const byVersion = {};
  for (const key of order) {
    const subset = runs.filter((x) => x.version === key);
    byVersion[key] = {
      label: VERSIONS[key].label,
      kind: VERSIONS[key].kind,
      root: VERSIONS[key].root,
      commit: key === 'stagingMesh' ? baseSha : headSha,
      update: aggregate(subset),
    };
  }
  const ratios = {};
  for (const name of Object.keys(byVersion.headDot129.update)) {
    const a = byVersion.stagingMesh.update[name].perFrame;
    const b = byVersion.headDot129.update[name].perFrame;
    ratios[name] = {
      meanRatio: b.meanMs / a.meanMs,
      p95Ratio: b.p95Ms / a.p95Ms,
      p99Ratio: b.p99Ms / a.p99Ms,
      meanDeltaMs: b.meanMs - a.meanMs,
    };
  }
  const out = {
    status: 'passed',
    started,
    finished: new Date().toISOString(),
    method: 'Animated FLOATING follow-up to nova-ob-dot129/frame-compare.cjs. Same headless chrome-headless-shell, CDP 4x CPU throttle, performance.now around ProjectileSystem.update only (mixer.tick + matrix updates + target list construction are outside the timer). 8 actors loaded from /models/Alien.glb + Alien_Helmet.glb, placed at the recorded pose-group world transforms, PlayerAnimationController ANIM_FLOAT (Alien_Swimming) advanced with tickMixers(1/60) plus restoreFloatRightArmPose and applyFloatArmTilt every frame. Aims are the live Head bone (origin 0.4m on -Z, miss raised 4m), direction +Z, 8 synchronized shots, dt=1/60, 40 warmup + 240 measured frames, 3 interleaved repeats (pre-merge staging 86012ba then PR head 2c961b7).',
    cpuThrottleRate: 4,
    warmup: WARMUP,
    ticks: TICKS,
    repeats: REPEATS,
    animated: true,
    versions: byVersion,
    ratios_head_over_staging_mesh: ratios,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'FRAME_COMPARE_ANIMATED.json'), JSON.stringify(out, null, 2));
  const lines = [];
  lines.push('# Animated FLOATING frame time: pre-merge staging 86012ba vs PR 238 head ' + headSha.slice(0, 7));
  lines.push('');
  lines.push('Headless Chrome, CDP CPU throttle 4x, 8 players, Alien_Swimming mixer ticked every frame, ProjectileSystem.update only, 40+240 frames, 3 interleaved repeats.');
  lines.push('');
  lines.push('| Case | staging 86012ba mean / p95 / p99 (ms) | PR head mean / p95 / p99 (ms) | Mean delta (ms) | Mean ratio |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const name of ['hit_every1', 'miss_every1', 'hit_every10', 'miss_every10']) {
    const a = byVersion.stagingMesh.update[name].perFrame;
    const b = byVersion.headDot129.update[name].perFrame;
    const r = ratios[name];
    lines.push('| ' + name + ' | ' + a.meanMs.toFixed(3) + ' / ' + a.p95Ms.toFixed(3) + ' / ' + a.p99Ms.toFixed(3) + ' | ' + b.meanMs.toFixed(3) + ' / ' + b.p95Ms.toFixed(3) + ' / ' + b.p99Ms.toFixed(3) + ' | ' + r.meanDeltaMs.toFixed(3) + ' | ' + r.meanRatio.toFixed(3) + 'x |');
  }
  lines.push('');
  for (const name of ['hit_every1', 'miss_every1', 'hit_every10', 'miss_every10']) {
    const a = byVersion.stagingMesh.update[name];
    const b = byVersion.headDot129.update[name];
    lines.push(name + ' actorHits: staging ' + a.actorHits + '/' + a.spawnedShots + ', head ' + b.actorHits + '/' + b.spawnedShots);
    lines.push(name + ' zoneShares staging: ' + JSON.stringify(a.zoneShares || {}) + '; head: ' + JSON.stringify(b.zoneShares || {}));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'ANIMATED_SUMMARY.md'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
