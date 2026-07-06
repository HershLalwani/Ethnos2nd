// Core types for Ethnos: 2nd Edition (CMON, 2024).
// The engine is a pure, JSON-serializable state machine so it can later be
// moved server-side for online multiplayer without changes.

export const REGION_COLORS = ["red", "blue", "green", "yellow", "black", "white"] as const;
export type RegionColor = (typeof REGION_COLORS)[number];

export const CLANS = [
  "owl", // Owl Summoners — chain a second Party if a marker was placed
  "rabbit", // Rabbit Scientists — Party scores as if 1 card larger
  "redpanda", // Red Panda Sages — keep up to X hand cards instead of discarding
  "bear", // Bear Stonewards — largest Bear Party: +4 prestige, Bear token, Age bonus
  "raccoon", // Raccoon Merchants — add a Coin to the Region's current-Age prestige
  "koi", // Koi Sea Spirits — advance Koi board, bonus markers, Age scoring
  "tiger", // Tiger Samurai — needs 1 fewer card to place a marker
  "monkey", // Monkey Nomads — Settlement board, migrate at Age end for prestige
  "dog", // Dog Townsfolk — wild card, never a Leader, discarded before scoring
  "fox", // Fox Ninjas — take a Fox token (tie-breaker for Region control)
  "deer", // Deer Wind Knights — place the marker in any Region
  "raven", // Raven Wizards — draw X cards from the deck after discarding
] as const;
export type Clan = (typeof CLANS)[number];

export interface Card {
  id: string; // `${clan}-${color}-${n}`
  clan: Clan;
  color: RegionColor;
}

/** Deck entries are ally cards or one of the 3 Dragon cards. */
export type DeckEntry = Card | { id: string; dragon: true };

export function isDragon(entry: DeckEntry): entry is { id: string; dragon: true } {
  return "dragon" in entry;
}

export interface Party {
  cards: Card[];
  leaderId: string;
}

export interface PlayerState {
  id: number;
  name: string;
  isAI: boolean;
  hand: Card[];
  parties: Party[]; // Parties played this Age, face up in front of the player
  prestige: number;
  markersLeft: number;
  /** Region colors occupied on this player's Monkey Settlement board. */
  monkeyBoard: RegionColor[];
  foxTokens: number[];
  koiPos: number;
}

export interface RegionState {
  color: RegionColor;
  /** Prestige tokens ascending: index 0 = "I" space. 3 tokens (2 in 2-3p games). */
  prestigeTokens: number[];
  /** Control marker count per player index. */
  markers: number[];
  /** Raccoon Coin values currently on this Region (cleared after Age scoring). */
  coins: number[];
}

export interface LogEntry {
  turn: number;
  player?: number;
  text: string;
  kind: "action" | "ability" | "dragon" | "age" | "score" | "info";
}

export type Phase =
  | "turn" // current player must recruit or play a Party
  | "owlChain" // current player may play another Party or stop
  | "monkeyDecision" // Age ended; players with Monkey markers decide migration
  | "ageScored" // scoring done; waiting for UI acknowledgement to start next Age
  | "over";

export interface RegionScoreLine {
  region: RegionColor | "koi";
  player: number;
  rank: number;
  prestige: number;
  tied: boolean;
}

export interface PartyScoreLine {
  player: number;
  leaderClan: Clan;
  size: number; // size after Dogs disperse
  prestige: number;
}

export interface AgeScoringSummary {
  age: number;
  regionLines: RegionScoreLine[];
  partyLines: PartyScoreLine[];
  bonusLines: { player: number; text: string; prestige: number }[];
  totals: number[]; // prestige totals after scoring, per player
}

export interface GameConfig {
  numPlayers: number;
  playerNames: string[];
  aiPlayers: boolean[];
  clans: Clan[]; // 6 clans (5 in 2-3 player games)
  agesTotal: 2 | 3;
  seed: number;
}

export interface GameState {
  config: GameConfig;
  players: PlayerState[];
  regions: Record<RegionColor, RegionState>;
  /** Last element is the top of the deck. */
  deck: DeckEntry[];
  pool: Card[]; // face-up Ally Pool
  dragonsRevealed: number;
  age: number; // 1-based
  current: number; // player index whose turn it is
  firstPlayer: number;
  lastDragonPlayer: number | null;
  phase: Phase;
  /** Player who may keep playing Parties thanks to an Owl Leader. */
  owlPlayer: number | null;
  /** Raven draws owed at end of the current turn (sizes of Raven-led Parties). */
  pendingRavenDraws: number[];
  /** Bear token holder and the size of the Party holding it. */
  bearHolder: { player: number; size: number } | null;
  foxAvailable: number[];
  /** Raccoon coin values not yet used (coins are removed from game once scored). */
  raccoonCoins: number[];
  /** Players still to make a Monkey migration decision during Age end. */
  monkeyPending: number[];
  monkeyMigrate: Record<number, boolean>;
  koiInPlay: boolean;
  lastScoring: AgeScoringSummary | null;
  winners: number[] | null;
  log: LogEntry[];
  turnCount: number;
  rngState: number;
}

export type Action =
  | { type: "recruitDeck"; player: number }
  | { type: "recruitPool"; player: number; cardId: string }
  | {
      type: "playParty";
      player: number;
      cardIds: string[];
      leaderId: string;
      /** Deer Leader: chosen Region (defaults to leader color otherwise). */
      deerRegion?: RegionColor;
      /** Koi Leader: one Region per Koi symbol crossed (may be fewer to decline). */
      koiBonusRegions?: RegionColor[];
      /** Red Panda Leader: hand cards to keep instead of discarding (≤ party size). */
      keepCardIds?: string[];
    }
  | { type: "endOwlChain"; player: number; keepCardIds?: string[] }
  | { type: "monkeyDecision"; player: number; migrate: boolean }
  | { type: "startNextAge" };
