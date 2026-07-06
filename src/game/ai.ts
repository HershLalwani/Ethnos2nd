import { HAND_LIMIT, partyPrestige } from "./constants";
import { koiSymbolsCrossed } from "./engine";
import {
  REGION_COLORS,
  type Action,
  type Card,
  type GameState,
  type RegionColor,
} from "./types";
import { isValidParty, markerEligible } from "./validate";

interface Candidate {
  cards: Card[];
  leader: Card;
  region: RegionColor; // target region (deer choice applied)
  score: number;
}

/** Value of the top award of a region for the current Age. */
function regionStake(state: GameState, region: RegionColor): number {
  const tokens = state.regions[region].prestigeTokens;
  const idx = Math.min(state.age - 1, tokens.length - 1);
  const coins = state.regions[region].coins.reduce((a, b) => a + b, 0);
  return tokens[idx] + coins;
}

/** How valuable is adding one marker for `player` in `region` right now? */
function markerValue(state: GameState, player: number, region: RegionColor): number {
  const markers = state.regions[region].markers;
  const mine = markers[player];
  const maxOther = Math.max(0, ...markers.filter((_, i) => i !== player));
  const stake = regionStake(state, region);
  if (mine + 1 > maxOther) return stake * 0.9; // take or extend the lead
  if (mine + 1 === maxOther) return stake * 0.5; // tie the leader
  return stake * 0.2; // build toward later ranks/ages
}

function bestDeerRegion(state: GameState, player: number, size: number): RegionColor {
  let best: RegionColor = REGION_COLORS[0];
  let bestValue = -1;
  for (const region of REGION_COLORS) {
    if (!markerEligible(state, player, region, size, false)) continue;
    const v = markerValue(state, player, region);
    if (v > bestValue) {
      bestValue = v;
      best = region;
    }
  }
  return best;
}

function koiBonusPicks(state: GameState, player: number, count: number): RegionColor[] {
  return [...REGION_COLORS]
    .sort((a, b) => markerValue(state, player, b) - markerValue(state, player, a))
    .slice(0, count);
}

function scoreCandidate(state: GameState, player: number, cards: Card[], leader: Card): Candidate {
  const size = cards.length;
  const p = state.players[player];
  let region = leader.color;
  let score = partyPrestige(size + (leader.clan === "rabbit" ? 1 : 0));

  if (leader.clan === "deer") region = bestDeerRegion(state, player, size);
  const placed = markerEligible(state, player, region, size, leader.clan === "tiger");
  if (placed) score += markerValue(state, player, region);

  switch (leader.clan) {
    case "bear":
      if (!state.bearHolder || size > state.bearHolder.size) score += 4 + 2;
      break;
    case "fox": {
      const options = state.foxAvailable.filter((v) => v <= size);
      if (options.length > 0) score += Math.max(...options) * 0.6;
      break;
    }
    case "koi": {
      const crossed = koiSymbolsCrossed(state, p.koiPos, Math.min(12, p.koiPos + size));
      score += size * 0.5 + crossed * 3;
      break;
    }
    case "monkey":
      if (!p.monkeyBoard.includes(leader.color)) score += 1.5 + p.monkeyBoard.length * 0.5;
      break;
    case "raven":
      score += Math.min(size, HAND_LIMIT) * 0.7;
      break;
    case "redpanda":
      score += Math.min(size, p.hand.length - size) * 0.6;
      break;
    case "raccoon":
      if (state.raccoonCoins.length > 0) score += Math.min(...state.raccoonCoins) * 0.8;
      break;
    case "owl":
      if (placed && p.hand.length - size > 1) score += 2;
      break;
    default:
      break;
  }

  // Cards left behind get discarded into the pool for rivals (unless Red Panda).
  const leftovers = p.hand.length - size;
  if (leader.clan !== "redpanda") score -= leftovers * 0.45;
  return { cards, leader, region, score };
}

