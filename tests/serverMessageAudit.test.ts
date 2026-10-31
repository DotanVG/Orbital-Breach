import { fork, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WebSocket as Socket } from '../server/node_modules/@types/ws';

const requireServer = createRequire(new URL('../server/package.json', import.meta.url));
const WebSocket = requireServer('ws') as typeof import('../server/node_modules/@types/ws');
const { getMessageBytes, Protocol } = requireServer('@colyseus/core');
const allowedOrigin = 'https://orbital-breach.vercel.app';
const frame = (type: string, data?: unknown): Buffer => getMessageBytes.raw(Protocol.ROOM_DATA, type, data);
const pause = (ms = 25) => new Promise(resolve => setTimeout(resolve, ms));
const playerUpdate = (posX = 3) => ({ posX, posY: 0, posZ: 0, velX: 0, velY: 0, velZ: 0, yaw: 0, phase: 'FLOATING' });

interface Snapshot {
  rooms: number; exists: boolean; clients: number; members: number; actors: number;
  ready: boolean[]; positions: number[]; rates: number; timers: number;
}
interface Seat { processId: string; roomId: string; sessionId: string }

describe('real multiplayer server trust boundary', () => {
  let child: ChildProcess;
  let port: number;
  let seat: Seat;
  let socket: Socket;
  let sequence = 0;
  const sockets: Socket[] = [];
  let exited = false;

  async function rpc(action = 'snapshot'): Promise<Snapshot> {
    expect(exited, 'server process must survive hostile traffic').toBe(false);
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error('server inspection timed out')); }, 3000);
      const onExit = () => { cleanup(); reject(new Error('server crashed during inspection')); };
      const onMessage = (message: { id: number; result: Snapshot }) => {
        if (message.id === id) { cleanup(); resolve(message.result); }
      };
      const cleanup = () => { clearTimeout(timer); child.off('message', onMessage); child.off('exit', onExit); };
      child.on('message', onMessage);
      child.once('exit', onExit);
      child.send({ id, action, roomId: seat.roomId });
    });
  }

  async function inspectUntil(check: (state: Snapshot) => void): Promise<Snapshot> {
    let last: unknown;
    for (let i = 0; i < 80; i++) {
      const state = await rpc();
      try { check(state); return state; } catch (error) { last = error; }
      await pause();
    }
    throw last;
  }

  async function connect(origin = allowedOrigin, acknowledge = true): Promise<Socket> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/${seat.processId}/${seat.roomId}?sessionId=${seat.sessionId}`, { origin });
    sockets.push(ws);
    // Observe errors without turning expected rejections into unhandled errors.
    ws.on('error', () => {});
    const joined = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error('join timed out')); }, 3000);
      const onMessage = (data: Buffer) => {
        if (data[0] === Protocol.JOIN_ROOM) {
          cleanup();
          if (acknowledge) ws.send(Buffer.from([Protocol.JOIN_ROOM]));
          resolve();
        }
      };
      const onError = (error: Error) => { cleanup(); reject(error); };
      const onClose = () => { cleanup(); reject(new Error('closed before join')); };
      const cleanup = () => { clearTimeout(timer); ws.off('message', onMessage); ws.off('error', onError); ws.off('close', onClose); };
      ws.on('message', onMessage); ws.once('error', onError); ws.once('close', onClose);
    });
    await joined;
    await rpc();
    return ws;
  }

  async function reserve(): Promise<Seat> {
    const response = await fetch(`http://127.0.0.1:${port}/matchmake/create/orbital_lobby`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: allowedOrigin }, body: JSON.stringify({ name: 'Audit' }),
    });
    expect(response.status).toBe(200);
    return response.json();
  }

  async function assertHealthy(): Promise<void> {
    expect(exited, 'server process must remain alive').toBe(false);
    expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(200);
  }

  async function disconnectAndCheck(): Promise<void> {
    for (const ws of sockets) if (ws.readyState === WebSocket.OPEN) ws.terminate();
    await inspectUntil(state => expect(state).toMatchObject({ rooms: 0, exists: false, clients: 0, members: 0, actors: 0, rates: 0, timers: 0 }));
    await assertHealthy();
  }

  beforeEach(async () => {
    exited = false;
    child = fork(fileURLToPath(new URL('./fixtures/serverAuditChild.cjs', import.meta.url)), [], {
      execArgv: [], silent: true,
      env: {
        NODE_ENV: 'production', PORT: '0', CLIENT_ORIGIN: allowedOrigin, TRUST_PROXY_HOPS: '0',
        ...(process.platform === 'linux' ? { LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH } : {}),
      },
      windowsHide: true,
    });
    const current = child;
    current.once('exit', () => { if (child === current) exited = true; });
    current.on('error', () => {});
    // Drain output without exposing handshake data or huge hostile payloads.
    child.stdout?.resume(); child.stderr?.resume();
    port = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error('server startup timed out')); }, 10000);
      const onMessage = (message: { ready?: number }) => { if (message.ready) { cleanup(); resolve(message.ready); } };
      const onExit = () => { cleanup(); reject(new Error('server exited on startup')); };
      const cleanup = () => { clearTimeout(timer); child.off('message', onMessage); child.off('exit', onExit); };
      child.on('message', onMessage); child.once('exit', onExit);
    });
    seat = await reserve();
  }, 15000);

  afterEach(async () => {
    for (const ws of sockets.splice(0)) ws.terminate();
    if (child && child.exitCode === null && child.signalCode === null) {
      const current = child;
      const exit = new Promise<void>(resolve => current.once('exit', () => resolve()));
      const fallback = setTimeout(() => current.kill('SIGKILL'), 3000);
      if (current.connected) current.send({ action: 'stop' }, () => {});
      else current.kill('SIGKILL');
      await exit;
      clearTimeout(fallback);
    }
  });

  it.each(['ready', 'switch_team', 'set_team_size', 'fill_bots', 'player_update', 'shot_event', 'hit_report'])('rejects null %s without crashing or leaking', async type => {
    socket = await connect();
    if (['player_update', 'shot_event', 'hit_report'].includes(type)) await rpc('playing');
    socket.send(frame(type, null));
    await pause(100);
    await assertHealthy();
    await disconnectAndCheck();
  });

  it.each([['ready', { ready: 'false' }], ['fill_bots', { fill: 'false' }], ['set_team_size', { teamSize: '20' }]])('rejects wrongly typed %s rather than mutating lobby state', async (type, payload) => {
    socket = await connect();
    socket.send(frame(type as string, payload));
    await pause(100);
    // Invalid input is disconnected by Colyseus validation, so the room vanishes.
    await inspectUntil(state => expect(state.exists).toBe(false));
    await assertHealthy();
  });

  it.each([undefined, [], {}, true, 7, 'ready'])('rejects a non-object or incomplete ready payload (%j)', async payload => {
    socket = await connect();
    socket.send(frame('ready', payload));
    await inspectUntil(state => expect(state).toMatchObject({ exists: false, members: 0, actors: 0, rates: 0 }));
    await assertHealthy();
  });

  it.each([NaN, Infinity, '3'])('rejects a non-finite or wrongly typed player coordinate (%s)', async posX => {
    socket = await connect();
    await rpc('playing');
    socket.send(frame('player_update', { ...playerUpdate(), posX }));
    await inspectUntil(state => expect(state).toMatchObject({ exists: false, members: 0, actors: 0, rates: 0 }));
    await assertHealthy();
  });

  it('rejects an object in a numeric player field without corrupting actor state', async () => {
    socket = await connect();
    await rpc('playing');
    socket.send(frame('player_update', { posX: { valueOf: 1 }, posY: 0, posZ: 0, velX: 0, velY: 0, velZ: 0, yaw: 0, phase: 'FLOATING' }));
    await pause(100);
    await assertHealthy();
    await inspectUntil(state => expect(state.exists).toBe(false));
  });

  it('survives malformed JSON sent as WebSocket text', async () => {
    socket = await connect();
    socket.send('{"ready":');
    await pause(50);
    await assertHealthy();
    await disconnectAndCheck();
  });

  it('closes malformed MessagePack and cleans the player', async () => {
    socket = await connect();
    socket.send(Buffer.concat([frame('ready'), Buffer.from([0x81])]));
    await inspectUntil(state => expect(state.exists).toBe(false));
    await assertHealthy();
  });

  it('enforces the existing 4 KiB transport cap and cleans the oversized sender', async () => {
    socket = await connect();
    const closed = once(socket, 'close');
    socket.send(frame('ready', { ready: true, padding: 'x'.repeat(8192) }));
    expect((await closed)[0]).toBe(1009);
    await inspectUntil(state => expect(state.exists).toBe(false));
    await assertHealthy();
  });

  it('bounds a ping flood independently of per-message application throttles', async () => {
    socket = await connect();
    for (let i = 0; i < 600; i++) socket.send(Buffer.from([Protocol.PING]));
    await inspectUntil(state => expect(state.exists).toBe(false));
    await assertHealthy();
  });

  it('drops flooded ready actions at the existing cap and forgets their buckets on leave', async () => {
    socket = await connect();
    for (let i = 0; i < 10; i++) socket.send(frame('ready', { ready: true }));
    for (let i = 0; i < 60; i++) socket.send(frame('ready', { ready: false }));
    await inspectUntil(state => expect(state.ready).toEqual([true]));
    await disconnectAndCheck();
  });

  it('ignores player input before the join acknowledgement without creating an actor', async () => {
    socket = await connect(allowedOrigin, false);
    socket.send(frame('player_update', playerUpdate(99)));
    socket.send(Buffer.from([Protocol.JOIN_ROOM]));
    await inspectUntil(state => expect(state).toMatchObject({ clients: 1, members: 1, actors: 0 }));
    await disconnectAndCheck();
  });

  it('ignores double join acknowledgements without duplicating a player', async () => {
    socket = await connect();
    socket.send(Buffer.from([Protocol.JOIN_ROOM]));
    await pause(50);
    await inspectUntil(state => expect(state).toMatchObject({ clients: 1, members: 1, actors: 0 }));
    await disconnectAndCheck();
  });

  it('handles leave twice and releases the room', async () => {
    socket = await connect();
    socket.send(Buffer.from([Protocol.LEAVE_ROOM]));
    socket.send(Buffer.from([Protocol.LEAVE_ROOM]));
    await inspectUntil(state => expect(state).toMatchObject({ rooms: 0, exists: false, rates: 0, timers: 0 }));
    await assertHealthy();
  });

  it('forgets departing-player maps while a peer remains, then disposes the last-player room', async () => {
    const first = await connect();
    first.send(frame('ready', { ready: false }));
    first.send(frame('switch_team', { team: 0 }));
    first.send(frame('set_team_size', { teamSize: 5 }));
    first.send(frame('fill_bots', { fill: false }));
    const response = await fetch(`http://127.0.0.1:${port}/matchmake/joinById/${seat.roomId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: allowedOrigin }, body: JSON.stringify({ name: 'Peer' }),
    });
    expect(response.status).toBe(200);
    seat = await response.json();
    const peer = await connect();
    peer.send(frame('ready', { ready: false }));
    await rpc('playing');
    first.send(frame('player_update', playerUpdate()));
    first.send(frame('shot_event', { originX: 3, originY: 0, originZ: 0, dirX: 0, dirY: 0, dirZ: 1 }));
    first.send(frame('hit_report', { targetId: 'missing', zone: 'body' }));
    first.send(frame('breach_report'));
    await inspectUntil(state => expect(state).toMatchObject({ members: 2, actors: 2, rates: 9 }));
    first.terminate();
    await inspectUntil(state => expect(state).toMatchObject({ exists: true, clients: 1, members: 1, actors: 1, rates: 1 }));
    expect(peer.readyState).toBe(WebSocket.OPEN);
    await disconnectAndCheck();
  });

  it('keeps valid player updates and a normal input burst working', async () => {
    socket = await connect();
    await rpc('playing');
    for (let i = 0; i < 100; i++) socket.send(frame('player_update', playerUpdate(4)));
    await inspectUntil(state => expect(state).toMatchObject({ exists: true, members: 1, actors: 1, positions: [4] }));
    expect(socket.readyState).toBe(WebSocket.OPEN);
    await disconnectAndCheck();
  });

  it('disconnects only the malformed sender while a peer can still change ready state', async () => {
    const malformed = await connect();
    const response = await fetch(`http://127.0.0.1:${port}/matchmake/joinById/${seat.roomId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: allowedOrigin }, body: JSON.stringify({ name: 'Peer' }),
    });
    expect(response.status).toBe(200);
    seat = await response.json();
    const peer = await connect();
    const closed = once(malformed, 'close');
    malformed.send(frame('ready', null));
    expect((await closed)[0]).toBe(4002);
    peer.send(frame('ready', { ready: true }));
    await inspectUntil(state => expect(state).toMatchObject({ exists: true, members: 1, actors: 0, ready: [true] }));
    expect(peer.readyState).toBe(WebSocket.OPEN);
    await disconnectAndCheck();
  });

  it('retains non-browser clients without an Origin header', async () => {
    socket = await connect('');
    await inspectUntil(state => expect(state.members).toBe(1));
    await disconnectAndCheck();
  });

  it('rejects a hostile WebSocket Origin even with a valid seat reservation', async () => {
    const outcome = await connect('https://orbital-breach.vercel.app.attacker.example').then(() => 'accepted', (error: Error) => error.message);
    expect(outcome).toContain('403');
    // A rejected handshake does not consume the legitimate reservation.
    socket = await connect();
    await inspectUntil(state => expect(state.members).toBe(1));
    await disconnectAndCheck();
  });

  it('preserves sandboxed null-origin joins and allowlisted HTTP CORS', async () => {
    socket = await connect('null');
    const response = await fetch(`http://127.0.0.1:${port}/health`, { headers: { Origin: allowedOrigin } });
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
    const denied = await fetch(`http://127.0.0.1:${port}/health`, { headers: { Origin: 'https://attacker.example' } });
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
    await disconnectAndCheck();
  });
});
