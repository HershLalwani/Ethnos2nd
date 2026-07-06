import type { Clan, RegionColor } from "./types";

export const HAND_LIMIT = 10;
export const PARTY_MAX = 10;
export const MARKERS_PER_PLAYER = 26;

/** Prestige for a Party by its card count (index). 6+ cards = 15. */
export const PARTY_PRESTIGE = [0, 0, 1, 3, 6, 10, 15] as const;
export function partyPrestige(size: number): number {
  return PARTY_PRESTIGE[Math.min(size, 6)];
}

/**
 * The 18 Prestige tokens, per the physical set: 4 ×6, 6 ×5, 8 ×4, 10 ×2, 12 ×1.
 * Tokens marked `forFourPlus` bear the "4+" icon (three 4s and two 6s) and are
 * removed in 2-3 player games.
 */
export const PRESTIGE_TOKENS: { value: number; forFourPlus: boolean }[] = [
  { value: 4, forFourPlus: false },
  { value: 4, forFourPlus: false },
  { value: 4, forFourPlus: false },
  { value: 4, forFourPlus: true },
  { value: 4, forFourPlus: true },
  { value: 4, forFourPlus: true },
  { value: 6, forFourPlus: false },
  { value: 6, forFourPlus: false },
  { value: 6, forFourPlus: false },
  { value: 6, forFourPlus: true },
  { value: 6, forFourPlus: true },
  { value: 8, forFourPlus: false },
  { value: 8, forFourPlus: false },
  { value: 8, forFourPlus: false },
  { value: 8, forFourPlus: false },
  { value: 10, forFourPlus: false },
  { value: 10, forFourPlus: false },
  { value: 12, forFourPlus: false },
];

/** Koi board: last space of the track (marker can't move past it). */
export const KOI_TRACK_END = 12;
/** Spaces bearing a Koi symbol (reaching/passing one grants a bonus marker). */
export const KOI_SYMBOLS_STANDARD = [3, 7, 12];
export const KOI_SYMBOLS_SMALL = [4, 9]; // 2-3 player side of the board
/** Age-end scoring for the Koi board, treated as its own Region (I/II/III). */
export const KOI_PRESTIGE = [2, 4, 6];

/** Bear token: immediate prestige for taking it, and Age-end bonus per Age. */
export const BEAR_IMMEDIATE = 4;
export const BEAR_AGE_BONUS: Record<number, number> = { 1: 4, 2: 6, 3: 8 };

/** Monkey Settlement board: prestige for migrating, by markers removed. */
export const MONKEY_MIGRATE_PRESTIGE = [0, 1, 3, 6, 10, 15, 20] as const;

export const FOX_TOKEN_VALUES = [1, 2, 3, 4, 5, 6];

/** The 14 Raccoon Coins (lowest available value is always placed first). */
export const RACCOON_COIN_VALUES = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3];

export const CLAN_INFO: Record<
  Clan,
  { name: string; emoji: string; ability: string }
> = {
  owl: {
    name: "Owl Summoners",
    emoji: "🦉",
    ability:
      "If this Party placed a Control marker, you may immediately play another Party before discarding.",
  },
  rabbit: {
    name: "Rabbit Scientists",
    emoji: "🐰",
    ability: "At Age end, this Party scores Prestige as if it had 1 more card.",
  },
  redpanda: {
    name: "Red Panda Sages",
    emoji: "🐼",
    ability:
      "Keep hand cards up to the size of this Party instead of discarding them.",
  },
  bear: {
    name: "Bear Stonewards",
    emoji: "🐻",
    ability:
      "If this is now the largest Bear-led Party, gain 4 Prestige and take the Bear token (bonus Prestige at Age end).",
  },
  raccoon: {
    name: "Raccoon Merchants",
    emoji: "🦝",
    ability:
      "Place the lowest-value Coin on this Region's current-Age Prestige space, boosting its Age-end award.",
  },
  koi: {
    name: "Koi Sea Spirits",
    emoji: "🐟",
    ability:
      "Advance on the Koi board by the Party size. Passing a Koi symbol lets you place a marker in ANY Region. The Koi board scores like a Region each Age.",
  },
  tiger: {
    name: "Tiger Samurai",
    emoji: "🐯",
    ability: "You need 1 fewer card than usual to place your Control marker.",
  },
  monkey: {
    name: "Monkey Nomads",
    emoji: "🐵",
    ability:
      "Also place a marker on the matching space of your Monkey Settlement board. Empty it at Age end for Prestige.",
  },
  dog: {
    name: "Dog Townsfolk",
    emoji: "🐶",
    ability:
      "Wild card: joins any Party, but can never lead. All Dogs are discarded before Parties score at Age end.",
  },
  fox: {
    name: "Fox Ninjas",
    emoji: "🦊",
    ability:
      "Take an unclaimed Fox token of value up to the Party size. Fox tokens break ties for Region control.",
  },
  deer: {
    name: "Deer Wind Knights",
    emoji: "🦌",
    ability: "Place your Control marker in ANY Region, ignoring the Leader's color.",
  },
  raven: {
    name: "Raven Wizards",
    emoji: "🐦‍⬛",
    ability:
      "After discarding your remaining hand, draw cards from the Ally Deck equal to the Party size.",
  },
};

export const REGION_INFO: Record<RegionColor, { name: string; hex: string; terrainHex: string }> = {
  red: { name: "Red Region", hex: "#c0392b", terrainHex: "#a8524a" },
  blue: { name: "Blue Region", hex: "#2471a3", terrainHex: "#5a7d9a" },
  green: { name: "Green Region", hex: "#1e8449", terrainHex: "#5e8c4f" },
  yellow: { name: "Yellow Region", hex: "#d4a017", terrainHex: "#c2a45c" },
  black: { name: "Black Region", hex: "#2c2c34", terrainHex: "#4a4a55" },
  white: { name: "White Region", hex: "#dcd6c5", terrainHex: "#cfc9b5" },
};

export const PLAYER_COLORS = [
  { name: "Violet", hex: "#8e44ad" },
  { name: "Orange", hex: "#e67e22" },
  { name: "Teal", hex: "#16a085" },
  { name: "Crimson", hex: "#e74c3c" },
  { name: "Azure", hex: "#3498db" },
  { name: "Rose", hex: "#e84393" },
];

/** Recommended first-game clans per the rulebook. */
export const RECOMMENDED_CLANS: Clan[] = ["monkey", "bear", "tiger", "redpanda", "raven", "fox"];
