import { describe, expect, it } from "vitest";
import {
  allLimbsDamaged,
  classifyHitZone,
  applyHit,
  findFullFreezeWinner,
  generateSpawnPositions,
  maxLaunchPower,
  resolveActorCollisions,
  spawnPosition,
} from "../shared/player-logic";
import { IDENTITY_QUATERNION, quaternionFromYawPitchRoll } from "../shared/hitZoneColliders";
import {
  BOTH_LEGS_HIT_LAUNCH_FACTOR,
  HITBOX_OFFSET_Y,
  HITBOX_RADIUS,
  MAX_LAUNCH_SPEED,
  ONE_LEG_HIT_LAUNCH_FACTOR,
} from "../shared/constants";
import { defaultHitZoneColliders } from "../client/src/player/hitZoneColliders";

describe("classifyHitZone", () => {
  const playerPos = { x: 0, y: 0, z: 0 };
  const facing = { x: 0, y: 0, z: -1 };

  it("classifies head and leg hits", () => {
    expect(classifyHitZone({ x: 0, y: 0.8, z: 0 }, playerPos, facing)).toBe("head");
    // Right leg — positive x projection on the right vector.
    expect(classifyHitZone({ x: 0.1, y: -0.4, z: 0 }, playerPos, facing)).toBe("rightLeg");
    // Left leg — negative x projection.
    expect(classifyHitZone({ x: -0.1, y: -0.4, z: 0 }, playerPos, facing)).toBe("leftLeg");
  });

  it("classifies right arm hits relative to facing", () => {
    expect(classifyHitZone({ x: 0.5, y: 0.1, z: 0 }, playerPos, facing)).toBe("rightArm");
  });

  it("keeps zone variety when using a tight hit sphere via hitRadius", () => {
    // Tight hit sphere: centre at y = HITBOX_OFFSET_Y, radius = HITBOX_RADIUS.
    // Thresholds scale with hitRadius so head/body/arm/legs stay reachable
    // even though the sphere is much smaller than PLAYER_RADIUS.
    const top = HITBOX_OFFSET_Y + HITBOX_RADIUS;
    const bottom = HITBOX_OFFSET_Y - HITBOX_RADIUS;
    expect(
      classifyHitZone({ x: 0, y: top, z: 0 }, playerPos, facing, HITBOX_OFFSET_Y, HITBOX_RADIUS),
    ).toBe("head");
    expect(
      classifyHitZone({ x: 0, y: HITBOX_OFFSET_Y, z: 0 }, playerPos, facing, HITBOX_OFFSET_Y, HITBOX_RADIUS),
    ).toBe("body");
    // Below the body band now splits into left/right by x projection.
    expect(
      classifyHitZone({ x: 0.05, y: bottom, z: 0 }, playerPos, facing, HITBOX_OFFSET_Y, HITBOX_RADIUS),
    ).toBe("rightLeg");
    expect(
      classifyHitZone({ x: -0.05, y: bottom, z: 0 }, playerPos, facing, HITBOX_OFFSET_Y, HITBOX_RADIUS),
    ).toBe("leftLeg");
    expect(
      classifyHitZone(
        { x: HITBOX_RADIUS * 0.8, y: HITBOX_OFFSET_Y, z: 0 },
        playerPos,
        facing,
        HITBOX_OFFSET_Y,
        HITBOX_RADIUS,
      ),
    ).toBe("rightArm");
  });

  it("hitOffsetY shifts the classification origin so a hit on the alien torso reads as body", () => {
    // With offset -0.35, a shot that lands 0.35 below physics centre
    // is at the sphere centre → y_rel ≈ 0 → body.
    expect(
      classifyHitZone({ x: 0, y: -0.35, z: 0 }, playerPos, facing, -0.35),
    ).toBe("body");
    // A shot that lands on the old "head" yRel > 0.55 but without the
    // offset would still be head; with the offset it becomes even
    // further above the sphere and still classifies as head.
    expect(
      classifyHitZone({ x: 0, y: 0.2, z: 0 }, playerPos, facing, -0.35),
    ).toBe("head");
  });

  it("keeps the normalized collider layout symmetric around the model centerline", () => {
    // Assert the symmetry property directly rather than snapshotting the whole
    // array — left/right pairs must mirror across x (opposite, equal magnitude)
    // and share the same y, z, and extents. Note arms and legs use opposite
    // x-sign conventions (leftArm is +x, leftLeg is -x), so we pair them up
    // explicitly instead of assuming a single sign rule.
    const byZone = (zone: string) =>
      defaultHitZoneColliders.find((collider) => collider.zone === zone)!;
    const pairs: Array<[string, string]> = [
      ["leftArm", "rightArm"],
      ["leftLeg", "rightLeg"],
    ];
    for (const [leftZone, rightZone] of pairs) {
      const left = byZone(leftZone);
      const right = byZone(rightZone);
      expect(left.position.x).toBeCloseTo(-right.position.x, 6);
      expect(left.position.x).not.toBe(0);
      expect(left.position.y).toBeCloseTo(right.position.y, 6);
      expect(left.position.z).toBeCloseTo(right.position.z, 6);
      expect(left.size).toEqual(right.size);
    }

    // Centerline colliders sit on x = 0.
    expect(byZone("head").position.x).toBe(0);
    expect(byZone("body").position.x).toBe(0);
  });

  it("classifies left vs right arm against the rotating colliders (identity orientation)", () => {
    // A shot landing on each arm collider's own position must classify as that
    // arm. This guards the left/right mapping that drives grab-drop behavior:
    // a leftArm hit drops the player's grab, a rightArm hit does not.
    const leftArm = defaultHitZoneColliders.find((c) => c.zone === "leftArm")!;
    const rightArm = defaultHitZoneColliders.find((c) => c.zone === "rightArm")!;

    expect(
      classifyHitZone(leftArm.position, playerPos, IDENTITY_QUATERNION),
    ).toBe("leftArm");
    expect(
      classifyHitZone(rightArm.position, playerPos, IDENTITY_QUATERNION),
    ).toBe("rightArm");
  });

  it("rotates arm zones with the model: a 180-degree yaw swaps which arm a fixed world shot hits", () => {
    // Same physical impact point in world space. Facing forward it lands on the
    // left arm; once the alien turns 180 degrees that same spot is now its right
    // arm. This is the regression that the old yaw-only heuristic could not
    // express and that a frozen-vs-floating playtest depends on.
    const worldShot = { x: 0.1375, y: -0.4, z: 0.0175 };
    expect(
      classifyHitZone(worldShot, playerPos, IDENTITY_QUATERNION),
    ).toBe("leftArm");
    expect(
      classifyHitZone(worldShot, playerPos, quaternionFromYawPitchRoll(Math.PI)),
    ).toBe("rightArm");
  });

  it("keeps arm zones attached through a 90-degree yaw", () => {
    // Rotate each arm collider's local position by +90 deg yaw (Ry: x'=z, z'=-x)
    // to get where it sits in world space, then classify the shot there. The arm
    // must follow the model's rotation. This catches under-rotation bugs in the
    // quaternion path that identity/180-degree tests (where w = 0) cannot see.
    const yaw90 = quaternionFromYawPitchRoll(Math.PI / 2);
    // leftArm local (0.1375, -0.4, 0.0175) -> world (0.0175, -0.4, -0.1375)
    expect(
      classifyHitZone({ x: 0.0175, y: -0.4, z: -0.1375 }, playerPos, yaw90),
    ).toBe("leftArm");
    // rightArm local (-0.1375, -0.4, 0.0175) -> world (-0.0175, -0.4, 0.1375)
    expect(
      classifyHitZone({ x: -0.0175, y: -0.4, z: 0.1375 }, playerPos, yaw90),
    ).toBe("rightArm");
  });

  it("classifies hits against rolled alien orientation instead of using yaw-only facing", () => {
    // Right-leg local point from the normalized collider target, rolled 180
    // degrees around forward so the collider stays attached to the model.
    const rolledRightLegHit = {
      x: -0.0975,
      y: 0.64,
      z: -0.01,
    };

    expect(
      classifyHitZone(
        rolledRightLegHit,
        playerPos,
        quaternionFromYawPitchRoll(0, 0, Math.PI),
        HITBOX_OFFSET_Y,
        HITBOX_RADIUS,
      ),
    ).toBe("rightLeg");
  });
});

