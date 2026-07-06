import {
  BEAR_AGE_BONUS,
  KOI_PRESTIGE,
  MONKEY_MIGRATE_PRESTIGE,
  partyPrestige,
  prestigeTokenValue,
} from "./constants";
import type {
  AgeScoringSummary,
  GameState,
  PartyScoreLine,
  PrestigeToken,
  RegionColor,
  RegionScoreLine,
} from "./types";
import { REGION_COLORS } from "./types";

interface Contender {
  player: number;
  strength: number; // markers in the region (or Koi position)
}

/**
 * Rank contenders: higher strength first; ties broken by Fox token total,
 * then highest single Fox token. Players equal after all tiebreakers form
 * a group that splits the combined award (rounded down).
 */
function rankGroups(state: GameState, contenders: Contender[]): Contender[][] {
  const foxTotal = (p: number) => state.players[p].foxTokens.reduce((a, b) => a + b, 0);
  const foxMax = (p: number) => Math.max(0, ...state.players[p].foxTokens);
  const sorted = [...contenders].sort(
    (a, b) =>
      b.strength - a.strength ||
      foxTotal(b.player) - foxTotal(a.player) ||
      foxMax(b.player) - foxMax(a.player)
  );
  const groups: Contender[][] = [];
  for (const c of sorted) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last[0].strength === c.strength &&
      foxTotal(last[0].player) === foxTotal(c.player) &&
      foxMax(last[0].player) === foxMax(c.player)
    ) {
      last.push(c);
    } else {
      groups.push([c]);
    }
  }
  return groups;
}

/**
 * Score one "region" (a board Region or the Koi board).
 * `tokens` ascending: index 0 = "I" space. In Age N the leader takes token
 * index N-1, second place index N-2, etc.
 * 2-player special (final Age): only the leader scores (token II), and if
 * they are the sole contender they take both I and II. `coinBonus` (Raccoon)
 * is added to the first-place award.
 */
function scoreRegion(
  state: GameState,
  regionKey: RegionColor | "koi",
  contenders: Contender[],
  tokens: (PrestigeToken | number)[],
  coinBonus: number
): RegionScoreLine[] {
  const lines: RegionScoreLine[] = [];
  if (contenders.length === 0) return lines;
  const age = state.age;
  const twoPlayerFinal = state.config.numPlayers === 2 && age === state.config.agesTotal;

  // Award for finishing at `rank` (1-based).
  const awardForRank = (rank: number): number => {
    if (twoPlayerFinal) {
      if (rank !== 1) return 0;
      const sole = contenders.length === 1;
      return tokenValue(tokens[1]) + (sole ? tokenValue(tokens[0]) : 0);
    }
    const tokenIndex = age - rank; // Age 3: rank1 -> III (idx 2) ... rank3 -> I (idx 0)
    if (tokenIndex < 0 || tokenIndex >= tokens.length) return 0;
    return tokenValue(tokens[tokenIndex]);
  };

  const groups = rankGroups(state, contenders);
  let rank = 1;
  for (const group of groups) {
    let pot = 0;
    for (let i = 0; i < group.length; i++) pot += awardForRank(rank + i);
    if (rank === 1) pot += coinBonus;
    const each = Math.floor(pot / group.length);
    for (const c of group) {
      if (each > 0) {
        state.players[c.player].prestige += each;
        lines.push({
          region: regionKey,
          player: c.player,
          rank,
          prestige: each,
          tied: group.length > 1,
        });
      }
    }
    rank += group.length;
  }
  return lines;
}

function tokenValue(token: PrestigeToken | number): number {
  return typeof token === "number" ? token : prestigeTokenValue(token);
}

