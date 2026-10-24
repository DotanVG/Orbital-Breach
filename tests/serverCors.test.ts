import { describe, it, expect } from 'vitest';
import { buildCorsHeaders, createOriginMatcher, parseOriginList } from '../server/src/cors';

describe('createOriginMatcher', () => {
  const prod = createOriginMatcher(['https://extra.example.com'], true);
  const dev = createOriginMatcher([], false);

  it.each([
    'https://orbital-breach.vercel.app',
    'https://orbital-breach-2o12vnqic-dotanvgs-projects.vercel.app',
    'https://orbital-breach-git-staging-dotanvgs-projects.vercel.app',
    'https://html-classic.itch.zone',
    'https://v6p9d9t4.ssl.hwcdn.net',
    'https://dotanv.itch.io',
    'https://itch.io',
    'itch-cave://game-12345',
    'null',
    'https://extra.example.com',
  ])('allows %s', (origin) => {
    expect(prod(origin)).toBe(true);
  });

  it.each([
    'https://evil.com',
    'https://evil-itch.io.attacker.com',
    'https://dotanv.itch.io.attacker.com',
    'https://evilitch.io',
    'https://itch.zone.evil.com',
    'https://hwcdn.net.evil.com',
    'http://html-classic.itch.zone',
    'https://orbital-breach.vercel.app.evil.com',
    'https://orbital-breach-evil.vercel.app',
    'https://orbital-breach-x-otherteam.vercel.app',
    'https://notorbital-breach-x-dotanvgs-projects.vercel.app',
    'https://orbital-breach-x-dotanvgs-projects.vercel.app.evil.com',
    'https://orbital-breach.vercel.app/',
    'http://localhost:5173',
    '',
    undefined,
    null,
  ])('rejects %s in production', (origin) => {
    expect(prod(origin)).toBe(false);
  });

  it('allows localhost dev origins only outside production', () => {
    expect(dev('http://localhost:5173')).toBe(true);
    expect(dev('http://127.0.0.1:5173')).toBe(true);
    expect(dev('http://localhost:9999')).toBe(false);
  });
});

describe('parseOriginList', () => {
  it('trims and drops empty entries', () => {
    expect(parseOriginList(' https://a.com, ,https://b.com ,')).toEqual(['https://a.com', 'https://b.com']);
    expect(parseOriginList(undefined)).toEqual([]);
  });
});

describe('buildCorsHeaders', () => {
  const allow = createOriginMatcher([], true);

  it('echoes an allowlisted origin with minimal methods/headers', () => {
    expect(buildCorsHeaders('https://html-classic.itch.zone', allow)).toEqual({
      Vary: 'Origin',
      'Access-Control-Allow-Origin': 'https://html-classic.itch.zone',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
    });
  });

  it('sends only Vary for disallowed or missing origins', () => {
    expect(buildCorsHeaders('https://evil.com', allow)).toEqual({ Vary: 'Origin' });
    expect(buildCorsHeaders(null, allow)).toEqual({ Vary: 'Origin' });
  });
});
