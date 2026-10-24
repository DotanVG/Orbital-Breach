import { describe, expect, it } from 'vitest';
import { directorCamera, FILM_CAMERAS, FILM_SCENARIOS, filmResponse, parseFilmOptions } from '../client/src/game/film/filmOptions';
import { filmShots } from '../client/src/game/film/filmShots';

describe('filmShots', () => {
  it('covers the capture contract with unique names and a long director take per gameplay preset', () => {
    const shots = filmShots();
    expect(new Set(shots.map(s => s.name)).size).toBe(shots.length);
    for (const scenario of ['launch', 'freeze', 'breach', 'fullfreeze', 'war', 'victory']) {
      expect(shots.some(s => s.scenario === scenario && s.director && s.seconds === 90)).toBe(true);
      expect(shots.filter(s => s.scenario === scenario && s.camera === 'bot-pov').length).toBeGreaterThanOrEqual(2);
    }
    expect(shots.filter(s => s.scenario === 'breach' && s.camera === 'portal-cam')).toHaveLength(3);
    expect(shots.filter(s => s.scenario === 'freeze' && s.camera === 'bot-pov')).toHaveLength(3);
  });
});

describe('Film Mode options', () => {
  it('is disabled in production even with every film parameter', () => {
    expect(parseFilmOptions('?film=1&film_director=1&film_scenario=war', false)).toBeNull();
    expect(parseFilmOptions('?film=0', true)).toBeNull();
    expect(parseFilmOptions('', true)).toBeNull();
  });
  it('accepts every camera and scenario and preserves explicit targets', () => {
    for (const camera of FILM_CAMERAS) for (const scenario of FILM_SCENARIOS) {
      expect(parseFilmOptions(`?film=1&film_camera=${camera}&film_scenario=${scenario}&film_target=bot-cyan-0`, true))
        .toMatchObject({ camera, scenario, target: 'bot-cyan-0' });
    }
  });
  it('bounds invalid values and handles capture controls', () => {
    expect(parseFilmOptions('?film=1&film_camera=bad&film_scenario=bad&film_seed=NaN&film_timescale=Infinity', true))
      .toMatchObject({ camera: 'chase', scenario: 'launch', seed: 15, timescale: 1 });
    expect(parseFilmOptions('?film=1&film_timescale=-1&film_hud=min&film_director=1&film_hold=1', true))
      .toMatchObject({ timescale: 0.1, hud: 'min', director: true, hold: true });
    expect(parseFilmOptions('?film=1&film_timescale=9', true)?.timescale).toBe(1);
  });
});

describe('filmResponse', () => {
  it('has the same response over one second at 30 and 120 fps', () => {
    const response = (fps: number) => {
      let value = 0;
      for (let i = 0; i < fps; i++) value += (1 - value) * filmResponse(6, 1 / fps);
      return value;
    };
    expect(response(30)).toBeCloseTo(response(120), 12);
    expect(filmResponse(6, -1)).toBe(0);
  });
});

describe('directorCamera', () => {
  it('enforces the minimum shot length for every event', () => {
    for (const event of ['launch', 'limb-hit', 'freeze', 'breach', 'fullFreeze', 'roundWin', 'matchEnd']) {
      expect(directorCamera(event, 2.49)).toBeNull();
      expect(directorCamera(event, 2.5)).not.toBeNull();
    }
    expect(directorCamera('unknown', 10)).toBeNull();
  });
});
