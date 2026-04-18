/**
 * Call-sign profanity guard.
 *
 * Covers slurs and hate-speech targeting any gender, race, ethnicity,
 * religion, sexuality, disability, or national origin in both plain text
 * and common leet/symbol substitutions.
 *
 * Not exhaustive — intended as a first-pass filter for a game-jam context.
 */

// ── Leet-speak / symbol normalisation map ────────────────────────────────────

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  "$": "s",
  "!": "i",
  "+": "t",
  "(": "c",
  "|": "i",
  "vv": "w",
};

export function normalizeCallSign(raw: string): string {
  let s = raw.toLowerCase();
  // Multi-char substitutions first
  s = s.replace(/vv/g, "w");
  // Single-char substitutions
  s = s.replace(/[013456789@$!+(|]/g, (ch) => LEET[ch] ?? ch);
  // Strip non-alpha to surface concatenated words
  s = s.replace(/[^a-z]/g, "");
  return s;
}

// ── Blocked patterns ──────────────────────────────────────────────────────────
// Each entry is tested as a substring of the normalised name.
// Sorted roughly by category for review / maintenance.

const BLOCKED_SUBSTRINGS: readonly string[] = [
  // ── English racial / ethnic slurs ────────────────────────────────────────
  "nigger", "nigga", "nigg", "niga", "niger",
  "chink", "chinky", "gook", "slant", "zipperhead",
  "spic", "spick", "wetback",
  "kike", "hymie", "heeb",
  "towelhead", "raghead", "camel.?jockey", "sandnigger",
  "cracker", "honky", "whitey",
  "coon", "jigaboo", "porch.?monkey", "sambo", "darkie",
  "redskin", "injun",
  "beaner",
  "dago", "wop", "greaseball",
  "polack",
  "cholo",
  "paki",
  "zipperhead",
  "squinteye",
  "yellowmonkey",
  "brownie",
  "mongrel",
  "halfbreed",
  "mulatto",

  // ── Gender / sexuality slurs ─────────────────────────────────────────────
  "faggot", "fagg", "fag",
  "dyke", "dykes",
  "tranny", "trannies",
  "shemale",
  "heshe",
  "transphob",
  "queers",         // "queer" alone kept out — reclaimed by community
  "homo",
  "lesbo",
  "ladyboy",
  "buttpirate",
  "cocksucker",
  "cumslut",
  "cumguzzler",
  "cumrag",
  "cumdumpster",
  "whore",
  "slut",
  "cunt",
  "twat",
  "skank",
  "bimbo",
  "hoe",
  "thot",

  // ── Ableism / mental health slurs ────────────────────────────────────────
  "retard", "retarded",
  "spaz", "spastic",
  "mong",
  "cripple",
  "autist", "autistic",   // used as insult
  "psycho",
  "schizo",
  "maniac",

  // ── Religion / nationality hate ──────────────────────────────────────────
  "islamophob",
  "antisemit",
  "nazism", "nazi",
  "fascist",
  "jihadist",
  "christkill",
  "mudslime",

  // ── Generic hate / harassment ────────────────────────────────────────────
  "killself", "kys",
  "kmsnoob",
  "godie",
  "rapist",
  "pedophile", "pedo",
  "nonce",
  "incel",
  "misogyn",
  "misandry",

  // ── Common strong profanity ──────────────────────────────────────────────
  "motherfuck", "motherfucker",
  "fuckyou", "fuckoff",
  "asshole", "arsehole",
  "dickhead",
  "shithead",
  "bastard",
  "wanker",
  "tosser",
  "bellend",
  "knobhead",
];

// Build as-regex array once (plain substring match on normalised string)
const PATTERNS: readonly RegExp[] = BLOCKED_SUBSTRINGS.map(
  (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
);

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns true when the name passes — false if it contains blocked content. */
export function isCallSignClean(name: string): boolean {
  const normalized = normalizeCallSign(name);
  for (const pattern of PATTERNS) {
    if (pattern.test(normalized)) return false;
  }
  return true;
}

/**
 * Returns null when name is acceptable, or a short human-readable
 * rejection reason string when blocked.
 */
export function validateCallSign(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Call sign cannot be empty.";
  if (trimmed.length > 16) return "Call sign must be 16 characters or fewer.";
  if (!isCallSignClean(trimmed)) return "That call sign is not allowed.";
  return null;
}