describe("maxLaunchPower", () => {
  it("caps launch power by the number of damaged legs", () => {
    expect(
      maxLaunchPower({ frozen: false, leftArm: false, rightArm: false, leftLeg: false, rightLeg: false }),
    ).toBe(MAX_LAUNCH_SPEED);
    expect(
      maxLaunchPower({ frozen: false, leftArm: false, rightArm: false, leftLeg: true, rightLeg: false }),
    ).toBe(MAX_LAUNCH_SPEED * ONE_LEG_HIT_LAUNCH_FACTOR);
    expect(
      maxLaunchPower({ frozen: false, leftArm: false, rightArm: false, leftLeg: false, rightLeg: true }),
    ).toBe(MAX_LAUNCH_SPEED * ONE_LEG_HIT_LAUNCH_FACTOR);
    expect(
      maxLaunchPower({ frozen: false, leftArm: false, rightArm: false, leftLeg: true, rightLeg: true }),
    ).toBe(MAX_LAUNCH_SPEED * BOTH_LEGS_HIT_LAUNCH_FACTOR);
  });
});

describe("applyHit", () => {
  it("freezes a player on body hits and clears grab state", () => {
    const state = {
      damage: { frozen: false, leftArm: false, rightArm: false, leftLeg: false, rightLeg: false },
      deaths: 0,
      grabbedBarPos: { x: 1, y: 2, z: 3 },
      launchPower: 5,
      phase: "AIMING" as const,
      vel: { x: 0, y: 0, z: 0 },
    };

    const killed = applyHit(state, "body", { x: 1, y: 0, z: 0 });
    expect(killed).toBe(true);
    expect(state.phase).toBe("FROZEN");
    expect(state.damage.frozen).toBe(true);
    expect(state.grabbedBarPos).toBeNull();
    expect(state.deaths).toBe(1);
  });

  it("promotes to full freeze when the 4th limb is damaged", () => {
    const state = {
      damage: { frozen: false, leftArm: true, rightArm: true, leftLeg: true, rightLeg: false },
      deaths: 0,
      grabbedBarPos: null,
      launchPower: 0,
      phase: "FLOATING" as const,
      vel: { x: 0, y: 0, z: 0 },
    };

    const killed = applyHit(state, "rightLeg", { x: 0, y: 0, z: 0 });
    expect(killed).toBe(true);
    expect(state.damage.frozen).toBe(true);
    expect(state.phase).toBe("FROZEN");
    expect(state.deaths).toBe(1);
  });

  it("does not freeze on 3 limbs damaged", () => {
    const state = {
      damage: { frozen: false, leftArm: true, rightArm: true, leftLeg: false, rightLeg: false },
      deaths: 0,
      grabbedBarPos: null,
      launchPower: 0,
      phase: "FLOATING" as const,
      vel: { x: 0, y: 0, z: 0 },
    };

    const killed = applyHit(state, "leftLeg", { x: 0, y: 0, z: 0 });
    expect(killed).toBe(false);
    expect(state.damage.frozen).toBe(false);
    expect(state.phase).toBe("FLOATING");
  });
});

