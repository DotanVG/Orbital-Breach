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
    body: "Freeze the enemy squad, open their breach portal, and cross it before they recover their formation.",
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
    title: "Open The Portal",
    body: "Freeze all enemies on the opposing team to open their breach portal route.",
  },
  {
    title: "Breach To Score",
    body: "Cross the enemy breach portal to score a round for your team.",
  },
];

const WINNING_SCENARIOS: InstructionTextBlock[] = [
  {
    title: "Round Win",
    body: "A round is won when a player crosses the enemy breach portal after the enemy team has been fully frozen.",
  },
  {
    title: "Match Win",
    body: "The first team to 5 round wins wins the match.",
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
    title: isMobile ? "Mobile Instructions" : "Desktop Instructions",
    subtitle: isMobile
      ? "Round flow, objective, and scoring rules for touch pilots."
      : "Controls, objective, round flow, and scoring rules for desktop pilots.",
    objective: OBJECTIVE,
    roundFlow: ROUND_FLOW,
    winningScenarios: WINNING_SCENARIOS,
    controls: isMobile ? [] : DESKTOP_CONTROLS,
  };
}
