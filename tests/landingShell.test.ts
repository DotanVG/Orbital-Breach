import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MATCH_POINT_TARGET, ROUND_DURATION_SECONDS } from '../shared/constants';
import { GITHUB_REPO_URL, ITCH_IO_URL, NOAM_SOUNDCLOUD_URL } from '../client/src/ui/creditsContent';

const html = readFileSync(new URL('../client/index.html', import.meta.url), 'utf8');
const landing = html.match(/<main id="landing">([\s\S]*?)<\/main>/)?.[1] ?? '';
const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);

describe('crawlable landing shell', () => {
  it('defines the game in source HTML before entry', () => {
    expect(landing).toContain(`<h1>${schema.name}</h1>`);
    expect(landing).toContain('zero-G multiplayer shooter');
    expect(landing).toContain('1v1 to 20v20');
    expect(landing).toContain('entering the enemy breach room or freezing every enemy pilot');
    expect(landing).toContain(`first team to ${MATCH_POINT_TARGET} points wins`);
    expect(landing).toContain(`${ROUND_DURATION_SECONDS}-second round timeout`);
    expect(schema['@type']).toBe('VideoGame');
    expect(schema.numberOfPlayers).toMatchObject({ minValue: 2, maxValue: 40 });
  });

  it('provides the native entry button, desktop/touch guidance and fallbacks', () => {
    expect(landing).toMatch(/<button type="button"[^>]*id="wc-btn"[^>]*>Start/);
    for (const text of ['Desktop controls', 'Touch controls', 'WASD', 'Space', 'GRAB', 'LAUNCH', 'FIRE', 'JavaScript', 'WebGL']) {
      expect(landing).toContain(text);
    }
    expect(landing).toContain('<noscript>');
    expect(landing).toContain('id="landing-status" role="status"');
  });

  it('keeps creator and music links consistent with the existing credits and schema', () => {
    for (const url of [schema.author.url, GITHUB_REPO_URL, ITCH_IO_URL, NOAM_SOUNDCLOUD_URL]) {
      expect(landing).toContain(`href="${url}"`);
    }
    expect(landing).toContain(schema.author.name);
    expect(landing).toContain(schema.musicBy.name);
  });
});