describe("spawnPosition", () => {
  it("spawns a player at the back of their breach room for round reset", () => {
    const pos = spawnPosition(0, {
      getBreachRoomCenter: () => ({ x: 23, y: 0, z: 0 }),
      getBreachOpenAxis: () => "x",
      getBreachOpenSign: () => -1,
    });

    expect(pos.x).toBeGreaterThan(23);
    expect(pos.y).toBeGreaterThan(-3);
  });
});

describe("generateSpawnPositions", () => {
  it("scatters a full 20-player team without overlap", () => {
    const slots = generateSpawnPositions(0, 20, {
      getBreachRoomCenter: () => ({ x: 12, y: 0, z: -6 }),
      getBreachOpenAxis: () => "x",
      getBreachOpenSign: () => -1,
    }, 1234);

    expect(slots).toHaveLength(20);

    for (let i = 0; i < slots.length; i += 1) {
      for (let j = i + 1; j < slots.length; j += 1) {
        const dx = slots[i].x - slots[j].x;
        const dy = slots[i].y - slots[j].y;
        const dz = slots[i].z - slots[j].z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        expect(distance).toBeGreaterThanOrEqual(1.6);
      }
    }
  });
});

describe("resolveActorCollisions", () => {
  it("separates overlapping bodies and keeps anchored bodies nearly fixed", () => {
    const bodies = [
      {
        anchored: true,
        pos: { x: 0, y: 0, z: 0 },
        radius: 0.8,
      },
      {
        pos: { x: 0.3, y: 0, z: 0 },
        radius: 0.8,
      },
    ];

    const moved = resolveActorCollisions(bodies, 2);

    expect(moved).toBe(true);
    expect(bodies[0].pos.x).toBeCloseTo(0, 4);
    expect(bodies[1].pos.x).toBeGreaterThanOrEqual(1.59);
  });

  it("cancels approach velocity but preserves tangential momentum", () => {
    // Two bodies on the x axis. A moves +x at 4, B moves -x at 4 (head-on).
    // Tangential component (z) is 2 on A — should survive the collision.
    const a = {
      pos: { x: 0, y: 0, z: 0 },
      radius: 0.5,
      vel: { x: 4, y: 0, z: 2 },
    };
    const b = {
      pos: { x: 0.6, y: 0, z: 0 },
      radius: 0.5,
      vel: { x: -4, y: 0, z: 0 },
    };

    resolveActorCollisions([a, b]);

    // Approach velocity along +x should be cancelled on both bodies.
    expect(a.vel.x).toBeLessThanOrEqual(0.01);
    expect(b.vel.x).toBeGreaterThanOrEqual(-0.01);
    // Tangential (z) velocity on A is preserved — momentum kept.
    expect(a.vel.z).toBeCloseTo(2, 4);
  });

  it("leaves velocities untouched when bodies are already separating", () => {
    const a = {
      pos: { x: 0, y: 0, z: 0 },
      radius: 0.5,
      vel: { x: -3, y: 0, z: 0 },
    };
    const b = {
      pos: { x: 0.6, y: 0, z: 0 },
      radius: 0.5,
      vel: { x: 3, y: 0, z: 0 },
    };

    resolveActorCollisions([a, b]);

    // They overlap — positions get pushed apart — but velocities are already
    // pointing away from each other, so the approach guard should leave them.
    expect(a.vel.x).toBeCloseTo(-3, 4);
    expect(b.vel.x).toBeCloseTo(3, 4);
  });
});

