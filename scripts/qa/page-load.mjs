// Built-app smoke check: npm run build --prefix client && npm run test:page-load
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { preview } = await import(pathToFileURL(require.resolve('vite', { paths: [resolve(root, 'client')] })));
const failures = [];
let server;
let browser;
try {
  server = await preview({
    configFile: false,
    root: resolve(root, 'client'),
    preview: { host: '127.0.0.1', port: 0, open: false },
  });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader'] });
  for (const [name, options] of [
    ['desktop', { viewport: { width: 1280, height: 800 } }],
    ['iPhone landscape', devices['iPhone 14 landscape']],
  ]) {
    for (const path of ['/', '/?embed=1']) {
      const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
      const consoleErrors = [];
      const pageErrors = [];
      const unexpectedRequests = [];
      const label = `${name} ${path}`;
      try {
        await context.route('**/*', route => {
          const url = new URL(route.request().url());
          // Preview lacks Vercel's hosted scripts; do not send analytics or depend on Google Fonts.
          if (url.origin === base && ['/_vercel/insights/script.js', '/_vercel/speed-insights/script.js'].includes(url.pathname)) {
            return route.fulfill({ contentType: 'application/javascript', body: '' });
          }
          if (url.hostname === 'fonts.googleapis.com') {
            return route.fulfill({ contentType: 'text/css', body: '' });
          }
          if (url.origin === base) return route.continue();
          // Fail rather than silently hide a newly introduced third-party script or backend dependency.
          unexpectedRequests.push(url.href);
          return route.fulfill({ contentType: 'application/javascript', body: '' });
        });
        const page = await context.newPage();
        page.on('console', message => {
          if (message.type() === 'error') consoleErrors.push({ text: message.text(), location: message.location() });
        });
        page.on('pageerror', error => pageErrors.push(error.stack || error.message));
        await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 60000 });
        await page.locator(path === '/' ? '#wc-btn' : '#btn-play-solo').waitFor({ state: 'visible', timeout: 60000 });
        // Keep listening after the UI is ready for deferred startup errors.
        await page.waitForTimeout(1000);
        assert.equal(await page.locator('#boot-status').count(), 0, 'Boot failure must not pass as a clean load');
        assert.deepEqual({ consoleErrors, pageErrors, unexpectedRequests }, {
          consoleErrors: [], pageErrors: [], unexpectedRequests: [],
        }, `${label}: page load must have zero console errors, pageerrors, and unexpected external requests`);
      } catch (error) {
        failures.push(`${label}: ${error.stack || error.message}`);
      } finally {
        console.log(JSON.stringify({ label, consoleErrors, pageErrors, unexpectedRequests }));
        await context.close();
      }
    }
  }
} finally {
  try { await browser?.close(); }
  finally { await server?.close(); }
}
assert.equal(failures.length, 0, failures.join('\n'));
