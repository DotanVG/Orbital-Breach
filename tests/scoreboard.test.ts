import { describe, expect, it } from "vitest";

import { buildScoreboardHtml } from "../client/src/render/hud/scoreboard";

describe("buildScoreboardHtml", () => {
  it("renders separate team panels with hidden enemy freeze state", () => {
    const html = buildScoreboardHtml(
      [
        {
          id: "self",
          name: "Pilot",
          frozen: false,
          kills: 3,
          deaths: 1,
          ping: 0,
          isBot: false,
        },
      ],
      [
        {
          id: "enemy",
          name: "Bandit",
          kills: 2,
          deaths: 4,
          ping: 58,
          isBot: true,
        },
      ],
      {
        ownTeamId: 0,
        showPing: true,
      },
    );

    expect(html).toContain("Cyan // Your squad");
    expect(html).toContain("Magenta // Opposition");
    expect(html).toContain("Clear");
    expect(html).toContain("Hidden");
    expect(html).toContain("YOU");
    expect(html).toContain("BOT");
    expect(html).toContain("58ms");
  });

  it("omits ping columns for solo scoreboards", () => {
    const html = buildScoreboardHtml(
      [
        {
          id: "self",
          name: "Pilot",
          frozen: true,
          kills: 1,
          deaths: 2,
          ping: 0,
          isBot: false,
        },
      ],
      [],
      {
        ownTeamId: 1,
        showPing: false,
      },
    );

    expect(html).not.toContain(">Ping<");
    expect(html).toContain("Frozen");
    expect(html).toContain("Solo skirmish telemetry");
  });
});
