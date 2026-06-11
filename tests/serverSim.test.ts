import { describe, expect, it } from "vitest";
import Sim from "../server/src/sim";
import ServerPlayer from "../server/src/player";
import type { ClientInputMsg } from "../shared/schema";
import {
  ARENA_SIZE,
  FREEZE_TIME,
  INVULN_TIME,
  MAX_SPEED,
  PLAYER_RADIUS,
  RESPAWN_TIME,
} from "../shared/constants";

function makeInput(overrides: Partial<ClientInputMsg> = {}): ClientInputMsg {
  return {
    t: "input",
    id: "p1",
    seq: 1,
    walkAxes: { x: 0, z: 0 },
    grab: false,
    aiming: false,
    fire: false,
    rot: { yaw: 0, pitch: 0 },
    phase: "FLOATING",
    ...overrides,
  };
}

describe("ServerPlayer", () => {
  it("spawns on its team's side with zeroed velocity and undamaged limbs", () => {
    const cyan = new ServerPlayer("Cyan", 0);
    const magenta = new ServerPlayer("Magenta", 1);
    expect(cyan.pos).toEqual({ x: 0, y: 0, z: -15 });
    expect(magenta.pos).toEqual({ x: 0, y: 0, z: 15 });
    expect(cyan.vel).toEqual({ x: 0, y: 0, z: 0 });
    expect(cyan.damage).toEqual({
      frozen: false,
      rightArm: false,
      leftArm: false,
      leftLeg: false,
      rightLeg: false,
    });
    expect(cyan.id).not.toBe(magenta.id);
  });

  it("maps server state to net phase in toNetState", () => {
    const p = new ServerPlayer("Pilot", 0);
    expect(p.toNetState().phase).toBe("FLOATING");
    p.state = "FROZEN";
    expect(p.toNetState().phase).toBe("FROZEN");
    p.state = "RESPAWNING";
    expect(p.toNetState().phase).toBe("RESPAWNING");
  });

  it("snapshots copies of pos/vel/damage, not live references", () => {
    const p = new ServerPlayer("Pilot", 0);
    const net = p.toNetState();
    p.pos.x = 99;
    p.damage.frozen = true;
    expect(net.pos.x).toBe(0);
    expect(net.damage.frozen).toBe(false);
  });
});

