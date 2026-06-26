import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '..');
const sharedUtilityPath = path.join(repoRoot, 'client/src/ui/escapeHtml.ts');
const consumerPaths = [
  'client/src/ui/kill-feed.ts',
  'client/src/render/hud/scoreboard.ts',
  'client/src/ui/debrief.ts',
  'client/src/ui/menu/menuView.ts',
  'client/src/ui/multiplayerLobby.ts',
  'client/src/ui/roomBrowser.ts',
  'client/src/ui/sessionMenu.ts',
];

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('shared escapeHtml utility', () => {
  it('keeps a single implementation for UI escaping', () => {
    const implementationCount = [
      sharedUtilityPath,
      ...consumerPaths.map((relativePath) => path.join(repoRoot, relativePath)),
    ].reduce((count, absolutePath) => {
      if (!existsSync(absolutePath)) {
        return count;
      }

      const source = readFileSync(absolutePath, 'utf8');
      return count + (source.match(/\b(?:export\s+)?function escapeHtml\b/g)?.length ?? 0);
    }, 0);

    expect(implementationCount).toBe(1);
  });

  it('has each consumer import the shared helper instead of redefining it', () => {
    expect(existsSync(sharedUtilityPath)).toBe(true);

    for (const relativePath of consumerPaths) {
      const source = read(relativePath);
      expect(source).toMatch(/import\s+\{\s*escapeHtml\s*\}\s+from\s+['"][^'"]+['"]/);
      expect(source).not.toMatch(/\b(?:export\s+)?function escapeHtml\b/);
    }
  });
});