/** Enumerate candidate parties (maximal clan/color groups + trimmed variants). */
function enumerateCandidates(state: GameState, player: number): Candidate[] {
  const hand = state.players[player].hand;
  const dogs = hand.filter((c) => c.clan === "dog");
  const groups = new Map<string, Card[]>();
  for (const c of hand) {
    if (c.clan === "dog") continue;
    const clanKey = `clan:${c.clan}`;
    const colorKey = `color:${c.color}`;
    groups.set(clanKey, [...(groups.get(clanKey) ?? []), c]);
    groups.set(colorKey, [...(groups.get(colorKey) ?? []), c]);
  }
  const candidates: Candidate[] = [];
  for (const group of groups.values()) {
    const withDogs = [...group, ...dogs].slice(0, 10);
    if (!isValidParty(withDogs)) continue;
    // Distinct leaders produce genuinely different plays.
    const seen = new Set<string>();
    for (const leader of withDogs) {
      if (leader.clan === "dog") continue;
      const key = `${leader.clan}-${leader.color}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(scoreCandidate(state, player, withDogs, leader));
      // Also consider the group without dog padding (saves dogs for later).
      if (dogs.length > 0 && group.length > 0 && isValidParty(group)) {
        candidates.push(scoreCandidate(state, player, group, leader));
      }
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
}

function buildPlayAction(state: GameState, player: number, cand: Candidate): Action {
  const p = state.players[player];
  const size = cand.cards.length;
  const action: Extract<Action, { type: "playParty" }> = {
    type: "playParty",
    player,
    cardIds: cand.cards.map((c) => c.id),
    leaderId: cand.leader.id,
  };
  if (cand.leader.clan === "deer") action.deerRegion = cand.region;
  if (cand.leader.clan === "koi") {
    const crossed = koiSymbolsCrossed(state, p.koiPos, Math.min(12, p.koiPos + size));
    if (crossed > 0) action.koiBonusRegions = koiBonusPicks(state, player, crossed);
  }
  if (cand.leader.clan === "redpanda") {
    const partyIds = new Set(action.cardIds);
    const rest = p.hand.filter((c) => !partyIds.has(c.id));
    // Keep the cards that belong to the biggest remaining group.
    const rank = (card: Card) =>
      rest.filter((o) => o.clan === card.clan || o.color === card.color).length;
    action.keepCardIds = [...rest]
      .sort((a, b) => rank(b) - rank(a))
      .slice(0, size)
      .map((c) => c.id);
  }
  return action;
}

/** Which pool card (if any) is worth recruiting? Returns a score per card. */
function poolCardScore(state: GameState, player: number, card: Card): number {
  const hand = state.players[player].hand;
  const clanMatches = hand.filter((c) => c.clan === card.clan || c.clan === "dog").length;
  const colorMatches = hand.filter((c) => c.color === card.color || c.clan === "dog").length;
  let score = Math.max(clanMatches, colorMatches) * 0.8;
  if (card.clan === "dog") score = hand.length > 0 ? 1.6 : 0.4;
  score += markerValue(state, player, card.color) * 0.06;
  return score;
}

/**
 * The next AI move owed in this state, if any (used by both the local
 * single-player loop and the multiplayer server).
 */
export function nextAiMove(state: GameState): { player: number; action: Action } | null {
  if (state.phase === "turn" || state.phase === "owlChain") {
    const player = state.phase === "owlChain" ? state.owlPlayer! : state.current;
    if (state.players[player].isAI) return { player, action: decideAction(state, player) };
    return null;
  }
  if (state.phase === "monkeyDecision") {
    const pending = state.monkeyPending.find((p) => state.players[p].isAI);
    if (pending !== undefined) return { player: pending, action: decideAction(state, pending) };
  }
  return null;
}

/** Decide the next action for an AI player. Must return a legal action. */
export function decideAction(state: GameState, player: number): Action {
  if (state.phase === "monkeyDecision") {
    const count = state.players[player].monkeyBoard.length;
    return { type: "monkeyDecision", player, migrate: count >= 4 };
  }

  const p = state.players[player];
  const candidates = enumerateCandidates(state, player);
  const best = candidates[0];

  if (state.phase === "owlChain") {
    // Keep chaining only if the follow-up party pulls real weight.
    if (best && best.score >= 3) return buildPlayAction(state, player, best);
    return { type: "endOwlChain", player };
  }

  // Urgency rises as dragons appear and the deck shrinks.
  const urgency = state.dragonsRevealed * 1.5 + (p.hand.length >= 8 ? 2 : 0);
  const mustPlay =
    p.hand.length >= HAND_LIMIT || (state.deck.length === 0 && state.pool.length === 0);
  const playThreshold = Math.max(2.5, 6 - urgency - p.hand.length * 0.25);

  if (best && (mustPlay || best.score >= playThreshold)) {
    return buildPlayAction(state, player, best);
  }
  if (mustPlay && best) return buildPlayAction(state, player, best);

  // Recruit: best pool card vs blind deck draw.
  let bestPool: Card | null = null;
  let bestPoolScore = -1;
  for (const card of state.pool) {
    const s = poolCardScore(state, player, card);
    if (s > bestPoolScore) {
      bestPoolScore = s;
      bestPool = card;
    }
  }
  if (bestPool && bestPoolScore >= 1.5) {
    return { type: "recruitPool", player, cardId: bestPool.id };
  }
  if (state.deck.length > 0) return { type: "recruitDeck", player };
  if (bestPool) return { type: "recruitPool", player, cardId: bestPool.id };
  // Nothing to recruit at all: play the best party we have.
  if (best) return buildPlayAction(state, player, best);
  // Degenerate fallback (hand of only dogs): should not occur.
  return { type: "recruitDeck", player };
}
