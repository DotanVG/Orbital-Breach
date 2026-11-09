// Headed browser check for the direct-menu entry corrections.
// The fullscreen rejection is injected once, then the original API is restored.
// It is a recovery case, not evidence that browsers deny the first request.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2];
if (!base) {
  console.error('Usage: node scripts/qa/entry-retest.mjs <preview-origin>');
  process.exit(1);
}

const bootSampler = () => {
  const frames = [];
  const sample = () => {
    const canvas = document.querySelector('body > canvas');
    const hud = document.querySelector('.ob-hud-root');
    const menu = document.querySelector('#menu-root');
    const cursor = document.querySelector('.gc-cursor');
    const shown = (el) => {
      if (!el) return false;
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    };
    frames.push({
      canvasShown: shown(canvas),
      hudShown: shown(hud),
      cursorShown: shown(cursor),
      menuOpacity: menu ? getComputedStyle(menu).opacity : null,
      bootCover: document.body.classList.contains('boot-cover'),
    });
    if (frames.length < 45) requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
  window.__bootFrames = frames;
};

const oneShotRejection = () => {
  const native = Element.prototype.requestFullscreen;
  const log = [];
  let rejected = false;
  Element.prototype.requestFullscreen = function requestFullscreenProbe(...args) {
    if (!rejected) {
      rejected = true;
      const error = new DOMException('Injected one-shot recovery rejection', 'NotAllowedError');
      log.push({ kind: 'injected-rejection', name: error.name });
      return Promise.reject(error);
    }
    log.push({ kind: 'native' });
    return native.apply(this, args);
  };
  window.__fsLog = log;
};

const countFullscreen = () => {
  const native = Element.prototype.requestFullscreen;
  let calls = 0;
  Element.prototype.requestFullscreen = function countRequestFullscreen(...args) {
    calls += 1;
    return native.apply(this, args);
  };
  window.__fsCalls = () => calls;
};

async function readEntry(page) {
  return page.evaluate(() => ({
    href: location.href,
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content ?? null,
    ogTitle: document.querySelector('meta[property="og:title"]')?.content ?? null,
    ogDescription: document.querySelector('meta[property="og:description"]')?.content ?? null,
    types: JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent ?? 'null')?.['@type'] ?? null,
    landing: !!document.querySelector('#landing, #wc-btn'),
    menu: !!document.querySelector('#menu-root'),
    bootStatus: document.querySelector('#boot-status')?.textContent ?? null,
  }));
}

const browser = await chromium.launch({
  executablePath: '/opt/google/chrome',
  headless: false,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const report = {};
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => localStorage.setItem('orbital_fullscreen_enabled', 'true'));
  await context.addInitScript(bootSampler);
  await context.addInitScript(oneShotRejection);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base, { waitUntil: 'load' });
  await page.locator('#menu-root').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.body.classList.contains('boot-cover'), null, { timeout: 4000 });
  await page.waitForTimeout(200);
  report.direct = await readEntry(page);
  report.bootFrames = await page.evaluate(() => window.__bootFrames);
  report.pageErrors = errors.filter((message) => !message.includes('Unexpected identifier'));

  await page.locator('#menu-name').click();
  await page.waitForTimeout(150);
  let fs = await page.evaluate(() => ({
    log: window.__fsLog,
    fullscreen: !!document.fullscreenElement,
    enabled: document.fullscreenEnabled,
  }));
  if (!fs.log.some((entry) => entry.kind === 'native')) {
    await page.locator('#btn-open-instructions').click();
    await page.waitForTimeout(300);
    fs = await page.evaluate(() => ({
      log: window.__fsLog,
      fullscreen: !!document.fullscreenElement,
      enabled: document.fullscreenEnabled,
    }));
  }
  report.fullscreen = fs;
  await context.close();

  for (const [name, url] of [
    ['embed', `${base}/?embed=1`],
    ['portal', `${base}/?portal=true&username=QA`],
  ]) {
    const routeContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await routeContext.addInitScript(() => localStorage.setItem('orbital_fullscreen_enabled', 'true'));
    await routeContext.addInitScript(countFullscreen);
    const routePage = await routeContext.newPage();
    await routePage.goto(url, { waitUntil: 'load' });
    if (name === 'embed') await routePage.locator('#menu-root').waitFor({ state: 'visible' });
    else await routePage.waitForFunction(() => document.body.innerText.includes('FIRST FLIGHT') || document.querySelector('#hud-crosshair'));
    await routePage.waitForTimeout(400);
    report[name] = {
      ...(await readEntry(routePage)),
      fullscreenCalls: await routePage.evaluate(() => window.__fsCalls()),
    };
    await routeContext.close();
  }
} finally {
  await browser.close();
}

const covered = report.bootFrames.filter((frame) => frame.bootCover);
const exposedWhileCovered = covered.filter((frame) => frame.canvasShown || frame.hudShown);
const beforeMenu = report.bootFrames.filter((frame) => frame.menuOpacity === null);
const exposedBeforeMenu = beforeMenu.filter((frame) => frame.canvasShown || frame.hudShown || frame.cursorShown);
report.bootSummary = {
  frames: report.bootFrames.length,
  coveredFrames: covered.length,
  canvasOrHudWhileCovered: exposedWhileCovered.length,
  exposedBeforeMenu: exposedBeforeMenu.length,
};
delete report.bootFrames;

const nativeCalls = report.fullscreen.log.filter((entry) => entry.kind === 'native').length;
const injected = report.fullscreen.log.filter((entry) => entry.kind === 'injected-rejection').length;
const failures = [];
if (report.direct.landing || !report.direct.menu) failures.push('direct menu missing');
if (report.direct.types?.join() !== 'VideoGame,WebApplication') failures.push('metadata types');
if (!report.direct.ogTitle || !report.direct.description) failures.push('metadata text');
if (report.bootSummary.canvasOrHudWhileCovered || report.bootSummary.exposedBeforeMenu) failures.push('gameplay exposed during boot cover');
if (injected !== 1) failures.push(`expected one injected rejection, got ${injected}`);
if (nativeCalls < 1) failures.push('native requestFullscreen was not reached after the injected rejection');
if (report.fullscreen.enabled && !report.fullscreen.fullscreen) failures.push('fullscreen supported but did not engage');
if (report.embed.fullscreenCalls !== 0 || !report.embed.menu || report.embed.href.includes('embed=')) failures.push('embed route');
if (report.portal.fullscreenCalls !== 0 || report.portal.menu) failures.push('portal route');
console.log(JSON.stringify(report, null, 2));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
