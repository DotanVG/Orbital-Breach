import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('client motion permission regression', () => {
  it('does not reference motion APIs or subscribe to their events', () => {
    const client = resolve(__dirname, '../client');
    const files = ['index.html', ...['src', 'public'].flatMap(dir =>
      readdirSync(resolve(client, dir), { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile() && /\.(?:[cm]?[jt]sx?|html)$/i.test(entry.name))
        .map(entry => resolve(entry.parentPath, entry.name)),
    )];
    expect(files.length).toBeGreaterThan(1);
    for (const file of files) {
      // These APIs only served landing artwork; gameplay must stay touch/mouse driven.
      expect(readFileSync(resolve(client, file), 'utf8'), file)
        .not.toMatch(/Device(?:Motion|Orientation)Event|device(?:motion|orientation)/i);
    }
  });
});
