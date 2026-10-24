import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildInviteUrl, getInviteRoomIdFromSearch } from "../shared/multiplayer";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

describe("static game routing", () => {
  it("leaves missing paths to the host's 404 instead of rewriting to the game", () => {
    expect(config.rewrites ?? []).toEqual([]);
    expect(readFileSync(new URL("../client/public/404.html", import.meta.url), "utf8"))
      .toContain('<a href="/">Play Orbital Breach</a>');
  });

  it("keeps room invites and embed parameters on the root document", () => {
    const invite = new URL(buildInviteUrl("room 123", "https://orbital-breach.vercel.app"));
    invite.searchParams.set("embed", "1");
    expect(invite.pathname).toBe("/");
    expect(getInviteRoomIdFromSearch(invite.search)).toBe("room 123");
    expect(invite.searchParams.get("embed")).toBe("1");
  });
});
