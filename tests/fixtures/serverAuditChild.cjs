// Isolated real server: a malformed packet must not crash the Vitest worker.
// Transpile the checked-in source so CI can run tests before production builds.
const fs = require('node:fs');
const ts = require('../../server/node_modules/typescript');
require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, useDefineForClassFields: false },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
};

const { Server, matchMaker } = require('../../server/node_modules/@colyseus/core');
const { ActorState } = require('../../server/src/colyseus/state.ts');
const listen = Server.prototype.listen;
let server;
let inspectedRoom;
Server.prototype.listen = async function (...args) {
  server = this;
  const result = await listen.apply(this, args);
  // Let index.ts finish installing its HTTP limiter before reporting readiness.
  setImmediate(() => process.send({ ready: this.transport.server.address().port }));
  return result;
};

process.on('message', async ({ id, action, roomId }) => {
  if (action === 'stop') {
    await server.gracefullyShutdown(false);
    process.exit(0);
  }
  const room = matchMaker.getLocalRoomById(roomId);
  if (room) inspectedRoom = room;
  if (action === 'playing' && room) {
    // Fixture setup only; gameplay startup is covered by the manual smoke.
    room.state.phase = 'PLAYING';
    for (const member of room.state.members.values()) {
      const actor = new ActorState();
      Object.assign(actor, { id: member.id, name: member.name, team: member.team, phase: 'FLOATING', posX: 3 });
      room.state.actors.set(member.id, actor);
    }
  }
  const rooms = await matchMaker.query({});
  // Keep the inspected object after disposal to verify its maps and timers,
  // rather than treating absence from the directory as proof of cleanup.
  const resources = room || inspectedRoom;
  process.send({ id, result: {
    rooms: rooms.length,
    exists: !!room,
    clients: resources?.clients.length ?? 0,
    members: resources?.state.members.size ?? 0,
    actors: resources?.state.actors.size ?? 0,
    ready: room ? [...room.state.members.values()].map(m => m.ready) : [],
    positions: room ? [...room.state.actors.values()].map(a => a.posX) : [],
    rates: resources ? ['shotEvents', 'readyActions', 'switchTeamActions', 'teamSizeActions', 'fillBotsActions', 'lastPlayerUpdate', 'lastHitReport', 'lastBreachReport'].reduce((n, key) => n + resources[key].size, 0) : 0,
    timers: resources ? ['countdownTimer', 'roundTimer', 'roundEndTimer', 'roundResolveTimer', 'matchTick'].filter(key => resources[key] !== null).length : 0,
  }});
});

require('../../server/src/index.ts');
