/** Shared by the victory camera and its DOM title. Coordinates are from the top left. */
export function getVictoryLayout(aspect: number) {
  return {
    titleY: 0.275,
    characterX: aspect < 1 ? 0.5 : 0.26,
    characterY: aspect < 1 ? 0.45 : 0.6,
  };
}

export function getVictoryMotion(elapsed: number, dt: number, reducedMotion: boolean) {
  const nextElapsed = reducedMotion ? elapsed : elapsed + dt;
  return {
    elapsed: nextElapsed,
    animationDt: reducedMotion ? 0 : dt,
    orbitAngle: reducedMotion ? 0.25 : 0.25 + nextElapsed * 0.35,
  };
}

export function shouldTickCombat(
  mode: "menu" | "solo" | "online",
  celebrating: boolean,
  statisticsVisible: boolean,
  onlineGameActive: boolean,
): boolean {
  return !celebrating && !statisticsVisible
    && (mode === "solo" || (mode === "online" && onlineGameActive));
}
