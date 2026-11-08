import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { cursor, construct, start, reload, wakeBackend, boot, order } = vi.hoisted(() => ({
  cursor: { hide: vi.fn() },
  construct: vi.fn(),
  start: vi.fn(),
  reload: vi.fn(),
  wakeBackend: vi.fn(),
  boot: { fail: false, active: false },
  order: [] as string[],
}));
vi.mock('../client/node_modules/@vercel/analytics/dist/index.mjs', () => ({ inject: vi.fn() }));
vi.mock('../client/node_modules/@vercel/speed-insights/dist/index.mjs', () => ({ injectSpeedInsights: vi.fn() }));
vi.mock('../client/src/analytics/analytics', () => ({ trackLandingVisitOnce: vi.fn() }));
vi.mock('../client/src/ui/globalCursor', () => ({ initGlobalCursor: () => cursor }));
vi.mock('../client/src/net/wakeBackend', () => ({ wakeBackend }));
vi.mock('../client/src/app', () => ({
  App: class {
    constructor(received: unknown) {
      order.push(boot.active ? 'construct-active' : 'construct-covered');
      construct(received);
      if (boot.fail) throw new Error('webgl');
    }
    start(): void {
      order.push(boot.active ? 'start-active' : 'start-covered');
      start();
    }
  },
}));

describe('main startup routing', () => {
  const selectors: string[] = [];
  const addClass = vi.fn();
  type BootNode = {
    id: string;
    textContent: string;
    children?: Array<{ tag: string; textContent: string; onclick: (() => void) | null }>;
  };
  const appended: BootNode[] = [];

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    boot.fail = false;
    boot.active = false;
    order.length = 0;
    selectors.length = 0;
    appended.length = 0;
    vi.stubGlobal('location', { reload, search: '' });
    vi.stubGlobal('document', {
      querySelector: (selector: string) => {
        selectors.push(selector);
        return null;
      },
      createElement: (tag: string) => {
        const node = {
          tag,
          id: '',
          textContent: '',
          type: '',
          onclick: null as (() => void) | null,
          children: [] as Array<{ tag: string; textContent: string; onclick: (() => void) | null }>,
          setAttribute(name: string, value: string) {
            if (name === 'id') node.id = value;
          },
          append(...children: Array<{ tag: string; textContent: string; onclick: (() => void) | null }>) {
            node.children.push(...children);
          },
          style: {},
        };
        return node;
      },
      body: {
        classList: {
          add: (name: string) => {
            if (name === 'game-active') boot.active = true;
            addClass(name);
          },
          contains: (name: string) => name === 'game-active' && boot.active,
        },
        append: (...nodes: BootNode[]) => {
          appended.push(...nodes);
        },
      },
    });
    vi.stubGlobal('localStorage', { getItem: () => null });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(['', '?embed=1', '?portal=true', '?embed=0&portal=false', '?embed=1&portal=true'])(
    'boots %s directly into the game without a landing gesture',
    async (search) => {
      vi.stubGlobal('window', { location: { search } });

      await import('../client/src/main');

      expect(selectors).not.toEqual(expect.arrayContaining(['#landing', '#wc-btn', '#landing-status']));
      expect(wakeBackend).toHaveBeenCalledOnce();
      expect(construct).toHaveBeenCalledExactlyOnceWith(cursor);
      expect(start).toHaveBeenCalledOnce();
      expect(start.mock.calls[0]).toEqual([]);
      expect(order).toEqual(['construct-covered', 'start-covered']);
      expect(addClass).toHaveBeenCalledExactlyOnceWith('game-active');
      expect(appended).toEqual([]);
    },
  );

  it('reports a constructor failure without landing copy', async () => {
    boot.fail = true;
    vi.stubGlobal('window', { location: { search: '' } });

    await import('../client/src/main');

    expect(order).toEqual(['construct-covered']);
    expect(addClass).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(appended).toHaveLength(1);
    const status = appended[0];
    expect(status.id).toBe('boot-status');
    expect(status.textContent).toMatch(/could not load/i);
    expect(status.textContent).not.toMatch(/Desktop controls|Touch controls|Freeze the squad|Choose Start/);
    const button = status.children?.find((child) => child.tag === 'button');
    expect(button?.textContent).toMatch(/reload/i);
    button?.onclick?.();
    expect(reload).toHaveBeenCalledOnce();
  });
});
