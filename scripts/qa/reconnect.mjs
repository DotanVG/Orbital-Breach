// Real client + unchanged server, through a loopback-only TCP fault proxy.
// Build server first. Resolve Playwright via NODE_PATH if installed outside the repo.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { Client } = await import(pathToFileURL(require.resolve('@colyseus/sdk', { paths: [resolve(root, 'client')] })));
const { createServer } = await import(pathToFileURL(require.resolve('vite', { paths: [resolve(root, 'client')] })));
const { values } = parseArgs({ options: { out: { type: 'string' }, 'round1-only': { type: 'boolean', default: false } } });
assert(values.out, 'Usage: node scripts/qa/reconnect.mjs --out <artifact directory>');
const out = resolve(values.out);
await mkdir(out, { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await pause(50); }
  throw new Error('Timed out waiting for reconnect QA condition');
}
async function freePort() {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}

let serverProcess, vite, browser, observer, page;
let offline = false;
let protectNewConnections = true;
const connections = new Set();
const refusedAt = [];
const proxy = net.createServer(socket => {
  if (offline) { refusedAt.push(Date.now()); socket.destroy(); return; }
  const upstream = net.connect(serverPort, '127.0.0.1');
  const pair = { socket, upstream, protected: protectNewConnections };
  connections.add(pair);
  socket.on('error', () => upstream.destroy());
  upstream.on('error', () => socket.destroy());
  socket.on('close', () => { upstream.destroy(); connections.delete(pair); });
  upstream.on('close', () => socket.destroy());
  socket.pipe(upstream).pipe(socket);
});
const serverPort = await freePort();
const pageErrors = [];
const consoleErrors = [];
const result = { platform: process.platform, node: process.version };
try {
  proxy.listen(0, '127.0.0.1'); await once(proxy, 'listening');
  const proxyPort = proxy.address().port;
  serverProcess = spawn(process.execPath, ['server/dist/server/src/index.js'], {
    cwd: root, windowsHide: true,
    env: { ...process.env, NODE_ENV: 'development', PORT: String(serverPort), PUBLIC_ADDRESS: `127.0.0.1:${proxyPort}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Drain logs; assertions below provide the evidence without persisting room internals.
  serverProcess.stdout.resume(); serverProcess.stderr.resume();
  await until(async () => {
    if (serverProcess.exitCode !== null) throw new Error(`QA server exited ${serverProcess.exitCode}`);
    try { return (await fetch(`http://127.0.0.1:${serverPort}/health`)).ok; } catch { return false; }
  });
  observer = await new Client(`http://127.0.0.1:${proxyPort}`).create('orbital_browser_lobby', {
    name: 'Observer', listing: 'browser', visibility: 'private', teamSize: 2, roomName: 'Reconnect QA',
  });
  observer.onMessage('lobby_event', () => {});
  observer.onMessage('player_leave_event', () => {});
  observer.reconnection.enabled = false;
  await until(() => observer.state.members?.size === 1);
  protectNewConnections = false;
  vite = await createServer({
    configFile: false, root: resolve(root, 'client'),
    server: { host: '127.0.0.1', port: await freePort(), strictPort: true, open: false,
      proxy: { '/matchmake': { target: `http://127.0.0.1:${proxyPort}`, changeOrigin: true } } },
  });
  await vite.listen();
  const base = `http://127.0.0.1:${vite.httpServer.address().port}`;
  // WSL's inherited display variables select Wayland Vulkan extensions that
  // SwiftShader lacks. Keep this headless QA process independent of WSLg.
  const browserEnv = { ...process.env };
  if (process.platform === 'linux') {
    delete browserEnv.DISPLAY;
    delete browserEnv.WAYLAND_DISPLAY;
  }
  browser = await chromium.launch({ headless: true, env: browserEnv, args: ['--no-sandbox', '--use-angle=swiftshader'] });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => pageErrors.push(error.stack ?? error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500)); });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    // Abort browser matchmaking as a real network error. Vite's proxy would
    // synthesize HTTP 500, which correctly belongs to the fail-fast server path.
    if (offline && url.pathname.startsWith('/matchmake/')) { refusedAt.push(Date.now()); return route.abort('internetdisconnected'); }
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    return route.fulfill({ status: 200, body: '' });
  });
  await page.goto(`${base}/?embed=1&roomId=${observer.roomId}`);
  await page.locator('#menu-name').waitFor();
  await page.evaluate(async roomId => {
    // Embed startup cleans the URL; apply the invite after the menu is ready.
    history.replaceState(null, '', `/?roomId=${roomId}`);
    const { App } = await import('/src/game/gameApp.ts');
    const startOnline = App.prototype.startOnlineLobby;
    App.prototype.startOnlineLobby = function(...args) { window.qaApp = this; return startOnline.apply(this, args); };
    const { NetClient } = await import('/src/net/client.ts');
    const original = NetClient.prototype.connect;
    window.qaSnapshots = [];
    NetClient.prototype.connect = async function(options) {
      window.qaNet = this;
      const previous = this.onStateChange;
      this.onStateChange = snapshot => { window.qaSnapshots.push(snapshot); previous?.(snapshot); };
      let snapshot;
      try { snapshot = await original.call(this, options); }
      catch (error) { window.qaJoinError = { name:error.name, message:error.message, code:error.code }; throw error; }
      if (snapshot) window.qaSnapshots.push(snapshot);
      return snapshot;
    };
    Math.random = () => 0.5; // Measure the nominal 1s, 2s, 4s schedule deterministically.
  }, observer.roomId);
  if (!values['round1-only']) {
  await page.locator('#menu-name').fill('Reconnect Pilot');
  await page.locator('#btn-play-online').click();
  await page.waitForFunction(() => window.qaSnapshots.some(s => s.members.some(m => m.name === 'Reconnect Pilot')));
  const oldSession = await page.evaluate(() => window.qaNet.getSessionId());
  assert.equal(await page.locator('#connection-status').isVisible(), false);

  // Keep one real peer online so the unchanged server retains this room.
  offline = true;
  const droppedAt = Date.now();
  for (const pair of connections) if (!pair.protected) { pair.socket.destroy(); pair.upstream.destroy(); }
  await page.getByText('Reconnecting…', { exact: true }).waitFor();
  await page.screenshot({ path: resolve(out, 'reconnecting.png') });
  observer.send('set_team_size', { teamSize: 5 });
  await until(() => observer.state.teamSize === 5);
  // At 3.5s the 1s and 2s retries have failed; the 4s delay is pending.
  await pause(Math.max(0, droppedAt + 3500 - Date.now()));
  offline = false;
  await page.waitForFunction(({ roomId, oldSession }) => window.qaSnapshots.some(s =>
    s.roomId === roomId && s.sessionId !== oldSession && s.teamSize === 5
      && s.members.some(m => m.name === 'Reconnect Pilot')
      && !s.members.some(m => m.id === oldSession)), { roomId: observer.roomId, oldSession }, { timeout: 15000 });
  const restoredAt = Date.now();
  assert.equal(await page.locator('#connection-status').isVisible(), false);
  // Further patches must reach both NetClient and the real application lobby.
  observer.send('set_team_size', { teamSize: 2 });
  await page.waitForFunction(() => window.qaSnapshots.at(-1)?.teamSize === 2);
  const timings = refusedAt.map(t => t - droppedAt);
  assert(timings.some(t => t >= 800 && t <= 1600), `First retry outside 1s window: ${timings}`);
  assert(timings.some(t => t >= 2700 && t <= 3900), `Second retry outside 3s cumulative window: ${timings}`);
  assert(restoredAt - droppedAt >= 6500 && restoredAt - droppedAt < 11000, 'Third retry did not respect 4s delay');
  await page.screenshot({ path: resolve(out, 'reconnected.png') });
  // Let the full retry budget expire on a second drop, using real elapsed time.
  const secondDrop = Date.now();
  const refusedBefore = refusedAt.length;
  offline = true;
  for (const pair of connections) if (!pair.protected) { pair.socket.destroy(); pair.upstream.destroy(); }
  await page.getByText('Connection lost', { exact: true }).waitFor({ timeout: 150000 });
  const exhaustedAfterMs = Date.now() - secondDrop;
  const exhaustedAttempts = refusedAt.slice(refusedBefore).map(t => t - secondDrop);
  assert.equal(exhaustedAttempts.length, 8, 'Expected exactly eight reconnect attempts');
  assert(exhaustedAttempts[0] >= 800 && exhaustedAttempts[0] < 1600, 'Success did not reset backoff');
  await page.screenshot({ path: resolve(out, 'connection-lost.png') });
  await pause(1200);
  assert.equal(refusedAt.length, refusedBefore + 8, 'Retries continued after exhaustion');
  offline = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.waitForFunction(() => window.qaNet.getSessionId() !== null, null, { timeout: 5000 });
  assert.equal(await page.locator('#connection-status').isVisible(), false);
  await page.evaluate(() => window.qaNet.disconnect());
  const snapshotsAfterExit = await page.evaluate(() => window.qaSnapshots.length);
  await pause(1200);
  assert.equal(await page.evaluate(() => window.qaNet.getSessionId()), null);
  assert.equal(await page.evaluate(() => window.qaSnapshots.length), snapshotsAfterExit);
  assert.deepEqual(pageErrors, []);
  Object.assign(result, { pass: true, refusedAtMs: timings, restoredAfterMs: restoredAt - droppedAt,
    exhaustedAttemptsMs: exhaustedAttempts, exhaustedAfterMs, manualRetry: 'reconnected and notice cleared',
    stateResync: 'same room, new session; team size changed offline and subsequent patches received',
    cancellation: 'no reconnect after intentional exit', pageErrors });
  }

  const regressions = {};
  async function check(name, test) {
    try { await test(); regressions[name] = { pass: true }; }
    catch (error) { regressions[name] = { pass: false, error: error.message }; }
  }
  // Real App/NetClient integration; the unchanged server is behind the fault proxy.
  if (!values['round1-only']) await page.evaluate(() => window.qaApp.requestLeaveOnline('server_disconnect'));
  offline = true;
  await page.evaluate(roomId => history.replaceState(null, '', `/?roomId=${roomId}`), observer.roomId);
  await page.locator('#menu-name').fill('Retry Invite Pilot');
  await page.locator('#btn-play-online').click();
  await page.getByText(/^Reconnecting/).waitFor();
  await pause(1500); // First join and first retry fail; the next attempt succeeds.
  offline = false;
  await page.waitForFunction(() => window.qaNet?.getSessionId() !== null);
  await check('roomId cleared after retry success', async () => {
    assert.equal(await page.evaluate(() => new URLSearchParams(location.search).has('roomId')), false);
  });
  // Exhaust the already-unit-tested budget without another two-minute browser wait.
  await page.evaluate(() => { window.qaNet.attempts = 8; window.qaNet.scheduleReconnect(); });
  await page.getByText('Connection lost', { exact: true }).waitFor();
  await check('Back to menu exits and cancels retries', async () => {
    await page.getByRole('button', { name: 'Back to menu', exact: true }).click({ timeout: 2000 });
    await page.waitForFunction(() => window.qaApp.appMode === 'menu');
    assert.equal(await page.evaluate(() => window.qaNet.getSessionId()), null);
    assert.equal(await page.locator('#connection-status').isVisible(), false);
    const before = refusedAt.length;
    await pause(1200);
    assert.equal(refusedAt.length, before);
  });
  // Ensure independent evidence on old code even if Back to menu is absent there.
  await page.evaluate(() => window.qaApp.requestLeaveOnline('server_disconnect'));
  const invalidBefore = refusedAt.length;
  await page.evaluate(() => {
    history.replaceState(null, '', '/?roomId=invalid-invite');
    window.qaStatuses = [];
    const previous = window.qaNet.onConnectionStatus;
    window.qaNet.onConnectionStatus = status => { window.qaStatuses.push(status); previous?.(status); };
  });
  await page.locator('#btn-play-online').click();
  await pause(500);
  await check('invalid invite fails fast to menu with error and no reconnect', async () => {
    assert.equal(await page.evaluate(() => window.qaApp.appMode), 'menu');
    assert.equal(await page.evaluate(() => window.qaStatuses.includes('reconnecting')), false);
    assert.match(await page.locator('#connection-status').innerText(), /room|not found|invalid/i);
    assert.equal(refusedAt.length, invalidBefore);
  });
  await page.evaluate(() => window.qaApp.requestLeaveOnline('server_disconnect'));
  await page.evaluate(roomId => history.replaceState(null, '', `/?roomId=${roomId}`), observer.roomId);
  await page.locator('#btn-play-online').click();
  await page.waitForFunction(() => window.qaNet?.getSessionId() !== null);
  await page.evaluate(() => {
    window.qaStatuses = [];
    window.qaNet.room.connection.close(4000);
  });
  await pause(500);
  await check('consented socket close returns to menu with message and no retry', async () => {
    assert.equal(await page.evaluate(() => window.qaApp.appMode), 'menu');
    assert.equal(await page.evaluate(() => window.qaStatuses.includes('reconnecting')), false);
    assert.match(await page.locator('#connection-status').innerText(), /server closed/i);
  });
  await page.evaluate(() => window.qaApp.requestLeaveOnline('server_disconnect'));
  // Check actual HUD/lobby/menu/scoreboard placement at phone sizes in both orientations.
  const layouts = [];
  for (const [width, height] of [[360,800],[390,844],[430,932],[800,360],[844,390],[932,430]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => {
      const app = window.qaApp;
      app.menu.hide();
      app.sessionMenu.setLauncherVisible(true);
      app.connectionNotice.render('lost');
      app.multiplayer.showConnecting('Layout QA');
    });
    await check(`phone lobby placement ${width}x${height}`, async () => {
      const rects = await page.evaluate(() => {
        const r = el => { const b = el.getBoundingClientRect(); return { left:b.left, right:b.right, top:b.top, bottom:b.bottom }; };
        return { chip:r(document.querySelector('#connection-status')), panel:r(document.querySelector('.ob-mp-shell')) };
      });
      assert(rects.chip.left >= 0 && rects.chip.right <= width);
      assert(rects.chip.bottom <= rects.panel.top, JSON.stringify(rects));
      const launcherGap = await page.evaluate(() => document.querySelector('#connection-status').getBoundingClientRect().top - document.querySelector('.ob-session-launcher').getBoundingClientRect().bottom);
      assert(launcherGap >= 0, `Chip overlaps menu launcher by ${-launcherGap}px`);
      layouts.push({ width, height, ...rects });
    });
    await page.screenshot({ path: resolve(out, `phone-lobby-${width}x${height}.png`) });
    await page.evaluate(() => { window.qaApp.multiplayer.hide(); window.qaApp.hud.setVisible(true); document.querySelector('#hud-tutorial').style.display = 'block'; });
    await check(`phone HUD placement ${width}x${height}`, async () => {
      const gap = await page.evaluate(() => document.querySelector('#connection-status').getBoundingClientRect().top - document.querySelector('#hud-score-wrap').getBoundingClientRect().bottom);
      assert(gap >= 0, `Chip overlaps score/timer by ${-gap}px`);
      if (width <= 640) assert.equal(await page.locator('#hud-tutorial').isVisible(), false);
    });
    await page.screenshot({ path: resolve(out, `phone-hud-${width}x${height}.png`) });
    await page.evaluate(() => { document.querySelector('#hud-tab').style.display = 'block'; });
    await check(`phone scoreboard placement ${width}x${height}`, async () => {
      assert.equal(await page.locator('#connection-status').isVisible(), false);
    });
    await page.evaluate(() => { document.querySelector('#hud-tab').style.display = 'none'; window.qaApp.openSessionMenu(); });
    await check(`phone menu placement ${width}x${height}`, async () => {
      assert.equal(await page.locator('#connection-status').isVisible(), false);
    });
    await page.screenshot({ path: resolve(out, `phone-menu-${width}x${height}.png`) });
    await page.evaluate(() => { window.qaApp.closeSessionMenu(); window.qaApp.hud.setVisible(false); });
    await page.screenshot({ path: resolve(out, `phone-chip-${width}x${height}.png`) });
  }
  await page.evaluate(() => { window.qaApp.connectionNotice.render('disconnected'); });
  Object.assign(result, { regressions, layouts, pageErrors });
  assert.deepEqual(pageErrors, []);
  assert(Object.values(regressions).every(check => check.pass), 'Fix round 1 browser regressions failed');
  result.pass = true;
} catch (error) {
  await page?.screenshot({ path: resolve(out, 'failure.png') }).catch(() => {});
  result.consoleErrors = consoleErrors;
  result.joinError = await page?.evaluate(() => window.qaJoinError).catch(() => null);
  result.notice = await page?.locator("#connection-status").innerText().catch(() => null);
  result.snapshots = await page?.evaluate(() => window.qaSnapshots?.map(s => ({
    phase: s.phase, teamSize: s.teamSize, members: s.members.map(m => m.name),
  }))).catch(() => []);
  result.refusedAtMs = refusedAt;
  Object.assign(result, { pass: false, error: error.message, pageErrors });
  throw error;
} finally {
  await writeFile(resolve(out, 'reconnect.json'), JSON.stringify(result, null, 2));
  await browser?.close();
  await vite?.close();
  if (observer) await observer.leave().catch(() => {});
  for (const pair of connections) { pair.socket.destroy(); pair.upstream.destroy(); }
  await new Promise(resolve => proxy.close(resolve));
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill();
    await once(serverProcess, 'exit');
  }
}
console.log(JSON.stringify(result));