describe("Sim", () => {
  it("adds and removes players by id", () => {
    const sim = new Sim();
    const p = new ServerPlayer("Pilot", 0);
    sim.addPlayer(p);
    expect(sim.players.get(p.id)).toBe(p);
    sim.removePlayer(p.id);
    expect(sim.players.size).toBe(0);
  });

  it("applies newer input rotation and ignores stale sequence numbers", () => {
    const sim = new Sim();
    const p = new ServerPlayer("Pilot", 0);
    sim.addPlayer(p);

    p.lastInput = makeInput({ seq: 5, rot: { yaw: 1.2, pitch: -0.3 } });
    sim.tick(0.05);
    expect(p.rot.yaw).toBeCloseTo(1.2, 6);
    expect(p.rot.pitch).toBeCloseTo(-0.3, 6);
    expect(p.seq).toBe(5);

    p.lastInput = makeInput({ seq: 4, rot: { yaw: 0, pitch: 0 } });
    sim.tick(0.05);
    expect(p.rot.yaw).toBeCloseTo(1.2, 6); // stale input rejected
    expect(p.seq).toBe(5);
  });

  it("accelerates forward along -Z at zero yaw", () => {
    const sim = new Sim();
    const p = new ServerPlayer("Pilot", 0);
    sim.addPlayer(p);

    let seq = 0;
    for (let i = 0; i < 10; i += 1) {
      p.lastInput = makeInput({ seq: ++seq, walkAxes: { x: 0, z: 1 } });
      sim.tick(0.02);
    }

    expect(p.vel.z).toBeLessThan(0); // forward is -Z at yaw 0
    expect(p.vel.x).toBeCloseTo(0, 6);
    expect(p.pos.z).toBeLessThan(-15); // drifted forward from spawn
  });

  it("caps speed at MAX_SPEED", () => {
    const sim = new Sim();
    const p = new ServerPlayer("Pilot", 0);
    sim.addPlayer(p);

    // Large dt makes per-tick acceleration outrun damping; pin the player to
    // the arena centre each tick so walls and goals never interfere.
    let seq = 0;
    for (let i = 0; i < 100; i += 1) {
      p.pos = { x: 0, y: 0, z: 0 };
      p.lastInput = makeInput({ seq: ++seq, walkAxes: { x: 0, z: 1 } });
      sim.tick(0.2);
    }

    const speed = Math.hypot(p.vel.x, p.vel.y, p.vel.z);
    expect(speed).toBeLessThanOrEqual(MAX_SPEED + 1e-9);
    expect(speed).toBeGreaterThan(MAX_SPEED * 0.9);
  });

  it("bounces players off the arena walls with halved reflected velocity", () => {
    const sim = new Sim();
    const p = new ServerPlayer("Pilot", 0);
    sim.addPlayer(p);
    const limit = ARENA_SIZE / 2 - PLAYER_RADIUS;

    // No lastInput → integration is skipped; the tick only runs wall checks.
    p.pos.x = limit + 1;
    p.vel.x = 4;
    sim.tick(0.05);

    expect(p.pos.x).toBe(limit);
    expect(p.vel.x).toBe(-2); // -|4| * 0.5
  });

  it("thaws a frozen player back to ACTIVE after FREEZE_TIME", () => {
    const sim = new Sim();
    const p = new ServerPlayer("Pilot", 0);
    sim.addPlayer(p);
    p.state = "FROZEN";
    p.frozenTimer = FREEZE_TIME;

    sim.tick(FREEZE_TIME / 2);
    expect(p.state).toBe("FROZEN");
    sim.tick(FREEZE_TIME / 2 + 0.01);
    expect(p.state).toBe("ACTIVE");
  });

  it("respawns a player at base with invulnerability after RESPAWN_TIME", () => {
    const sim = new Sim();
    const p = new ServerPlayer("Pilot", 1);
    sim.addPlayer(p);
    p.state = "RESPAWNING";
    p.respawnTimer = RESPAWN_TIME;
    p.pos = { x: 5, y: 5, z: 5 };
    p.vel = { x: 1, y: 1, z: 1 };

    // Tick in small steps — invulnTimer starts counting down the same tick
    // the respawn fires, so one giant dt would also consume the invuln window.
    for (let t = 0; t < RESPAWN_TIME + 0.05; t += 0.1) {
      sim.tick(0.1);
    }

    expect(p.state).toBe("ACTIVE");
    expect(p.invulnTimer).toBeGreaterThan(0);
    expect(p.invulnTimer).toBeLessThanOrEqual(INVULN_TIME);
    expect(p.pos).toEqual({ x: 0, y: 0, z: 15 }); // team 1 base
    expect(p.vel).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("handleShot freezes the target and knocks it away from the shooter", () => {
    const sim = new Sim();
    const shooter = new ServerPlayer("Shooter", 0);
    const target = new ServerPlayer("Target", 1);
    sim.addPlayer(shooter);
    sim.addPlayer(target);
    shooter.pos = { x: 0, y: 0, z: 0 };
    target.pos = { x: 2, y: 0, z: 0 };

    sim.handleShot(shooter.id, target.id);

    expect(target.state).toBe("FROZEN");
    expect(target.frozenTimer).toBe(FREEZE_TIME);
    expect(target.vel.x).toBeCloseTo(3, 6); // unit direction * 3 impulse
    expect(target.vel.y).toBeCloseTo(0, 6);
  });

  it("handleShot ignores invulnerable, already-frozen, and unknown targets", () => {
    const sim = new Sim();
    const shooter = new ServerPlayer("Shooter", 0);
    const target = new ServerPlayer("Target", 1);
    sim.addPlayer(shooter);
    sim.addPlayer(target);

    target.invulnTimer = 0.5;
    sim.handleShot(shooter.id, target.id);
    expect(target.state).toBe("ACTIVE");

    target.invulnTimer = 0;
    target.state = "FROZEN";
    target.frozenTimer = 1;
    sim.handleShot(shooter.id, target.id);
    expect(target.frozenTimer).toBe(1); // not re-frozen

    expect(() => sim.handleShot(shooter.id, "missing-id")).not.toThrow();
  });

  it("scores and respawns a player who reaches the enemy goal", () => {
    const sim = new Sim();
    const p = new ServerPlayer("Pilot", 0);
    sim.addPlayer(p);
    p.pos = { x: 0, y: 0, z: 19.9 }; // team 0 attacks +Z goal at z=20
    p.lastInput = makeInput({ seq: 1 });

    sim.tick(0.0001);

    expect(sim.score.team0).toBe(1);
    expect(sim.score.team1).toBe(0);
    expect(p.state).toBe("RESPAWNING");
    expect(p.pos.z).toBe(-15);
  });

  it("getSnapshot returns the wire-format state and bumps seq each call", () => {
    const sim = new Sim();
    const p = new ServerPlayer("Pilot", 0);
    sim.addPlayer(p);

    const first = sim.getSnapshot();
    expect(first.t).toBe("state");
    expect(first.players).toHaveLength(1);
    expect(first.players[0].id).toBe(p.id);
    expect(first.score).toEqual({ team0: 0, team1: 0 });
    expect(first.phase).toBe("LOBBY");

    const second = sim.getSnapshot();
    expect(second.seq).toBe(first.seq + 1);

    sim.removePlayer(p.id);
    expect(sim.getSnapshot().players).toHaveLength(0);
  });
});
