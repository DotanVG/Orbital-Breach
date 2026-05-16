import * as THREE from "three";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { applyTeamAccent } from "../client/src/player/teamAccent";
import {
  getDebriefScoreStateClass,
  sortDebriefPlayers,
  type DebriefPlayer,
} from "../client/src/ui/debrief";
import { buildRoundEndHtml, getTeamHintPalette } from "../client/src/render/hud";
import { getTeamRelationLabel } from "../client/src/ui/multiplayerLobby";

describe("applyTeamAccent", () => {
  it("reapplies local-player team tint from the original material state", () => {
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#7a8699"),
      emissive: new THREE.Color("#112233"),
      emissiveIntensity: 0.12,
    });
    const baseColor = bodyMaterial.color.clone();
    const baseEmissive = bodyMaterial.emissive.clone();
    const glassMaterial = new THREE.MeshStandardMaterial({
      name: "Glass",
      color: new THREE.Color("#334455"),
      emissive: new THREE.Color("#000000"),
      emissiveIntensity: 0.05,
    });
    const baseGlassColor = glassMaterial.color.clone();

    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), bodyMaterial));
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), glassMaterial));

    applyTeamAccent(root, 0, "player");
    applyTeamAccent(root, 1, "player");

    const expectedColor = baseColor.clone().lerp(new THREE.Color("#ff4fd8"), 0.14);
    const expectedEmissive = baseEmissive.clone().lerp(new THREE.Color("#ff4fd8"), 0.4);

    expect(bodyMaterial.color.r).toBeCloseTo(expectedColor.r, 5);
    expect(bodyMaterial.color.g).toBeCloseTo(expectedColor.g, 5);
    expect(bodyMaterial.color.b).toBeCloseTo(expectedColor.b, 5);
    expect(bodyMaterial.emissive.r).toBeCloseTo(expectedEmissive.r, 5);
    expect(bodyMaterial.emissive.g).toBeCloseTo(expectedEmissive.g, 5);
    expect(bodyMaterial.emissive.b).toBeCloseTo(expectedEmissive.b, 5);
    expect(bodyMaterial.emissiveIntensity).toBeCloseTo(0.65, 5);
    expect(glassMaterial.color.equals(baseGlassColor)).toBe(true);
  });
});

describe("player-relative team UI helpers", () => {
  it("uses team-colored palettes for in-game hint text", () => {
    const cyan = getTeamHintPalette(0);
    const magenta = getTeamHintPalette(1);

    expect(cyan.textColor).toBe("#aaffff");
    expect(cyan.glowColor).toBe("#00ffff");
    expect(cyan.panelBg).toContain("rgba(0,8,8");
    expect(magenta.textColor).toBe("#ffaaff");
    expect(magenta.glowColor).toBe("#ff00ff");
    expect(magenta.panelBg).toContain("rgba(8,0,8");
    expect(magenta.powerGradient).toContain("255, 130, 239");
  });

  it("gives Play Online a dedicated hover style instead of generic secondary cyan only", () => {
    const menuView = readFileSync(new URL("../client/src/ui/menu/menuView.ts", import.meta.url), "utf8");

    expect(menuView).toContain("ob-btn-online::before");
    expect(menuView).toContain(".ob-btn-online:hover");
    expect(menuView).toContain('id === "btn-play-online" ? " ob-btn-online"');
    expect(menuView).toContain("#ffd670");
  });

  it("marks friendly and hostile teams relative to the local player", () => {
    expect(getTeamRelationLabel(0, 0)).toBe("Friendly");
    expect(getTeamRelationLabel(0, 1)).toBe("Hostile");
    expect(getTeamRelationLabel(1, 0)).toBe("Hostile");
    expect(getTeamRelationLabel(1, 1)).toBe("Friendly");
  });

  it("sorts debrief players with the local team first and self at the top", () => {
    const players: DebriefPlayer[] = [
      { id: "cyan-1", name: "Cyan Wing", team: 0, breaches: 5, freezes: 2, frozen: 1, travelDistance: 42, isBot: false, isSelf: false },
      { id: "self", name: "Magenta Self", team: 1, breaches: 1, freezes: 3, frozen: 0, travelDistance: 58, isBot: false, isSelf: true },
      { id: "magenta-2", name: "Magenta Ally", team: 1, breaches: 4, freezes: 1, frozen: 2, travelDistance: 31, isBot: false, isSelf: false },
    ];

    const sorted = sortDebriefPlayers(players, 1);

    expect(sorted.map((player) => player.id)).toEqual(["self", "magenta-2", "cyan-1"]);
    expect(getDebriefScoreStateClass(1, 1)).toBe("ob-win");
    expect(getDebriefScoreStateClass(0, 1)).toBe("ob-loss");
  });

  it("formats round-end banners with a colored team name and breached wording", () => {
    const roundHtml = buildRoundEndHtml({ team: 1 });
    const freezeHtml = buildRoundEndHtml({ team: 1, kind: "freeze", enemyTeam: 0 });
    const matchHtml = buildRoundEndHtml({ team: 0, matchScore: { team0: 5, team1: 3 } });
    const technicalWinHtml = buildRoundEndHtml({ team: 0, kind: "disconnect" });
    const tieHtml = buildRoundEndHtml("tie");
    const hudView = readFileSync(new URL("../client/src/render/hud/hudView.ts", import.meta.url), "utf8");

    expect(roundHtml).toContain("ob-round-end__line");
    expect(roundHtml).toContain("ob-round-end__team--magenta");
    expect(roundHtml).toContain("MAGENTA");
    expect(roundHtml).toContain("BREACHED");
    expect(freezeHtml).toContain("FROZE");
    expect(freezeHtml).toContain("ob-round-end__team--magenta");
    expect(freezeHtml).toContain("ob-round-end__team--cyan");
    expect(freezeHtml).toContain("MAGENTA");
    expect(freezeHtml).toContain("CYAN");
    expect(matchHtml).toContain("ob-round-end__team--cyan");
    expect(matchHtml).toContain("WINS");
    expect(matchHtml).toContain("5 - 3");
    expect(technicalWinHtml).toContain("TECHNICAL WIN!");
    expect(technicalWinHtml).toContain("All humans on ");
    expect(technicalWinHtml).toContain(" disconnected");
    expect((technicalWinHtml.match(/ob-round-end__line/g) ?? [])).toHaveLength(2);
    expect(technicalWinHtml).toContain("ob-round-end__team--magenta");
    expect(technicalWinHtml).toContain("MAGENTA");
    expect(hudView).toContain("flex-direction: column;");
    expect(tieHtml).toContain(">TIE<");
  });
});