describe("allLimbsDamaged", () => {
  it("is true only when all four limbs are hit", () => {
    expect(
      allLimbsDamaged({ frozen: false, leftArm: true, rightArm: true, leftLeg: true, rightLeg: true }),
    ).toBe(true);
    expect(
      allLimbsDamaged({ frozen: false, leftArm: true, rightArm: true, leftLeg: true, rightLeg: false }),
    ).toBe(false);
    expect(
      allLimbsDamaged({ frozen: true, leftArm: false, rightArm: false, leftLeg: false, rightLeg: false }),
    ).toBe(false);
  });
});

describe("applyHit — arm asymmetry", () => {
  function grabbingState() {
    return {
      damage: { frozen: false, leftArm: false, rightArm: false, leftLeg: false, rightLeg: false },
      deaths: 0,
      grabbedBarPos: { x: 1, y: 2, z: 3 },
      launchPower: 5,
      phase: "GRABBING" as const,
      vel: { x: 0, y: 0, z: 0 },
    };
  }

  it("a left-arm hit drops the grab and sends the player FLOATING", () => {
    const state = grabbingState();
    const killed = applyHit(state, "leftArm", { x: 0, y: 0, z: 0 });
    expect(killed).toBe(false);
    expect(state.phase).toBe("FLOATING");
    expect(state.grabbedBarPos).toBeNull();
    expect(state.damage.leftArm).toBe(true);
  });

  it("a right-arm hit does NOT drop the grab", () => {
    const state = grabbingState();
    const killed = applyHit(state, "rightArm", { x: 0, y: 0, z: 0 });
    expect(killed).toBe(false);
    expect(state.phase).toBe("GRABBING");
    expect(state.grabbedBarPos).toEqual({ x: 1, y: 2, z: 3 });
    expect(state.damage.rightArm).toBe(true);
  });

  it("adds the impulse to the player's velocity", () => {
    const state = grabbingState();
    applyHit(state, "rightArm", { x: 2, y: -1, z: 0.5 });
    expect(state.vel).toEqual({ x: 2, y: -1, z: 0.5 });
  });
});

describe("findFullFreezeWinner", () => {
  const actor = (team: 0 | 1, frozen: boolean) => ({ team, frozen });

  it("returns null while both teams still have active players", () => {
    expect(
      findFullFreezeWinner([actor(0, false), actor(0, true), actor(1, false)]),
    ).toBeNull();
  });

  it("returns the surviving team when the other is fully frozen", () => {
    expect(findFullFreezeWinner([actor(0, true), actor(1, false)])).toBe(1);
    expect(findFullFreezeWinner([actor(0, false), actor(1, true), actor(1, true)])).toBe(0);
  });

  it("returns null on a mutual full freeze (no winner)", () => {
    expect(findFullFreezeWinner([actor(0, true), actor(1, true)])).toBeNull();
  });

  it("returns null when either team has no players at all", () => {
    expect(findFullFreezeWinner([actor(0, true)])).toBeNull();
    expect(findFullFreezeWinner([])).toBeNull();
  });
});

describe("generateSpawnPositions — edge cases", () => {
  const arena = {
    getBreachRoomCenter: () => ({ x: 0, y: 0, z: -23 }),
    getBreachOpenAxis: () => "z" as const,
    getBreachOpenSign: () => 1 as const,
  };

  it("returns an empty list for a non-positive count", () => {
    expect(generateSpawnPositions(0, 0, arena)).toEqual([]);
    expect(generateSpawnPositions(0, -3, arena)).toEqual([]);
  });

  it("is deterministic for the same seed", () => {
    const a = generateSpawnPositions(0, 5, arena, 42);
    const b = generateSpawnPositions(0, 5, arena, 42);
    expect(a).toEqual(b);
  });
});
