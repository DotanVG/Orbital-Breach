import type { FilmCamera, FilmScenario } from './filmOptions';

/** The local capture reel; every take gets a fresh, warmed bot match. */
export function filmShots(from = 0, selection = '1') {
  const shots: { name: string; scenario: FilmScenario; camera: FilmCamera; seconds: number; seed: number; director: boolean; scale: number; debrief?: boolean }[] = [];
  const add = (scenario: FilmScenario, camera: FilmCamera, takes: number, seconds = 15, director = false) => {
    for (let take = 1; take <= takes; take++) shots.push({
      name: `${scenario}_${director ? 'director' : camera}_${String(take).padStart(2, '0')}`,
      scenario, camera, seconds, seed: scenario === 'launch' || scenario === 'fullfreeze' ? 16 : 14 + take, director,
      scale: scenario === 'war' || scenario === 'victory' || director ? 1 : 0.5,
    });
  };
  for (const scenario of ['launch', 'freeze', 'breach', 'fullfreeze', 'war', 'victory'] as const) {
    add(scenario, 'bot-pov', scenario === 'freeze' ? 3 : 2, scenario === 'victory' ? 25 : 15);
    add(scenario, 'side-track', scenario === 'breach' ? 3 : 2, scenario === 'victory' ? 25 : 15);
  }
  add('breach', 'portal-cam', 3);
  add('war', 'orbit', 2);
  add('victory', 'chase', 2, 25);
  add('victory', 'orbit', 2, 25);
  shots.push({ name: 'debrief_awards_01', scenario: 'victory', camera: 'orbit', seconds: 8, seed: 16, director: false, scale: 1, debrief: true });
  add('menu', 'orbit', 1, 5);
  add('lobby', 'bot-pov', 2, 8);
  add('lobby', 'chase', 2, 8);
  for (const scenario of ['launch', 'freeze', 'breach', 'fullfreeze', 'war', 'victory'] as const) add(scenario, 'chase', 1, 90, true);
  return shots.slice(Math.max(0, Math.min(shots.length, Math.trunc(from))))
    .filter(s => selection === '1' || selection.split(',').includes(s.name));
}
