import { describe, expect, it } from 'vitest';
import { buildSync } from '../client/node_modules/esbuild';

describe('server hit-validation dependency boundary',()=>{
  it('bundles the real room and its shared dependencies without mesh/animation code',()=>{
    const {metafile}=buildSync({entryPoints:['server/src/colyseus/OrbitalLobbyRoom.ts'],bundle:true,platform:'node',packages:'external',write:false,metafile:true});
    const inputs=Object.keys(metafile!.inputs).join('\n');
    expect(inputs).toContain('shared/player-logic.ts');
    expect(inputs).not.toMatch(/projectileCollider|hitSurface|client\/|three|gltf|animation/i);
    const external=Object.values(metafile!.outputs).flatMap(o=>o.imports).map(i=>i.path).join('\n');
    expect(external).not.toMatch(/three|gltf|animation/i);
  });
});
