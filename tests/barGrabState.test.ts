import { describe, expect, it, vi } from 'vitest';
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { LocalPlayer } from '../client/src/player/localPlayer';
import { CameraController } from '../client/src/camera';
import { Arena } from '../client/src/arena/arena';
import { BarObject } from '../client/src/arena/bar';
import type { InputManager } from '../client/src/input';
import { generateArenaLayout } from '../shared/arena-gen';
import { advanceBodyWorld, bodyClearsDiamond } from '../shared/bodyCollider';
import { BAR_LENGTH, BAR_RADIUS, GRAB_RADIUS, PLAYER_DIAMOND_AABB_INSET } from '../shared/constants';

vi.mock('../client/src/player/alienRenderAsset', () => ({ loadAlienRenderClone: () => new Promise(() => {}) }));
vi.mock('../client/src/player/playerThirdPersonGun', () => ({ ThirdPersonGun: class {} }));

// No renderer, assets, DOM or sockets. Exercise the real input-consuming state
// machine against deterministic arena collision math, not mesh appearances.
function fixture() {
  const scene = new Scene(), arena = new Arena(scene), layout = generateArenaLayout(1);
  const obstacle = layout.obstacles[0], definition = obstacle.bars[0];
  const position = new Vector3().copy(obstacle.pos).add(definition.localPos);
  const direction = new Vector3().copy(definition.normal);
  const tip = position.clone().addScaledVector(direction, BAR_LENGTH / 2 - BAR_RADIUS * .25);
  const full = layout.obstacles.map(o => new Box3(new Vector3(o.pos.x-o.size.x/2,o.pos.y-o.size.y/2,o.pos.z-o.size.z/2),new Vector3(o.pos.x+o.size.x/2,o.pos.y+o.size.y/2,o.pos.z+o.size.z/2)));
  const inset = full.map(b => {
    const center = b.getCenter(new Vector3()), half = b.getSize(new Vector3()).multiplyScalar(PLAYER_DIAMOND_AABB_INSET/2);
    return new Box3(center.clone().sub(half), center.clone().add(half));
  });
  Object.assign(arena, { physicsBoxes: full, playerCollisionBoxes: inset, barObjects: [new BarObject(scene,position,definition.normal)] });
  const player = new LocalPlayer(scene), cam = new CameraController(new PerspectiveCamera());
  player.phase = 'FLOATING'; player.phys.pos.copy(tip).add(direction);
  let pressed = false, aiming = false;
  const input = {
    consumeGrab: () => { const value=pressed; pressed=false; return value; },
    isAiming: () => aiming, consumeAimDelta: () => ({dy:0}),
    getWalkAxes: () => ({x:0,z:0}), isJumping: () => false,
  } as unknown as InputManager;
  return { player, cam, arena, tip, full, inset, input,
    press: () => { pressed=true; }, aim: (value:boolean) => { aiming=value; },
    tick: () => player.update(input,cam,arena,1/60) };
}

describe('bar grab collision regression', () => {
  it('grabs on the first near-bar press despite the empty diamond AABB corner', () => {
    const f=fixture();
    expect(f.player.phys.pos.distanceTo(f.tip)).toBeLessThan(GRAB_RADIUS);
    f.press(); f.tick();
    expect(f.player.phase).toBe('GRABBING'); expect(f.player.isAttachedToBar()).toBe(true);
    // This is the original failure: the broad inset box moves a legal hold,
    // so LocalPlayer's obstruction guard used to cancel it in the same frame.
    const q=f.player.getVisualQuaternion(), pos=f.player.phys.pos.clone();
    const state={pos:pos.clone(),vel:new Vector3()};
    advanceBodyWorld(state,0,q,'GRABBING',f.inset);
    expect(state.pos.distanceTo(pos)).toBeGreaterThan(.5);
    expect(bodyClearsDiamond(pos,q,'GRABBING',f.full[0])).toBe(true);
  });
  it('keeps a fast second press attached, including presses coalesced before a frame', () => {
    const f=fixture();
    f.press(); f.press(); f.tick();
    expect(f.player.isAttachedToBar()).toBe(true);
    f.press(); f.tick();
    for(let i=0;i<120;i++) f.tick();
    expect(f.player.phase).toBe('GRABBING'); expect(f.player.grabbedBarPos?.distanceTo(f.tip)).toBeLessThan(1e-8);
  });
  it('consumes repeated grab presses while aiming rather than queuing a regrab after launch', () => {
    const f=fixture(); f.press(); f.tick(); f.aim(true); f.tick();
    f.press(); f.tick();
    expect(f.player.phase).toBe('AIMING'); expect(f.input.consumeGrab()).toBe(false);
    f.aim(false); f.tick();
    expect(f.player.phase).toBe('FLOATING'); expect(f.player.isAttachedToBar()).toBe(false);
  });
  it('still rejects holds inside solid geometry and against arena walls', () => {
    const f=fixture(); f.press(); f.tick();
    expect(bodyClearsDiamond({x:0,y:0,z:0},f.player.getVisualQuaternion(),'GRABBING',f.full[0])).toBe(false);
    f.player.grabbedBarPos!.set(40,0,0); f.tick();
    expect(f.player.isAttachedToBar()).toBe(false);
    expect(f.player.phase).toBe('FLOATING');
  });
});
