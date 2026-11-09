import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Startup does not load models; keep addon loaders out of this Node-only test.
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: class {} }));
vi.mock('three/addons/utils/SkeletonUtils.js', () => ({ clone: vi.fn() }));

vi.mock('../client/src/net/client', () => ({ NetClient: class {} }));

import { App } from '../client/src/game/gameApp';
import { isEmbedMode } from '../client/src/embed';
import { parsePortalParams } from '../client/src/game/portal/parsePortalParams';

// Exercise the real startup routing without constructing WebGL, DOM views, or sockets.
describe('welcome startup routing', () => {
  let documentTarget: EventTarget;
  const removeClass = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    documentTarget = new EventTarget();
    vi.stubGlobal('document', Object.assign(documentTarget, {
      body: { classList: { remove: removeClass } },
    }));
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('requestAnimationFrame', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  function start(search: string, fullscreenPreference = true) {
    vi.stubGlobal('window', Object.assign(new EventTarget(), { location: { search } }));
    const state = {
      menu: { show: vi.fn(), isVisible: () => false },
      welcome: { show: vi.fn(), onBreach: null as (() => void) | null, fullscreenOnClick: false },
      cursor: { hide: vi.fn() },
      sound: { unlock: vi.fn(() => Promise.resolve()), startMusic: vi.fn() },
      portalArrivalPending: parsePortalParams().portal === true,
      portalParams: parsePortalParams(),
      embedMode: isEmbedMode(search),
      fullscreenPreference,
      cleanEmbedUrl: vi.fn(),
      startSoloMatch: vi.fn(),
    };
    App.prototype.start.call(state as unknown as App);
    return state;
  }

  it.each(['', '?embed=0&portal=false', '?room=invite'])('shows welcome before menu for %s', (search) => {
    const state = start(search);
    expect(state.welcome.show).toHaveBeenCalledOnce();
    expect(state.menu.show).not.toHaveBeenCalled();
    expect(state.startSoloMatch).not.toHaveBeenCalled();
    expect(state.welcome.fullscreenOnClick).toBe(true);
    expect(removeClass).not.toHaveBeenCalled();
    state.welcome.onBreach?.();
    expect(state.menu.show).toHaveBeenCalledOnce();
  });

  it('passes the disabled fullscreen preference to the welcome button', () => {
    expect(start('', false).welcome.fullscreenOnClick).toBe(false);
  });

  it('skips welcome and shows the existing menu for embed entry', () => {
    const state = start('?embed=1');
    expect(state.welcome.show).not.toHaveBeenCalled();
    expect(state.welcome.fullscreenOnClick).toBe(false);
    expect(state.cleanEmbedUrl).toHaveBeenCalledOnce();
    expect(state.menu.show).toHaveBeenCalledOnce();
    expect(state.startSoloMatch).not.toHaveBeenCalled();
  });

  it.each(['?portal=true', '?embed=1&portal=true'])('skips welcome and menu for portal arrival %s', (search) => {
    const state = start(search);
    expect(state.welcome.show).not.toHaveBeenCalled();
    expect(state.welcome.fullscreenOnClick).toBe(false);
    expect(state.menu.show).not.toHaveBeenCalled();
    expect(state.cursor.hide).toHaveBeenCalledOnce();
    expect(state.startSoloMatch).toHaveBeenCalledExactlyOnceWith({ name: 'Nova', teamSize: 1, noBots: true });
    expect(removeClass).toHaveBeenCalledExactlyOnceWith('boot-cover');
  });

  it.each(['', '?embed=1', '?portal=true'])('unlocks audio only on a gesture for %s and never fullscreens a menu gesture', async (search) => {
    const requestFullscreen = vi.fn();
    vi.stubGlobal('document', Object.assign(documentTarget, {
      documentElement: { requestFullscreen },
    }));
    const state = start(search);
    expect(state.sound.unlock).not.toHaveBeenCalled();
    expect(state.sound.startMusic).not.toHaveBeenCalled();
    documentTarget.dispatchEvent(new Event('keydown'));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(state.sound.unlock).toHaveBeenCalledOnce();
    expect(state.sound.startMusic).toHaveBeenCalledOnce();
    state.menu.isVisible = () => true;
    for (const type of ['pointerdown', 'touchstart', 'click']) documentTarget.dispatchEvent(new Event(type));
    expect(state.sound.unlock).toHaveBeenCalledOnce();
    expect(requestFullscreen).not.toHaveBeenCalled();
  });
});
