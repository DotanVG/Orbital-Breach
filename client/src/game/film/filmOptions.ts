export const FILM_CAMERAS = ['bot-pov', 'chase', 'side-track', 'orbit', 'portal-cam', 'free-fly'] as const;
export const FILM_SCENARIOS = ['launch', 'freeze', 'breach', 'fullfreeze', 'war', 'victory', 'lobby', 'menu'] as const;
export type FilmCamera = typeof FILM_CAMERAS[number];
export type FilmScenario = typeof FILM_SCENARIOS[number];

export function parseFilmOptions(search: string, development: boolean) {
  const p = new URLSearchParams(search);
  if (!development || p.get('film') !== '1') return null;
  const camera = p.get('film_camera');
  const scenario = p.get('film_scenario');
  const scale = Number(p.get('film_timescale') ?? 1);
  const seed = Number(p.get('film_seed') ?? 15);
  return {
    camera: FILM_CAMERAS.includes(camera as FilmCamera) ? camera as FilmCamera : 'chase' as FilmCamera,
    scenario: FILM_SCENARIOS.includes(scenario as FilmScenario) ? scenario as FilmScenario : 'launch' as FilmScenario,
    target: p.get('film_target') || 'auto',
    director: p.get('film_director') === '1',
    hud: p.get('film_hud') === 'min' ? 'min' : p.get('film_hud') === '1' ? '1' : '0',
    timescale: Number.isFinite(scale) ? Math.max(0.1, Math.min(1, scale)) : 1,
    seed: Number.isSafeInteger(seed) ? seed : 15,
    hold: p.get('film_hold') === '1',
  };
}

/** Exact exponential response, independent of refresh rate. */
export function filmResponse(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * Math.max(0, dt));
}

export function directorCamera(event: string, shotSeconds: number, current?: FilmCamera): FilmCamera | null {
  if (shotSeconds < 2.5) return null;
  switch (event) {
    case 'launch': return current === 'side-track' ? 'chase' : 'side-track';
    case 'limb-hit': case 'freeze': return current === 'bot-pov' ? 'chase' : 'bot-pov';
    case 'breach': return 'portal-cam';
    case 'fullFreeze': case 'roundWin': return 'orbit';
    case 'matchEnd': return 'chase';
    default: return null;
  }
}
