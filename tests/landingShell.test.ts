import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] ?? '';
const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
const description = 'Orbital Breach is a zero-g multiplayer browser shooter with 1v1 to 20v20 team modes. Freeze rivals or breach portals in rounds; first to 5 points wins.';

describe('metadata-only welcome shell', () => {
  it('keeps title, description, Open Graph and JSON-LD in the document head', () => {
    expect(html).toContain('<title>Orbital Breach – Zero-G Multiplayer Shooter</title>');
    expect(head).toContain(`<meta name="description" content="${description}" />`);
    expect(head).toContain('<meta property="og:title" content="Orbital Breach – Zero-G Multiplayer Shooter" />');
    expect(head).toContain(`<meta property="og:description" content="${description}" />`);
    expect(head).toContain('<meta property="og:image" content="https://orbital-breach.vercel.app/assets/marketing/og-image.jpg" />');
    expect(head).toContain('<meta property="og:url" content="https://orbital-breach.vercel.app/" />');
    expect(head).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(head).toContain('<link rel="canonical" href="https://orbital-breach.vercel.app/" />');
    expect(schema['@type']).toEqual(['VideoGame', 'WebApplication']);
    expect(schema.name).toBe('Orbital Breach');
    expect(schema.description).toBe(description);
    expect(schema.applicationCategory).toBe('GameApplication');
    expect(schema.offers).toMatchObject({ '@type': 'Offer', price: '0', priceCurrency: 'USD' });
    expect(schema).not.toHaveProperty('aggregateRating');
  });

  it('opens on the game shell with no landing page and no crawlable body copy', () => {
    expect(html).toContain('<body class="boot-cover">');
    expect(html).toMatch(/body\.boot-cover > canvas[\s\S]*display:\s*none/);
    expect(html).toMatch(/body\.boot-cover > \.ob-hud-root[\s\S]*display:\s*none/);
    expect(html).toMatch(/body\.boot-cover:not\(:has\(#menu-root, \.wc-root\)\) \.gc-cursor[\s\S]*display:\s*none/);
    expect(body).toContain('<div id="app"></div>');
    expect(body).toContain('<script type="module" src="/src/main.ts"></script>');
    expect(body).not.toMatch(/<(?:main|h1|h2|p|ul|li|noscript|details|img)\b/i);
    for (const marker of [
      'id="landing"',
      'id="wc-btn"',
      'id="landing-status"',
      'landing-gameplay',
      'orbital-breach-art',
      'Desktop controls',
      'Touch controls',
      'Freeze the squad',
      'Choose Start',
      'visually-hidden',
      'sr-only',
    ]) {
      expect(body).not.toContain(marker);
    }
    expect(head).not.toContain('rel="preload" as="image" href="/orbital-breach-art.webp"');
    expect(html).not.toContain('#landing');
  });
});
