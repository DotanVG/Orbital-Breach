export { App } from './game/gameApp';
import * as THREE from 'three';
import { App } from './game/gameApp';
import type { GlobalCursor } from './ui/globalCursor';
import { wakeBackend } from './net/wakeBackend';

export async function prepareGame(cursor: GlobalCursor, audioContext?: AudioContext): Promise<App> {
  wakeBackend();
  if (audioContext) THREE.AudioContext.setContext(audioContext);
  const manager = THREE.DefaultLoadingManager;
  const previousLoad = manager.onLoad;
  const previousError = manager.onError;
  try {
    const ready = new Promise<void>((resolve, reject) => {
      manager.onLoad = resolve;
      manager.onError = () => reject(new Error('Game assets could not load'));
    });
    const app = new App(cursor);
    const canvas = document.querySelector('body > canvas')!;
    canvas.setAttribute('role', 'region');
    canvas.setAttribute('aria-label', 'Orbital Breach game');
    await ready;
    return app;
  } finally {
    manager.onLoad = previousLoad;
    manager.onError = previousError;
  }
}
