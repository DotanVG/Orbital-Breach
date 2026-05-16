export interface InstructionTextBlock {
  title: string;
  body: string;
}

export interface InstructionControl {
  input: string;
  action: string;
}

export interface InstructionsContent {
  title: string;
  subtitle: string;
  objective: InstructionTextBlock[];
  roundFlow: InstructionTextBlock[];
  winningScenarios: InstructionTextBlock[];
  controls: InstructionControl[];
}

const OBJECTIVE: InstructionTextBlock[] = [
  {
    title: "Objective",
    body: "Win each round by breaching the enemy room or freezing every enemy pilot.",
  },
  {
    title: "Teams",
    body: "Team Cyan and Team Magenta spawn in opposite breach rooms and fight across the zero-G arena.",
  },
];

const ROUND_FLOW: InstructionTextBlock[] = [
  {
    title: "Start In Gravity",
    body: "Each round begins in a breach room. Move, jump, grab a rail, and charge a launch into the arena.",
  },
  {
    title: "Fight In Zero-G",
    body: "Drift through debris, use rails to redirect, and fire the freeze pistol at enemy pilots.",
  },
  {
    title: "FREEZE TO SCORE",
    body: "Freeze all enemy players to score a round instantly.",
  },
  {
    title: "Breach To Score",
    body: "Cross into the enemy breach room to score a round for your team.",
  },
];

const WINNING_SCENARIOS: InstructionTextBlock[] = [
  {
    title: "Breach Win",
    body: "A round is won when a player breaches the enemy room.",
  },
  {
    title: "Freeze Win",
    body: "A round is also won when every enemy player is frozen.",
  },
  {
    title: "Match Win",
    body: "The first team to 5 round wins claims the match.",
  },
  {
    title: "Timeout",
    body: "If the 120-second round timer expires, the round is a tie and no point is awarded.",
  },
];

const DESKTOP_CONTROLS: InstructionControl[] = [
  { input: "Mouse", action: "Look around" },
  { input: "WASD", action: "Walk inside breach rooms" },
  { input: "E", action: "Grab or release a rail" },
  { input: "Space", action: "Jump in breach rooms" },
  { input: "Hold Space while grabbing", action: "Charge launch" },
  { input: "Mouse movement while charging", action: "Aim launch power" },
  { input: "Left mouse button", action: "Fire freeze pistol" },
  { input: "V", action: "Toggle first-person / third-person view" },
  { input: "B", action: "Hold selfie / look-back view" },
  { input: "Tab", action: "Hold combat roster / scoreboard" },
  { input: "Esc", action: "Session menu / release cursor" },
  { input: "H", action: "Help overlay" },
];

export function getInstructionsContent(isMobile: boolean): InstructionsContent {
  return {
    title: "INSTRUCTIONS",
    subtitle: "Controls, objective, round flow, and scoring rules.",
    objective: OBJECTIVE,
    roundFlow: ROUND_FLOW,
    winningScenarios: WINNING_SCENARIOS,
    controls: isMobile ? [] : DESKTOP_CONTROLS,
  };
}
