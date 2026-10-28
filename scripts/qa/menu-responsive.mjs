// Built-app, fully headless check. See README.md for setup and usage.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url); // Also resolves Playwright through NODE_PATH.
const { webkit, chromium, devices } = require('playwright');
const { preview } = await import(pathToFileURL(require.resolve('vite', { paths: [resolve(root, 'client')] })));
const { values } = parseArgs({ options: { dist: { type: 'string' }, out: { type: 'string' } } });
assert(values.out, 'Usage: node scripts/qa/menu-responsive.mjs --out <artifact directory> [--dist <built app>]');
const out = resolve(values.out);
await mkdir(out, { recursive: true });

const viewports = [
  [375, 667, 'iPhone SE'],
  [390, 844, 'iPhone 14'],
  [844, 390, 'iPhone 14 landscape'],
  [768, 1024, 'iPad Mini'],
  [1024, 768, 'iPad Mini landscape'],
  [820, 1180, 'iPad (gen 7)'],
  [1024, 1366, 'iPad Pro 11'],
  [1366, 1024, 'iPad Pro 11 landscape'],
  [1280, 800, null],
  [1920, 1080, null],
];
const rows = [];
const limitations = [];
let browser;
let engine = 'WebKit';
let server;
try {
  server = await preview({
    configFile: false,
    root: resolve(root, 'client'),
    build: { outDir: resolve(values.dist ?? resolve(root, 'client/dist')) },
    preview: { host: '127.0.0.1', port: 0, open: false },
  });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  // Never send QA traffic to the production backend or analytics.
  const isolateNetwork = route => {
    const url = new URL(route.request().url());
    if (url.origin === base || ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) {
      return route.continue();
    }
    return route.abort();
  };
  try {
    browser = await webkit.launch({ headless: true });
    // Windows WebKit can launch yet lack the JS/WebGL support needed by the built game.
    const probe = await browser.newPage();
    const probeErrors = [];
    probe.on('pageerror', error => probeErrors.push(error.message));
    await probe.route('**/*', isolateNetwork);
    await probe.goto(`${base}/?embed=1`);
    await probe.waitForFunction(() => document.querySelector('#menu-root')
      || document.querySelector('#landing-status')?.textContent.includes('could not load'));
    const usable = await probe.locator('#menu-root').count();
    await probe.close();
    if (!usable) throw new Error(`Built app could not load: ${probeErrors.join('; ') || 'JS/WebGL unavailable'}`);
  } catch (error) {
    limitations.push(`WebKit unavailable for the built app; using Chromium: ${error.message}`);
    console.warn(limitations[0]);
    await browser?.close();
    engine = 'Chromium';
    browser = await chromium.launch({ headless: true });
  }

  for (const [width, height, device] of viewports) {
    assert(!device || devices[device], `Unknown Playwright device: ${device}`);
    const context = await browser.newContext({
      ...(device ? devices[device] : {}),
      viewport: { width, height },
      screen: { width, height },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    await context.route('**/*', isolateNetwork);
    await context.addInitScript(() => localStorage.setItem('orbital_fullscreen_enabled', 'false'));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const row = { viewport: `${width}x${height}`, engine: `${engine}${device ? ` / ${device}` : ''}`, buttons: [], errors };
    try {
      await page.goto(base, { waitUntil: 'load' });
      await page.locator('#wc-btn').click();
      await page.locator('#btn-play-solo').waitFor({ state: 'visible', timeout: 60000 });
      await page.waitForFunction(() => [...document.fonts].some(font => font.family.includes('JetBrains Mono')));
      await page.evaluate(async () => {
        await document.fonts.load('400 11px "JetBrains Mono"');
        await document.fonts.load('300 40px "Cormorant Garamond"');
        await document.fonts.ready;
      });
      await page.locator('#menu-root').evaluate(el => { el.scrollTop = 0; });
      await page.mouse.move(0, 0);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      Object.assign(row, await page.evaluate(() => {
        const menu = document.querySelector('#menu-root');
        const soloButton = document.querySelector('#btn-play-solo');
        const solo = soloButton.getBoundingClientRect();
        const hit = document.elementFromPoint(solo.left + solo.width / 2, solo.top + solo.height / 2);
        return {
          innerWidth, scrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth, menuScrollWidth: menu.scrollWidth,
          menuClientWidth: menu.clientWidth,
          soloInitiallyVisible: solo.left >= 0 && solo.right <= innerWidth && solo.top >= 0 && solo.bottom <= innerHeight,
          soloInitiallyHitTestable: !!hit && (hit === soloButton || soloButton.contains(hit)),
          fontsLoaded: document.fonts.check('400 11px "JetBrains Mono"') && document.fonts.check('300 40px "Cormorant Garamond"'),
        };
      }));
      assert.equal(row.innerWidth, width, 'Device emulation must keep the exact requested viewport');
      row.screenshot = `${row.viewport}.png`;
      await page.screenshot({ path: resolve(out, row.screenshot) });
      const controls = page.locator('#menu-root button, #menu-root a');
      assert.equal(await page.locator('.ob-match-card').count(), 5, 'All five match cards must exist');
      assert.equal(await page.locator('#menu-root button').count(), 12, 'All seven actions and five modes must exist');
      for (const control of await controls.all()) {
        // Vertical scrolling is allowed for secondary controls; never repair horizontal overflow in the test.
        await control.evaluate(el => {
          const menu = document.querySelector('#menu-root');
          const rect = el.getBoundingClientRect();
          menu.scrollTop += rect.top + rect.height / 2 - innerHeight / 2;
          menu.scrollLeft = 0;
        });
        row.buttons.push(await control.evaluate(el => {
          const rect = el.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          const inside = rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
          return {
            name: el.id || el.textContent.trim().replace(/\s+/g, ' '),
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            inside, hitTestable: !!hit && (hit === el || el.contains(hit)),
            tapSize: rect.width >= 40 && rect.height >= 40,
            textFits: [...el.querySelectorAll('.ob-btn-label, .ob-card-name, .ob-tutorial-btn-main')].every(label => {
              const text = label.getBoundingClientRect();
              return label.scrollWidth <= label.clientWidth && text.left >= rect.left && text.right <= rect.right
                && text.top >= rect.top && text.bottom <= rect.bottom;
            }),
          };
        }));
      }
      await page.locator('#menu-root').evaluate(el => { el.scrollTop = 0; });
      row.pass = row.scrollWidth <= row.innerWidth && row.bodyScrollWidth <= row.innerWidth
        && row.menuScrollWidth <= row.menuClientWidth && row.soloInitiallyVisible && row.soloInitiallyHitTestable && row.fontsLoaded
        && row.buttons.every(button => button.inside && button.hitTestable && button.textFits && (!device || button.tapSize))
        && errors.length === 0;
    } catch (error) {
      row.pass = false;
      errors.push(error.message);
      await page.screenshot({ path: resolve(out, `${row.viewport}-error.png`) }).catch(() => {});
    } finally {
      rows.push(row);
      console.log(`${row.viewport}: ${row.pass ? 'PASS' : 'FAIL'} (${row.scrollWidth}/${row.innerWidth}; menu ${row.menuScrollWidth}/${row.menuClientWidth}) ${row.engine}`);
      if (errors.length) console.error(errors.join('\n'));
      await context.close();
    }
  }
} finally {
  await browser?.close();
  if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
  const table = [
    '| Viewport | Engine / device | Document / inner | Body / inner | Menu / client | Solo initially visible | Result |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(row => `| ${row.viewport} | ${row.engine} | ${row.scrollWidth ?? '?'} / ${row.innerWidth ?? '?'} | ${row.bodyScrollWidth ?? '?'} / ${row.innerWidth ?? '?'} | ${row.menuScrollWidth ?? '?'} / ${row.menuClientWidth ?? '?'} | ${row.soloInitiallyVisible ?? false} | ${row.pass ? 'PASS' : 'FAIL'} |`),
  ].join('\n');
  console.log(table);
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ limitations, rows }, null, 2) + '\n');
  await writeFile(resolve(out, 'results.md'), table + '\n\n' + limitations.join('\n') + '\n');
}
assert.equal(rows.length, viewports.length, 'Every viewport must run');
assert(rows.every(row => row.pass), `Responsive QA failed; see ${out}`);