/** Resolve all End-of-Age scoring. Mutates state and returns the summary. */
export function scoreAge(state: GameState): AgeScoringSummary {
  const regionLines: RegionScoreLine[] = [];
  const partyLines: PartyScoreLine[] = [];
  const bonusLines: AgeScoringSummary["bonusLines"] = [];

  // Prestige for the Regions (+ Raccoon coins go to the region leader).
  for (const color of REGION_COLORS) {
    const region = state.regions[color];
    const contenders: Contender[] = region.markers
      .map((m, p) => ({ player: p, strength: m }))
      .filter((c) => c.strength > 0);
    const coinBonus = region.coins.reduce((a, b) => a + b, 0);
    regionLines.push(...scoreRegion(state, color, contenders, region.prestigeTokens, coinBonus));
    region.coins = []; // Coins are removed from the game after scoring
  }

  // The Koi board scores as if it were its own Region.
  if (state.koiInPlay) {
    const contenders: Contender[] = state.players
      .map((pl, p) => ({ player: p, strength: pl.koiPos }))
      .filter((c) => c.strength > 0);
    const koiTokens = KOI_PRESTIGE.slice(0, state.config.agesTotal === 2 ? 2 : 3);
    regionLines.push(...scoreRegion(state, "koi", contenders, koiTokens, 0));
  }

  // Bear token holder bonus.
  if (state.bearHolder) {
    const bonus = BEAR_AGE_BONUS[state.age] ?? 0;
    state.players[state.bearHolder.player].prestige += bonus;
    bonusLines.push({
      player: state.bearHolder.player,
      text: "Bear token held at Age end",
      prestige: bonus,
    });
  }

  // Dogs disperse, then Parties score by size (Rabbit Leader counts +1).
  for (const player of state.players) {
    for (const party of player.parties) {
      const leader = party.cards.find((c) => c.id === party.leaderId);
      party.cards = party.cards.filter((c) => c.clan !== "dog");
      const size = party.cards.length;
      const effective = size + (leader?.clan === "rabbit" && size > 0 ? 1 : 0);
      const prestige = partyPrestige(effective);
      player.prestige += prestige;
      partyLines.push({
        player: player.id,
        leaderClan: leader?.clan ?? "dog",
        size,
        prestige,
      });
    }
  }

  // Monkey migration for players who chose it (forced on the final Age —
  // markers would otherwise be worth nothing).
  const finalAge = state.age === state.config.agesTotal;
  for (const player of state.players) {
    const count = player.monkeyBoard.length;
    if (count === 0) continue;
    if (state.monkeyMigrate[player.id] || finalAge) {
      const prestige =
        MONKEY_MIGRATE_PRESTIGE[Math.min(count, MONKEY_MIGRATE_PRESTIGE.length - 1)];
      player.prestige += prestige;
      player.markersLeft += count;
      player.monkeyBoard = [];
      bonusLines.push({ player: player.id, text: `Monkeys migrate (${count})`, prestige });
    }
  }

  return {
    age: state.age,
    regionLines,
    partyLines,
    bonusLines,
    totals: state.players.map((p) => p.prestige),
  };
}

export function boardMarkerTotal(state: GameState, player: number): number {
  return REGION_COLORS.reduce((sum, c) => sum + state.regions[c].markers[player], 0);
}

/** Winner: most prestige; tie -> most markers on board; tie -> largest Party. */
export function computeWinners(state: GameState): number[] {
  const best = <T>(players: number[], metric: (p: number) => T[], compare: (a: T[], b: T[]) => number) => {
    let top = [players[0]];
    for (const p of players.slice(1)) {
      const cmp = compare(metric(p), metric(top[0]));
      if (cmp > 0) top = [p];
      else if (cmp === 0) top.push(p);
    }
    return top;
  };
  const all = state.players.map((p) => p.id);
  let winners = best(all, (p) => [state.players[p].prestige], (a, b) => a[0] - b[0]);
  if (winners.length > 1) {
    winners = best(winners, (p) => [boardMarkerTotal(state, p)], (a, b) => a[0] - b[0]);
  }
  if (winners.length > 1) {
    const partySizes = (p: number) =>
      state.players[p].parties.map((pt) => pt.cards.length).sort((a, b) => b - a);
    winners = best(winners, partySizes, (a, b) => {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const d = (a[i] ?? 0) - (b[i] ?? 0);
        if (d !== 0) return d;
      }
      return 0;
    });
  }
  return winners;
}
