import { schema, t, type SchemaType } from "@colyseus/schema";

export const LobbyMemberState = schema({
  id: t.string().default(""),
  sessionId: t.string().default(""),
  name: t.string().default(""),
  team: t.number<0 | 1>().default(0),
  ready: t.boolean().default(false),
  connected: t.boolean().default(true),
  isBot: t.boolean().default(false),
}, "LobbyMemberState");
export type LobbyMemberState = SchemaType<typeof LobbyMemberState>;

export const ActorState = schema({
  id: t.string().default(""),
  name: t.string().default(""),
  team: t.number<0 | 1>().default(0),
  isBot: t.boolean().default(false),
  posX: t.number().default(0),
  posY: t.number().default(0),
  posZ: t.number().default(0),
  velX: t.number().default(0),
  velY: t.number().default(0),
  velZ: t.number().default(0),
  yaw: t.number().default(0),
  orientX: t.number().default(0),
  orientY: t.number().default(0),
  orientZ: t.number().default(0),
  orientW: t.number().default(1),
  phase: t.string().default("BREACH"),
  frozen: t.boolean().default(false),
  leftArm: t.boolean().default(false),
  rightArm: t.boolean().default(false),
  leftLeg: t.boolean().default(false),
  rightLeg: t.boolean().default(false),
  kills: t.number().default(0),
  deaths: t.number().default(0),
  frozenTimer: t.number().default(0),
}, "ActorState");
export type ActorState = SchemaType<typeof ActorState>;

export const OrbitalLobbyState = schema({
  roomName: t.string().default("Orbital Lobby"),
  visibility: t.string().default("public"),
  listing: t.string().default("quick"),
  phase: t.string().default("LOBBY"),
  matchComplete: t.boolean().default(false),
  countdownRemaining: t.number().default(0),
  roundTimeRemaining: t.number().default(0),
  scoreTeam0: t.number().default(0),
  scoreTeam1: t.number().default(0),
  teamSize: t.number().default(5),
  maxPlayers: t.number().default(10),
  roundNumber: t.number().default(0),
  members: t.map(LobbyMemberState),
  actors: t.map(ActorState),
}, "OrbitalLobbyState");
export type OrbitalLobbyState = SchemaType<typeof OrbitalLobbyState>;
