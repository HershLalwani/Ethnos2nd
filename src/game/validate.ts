import { PARTY_MAX } from "./constants";
import type { Card, GameState, RegionColor } from "./types";

/**
 * A Party is 1-10 cards, all the same clan OR all the same color.
 * Dogs are wild (they satisfy both groupings) but can never lead,
 * so a party of only Dogs is invalid.
 */
export function isValidParty(cards: Card[]): boolean {
  if (cards.length < 1 || cards.length > PARTY_MAX) return false;
  const nonDogs = cards.filter((c) => c.clan !== "dog");
  if (nonDogs.length === 0) return false;
  const sameClan = nonDogs.every((c) => c.clan === nonDogs[0].clan);
  const sameColor = nonDogs.every((c) => c.color === nonDogs[0].color);
  return sameClan || sameColor;
}

export function isValidLeader(cards: Card[], leaderId: string): boolean {
  const leader = cards.find((c) => c.id === leaderId);
  return !!leader && leader.clan !== "dog";
}

/**
 * Can `player` place a Control marker in `region` with a Party of `size`?
 * Standard: your own markers there must be fewer than the Party size.
 * 2-player games: ALL markers there must be fewer than the Party size.
 * Tiger Leader: one fewer card required.
 */
export function markerEligible(
  state: GameState,
  player: number,
  region: RegionColor,
  size: number,
  tigerLeader: boolean
): boolean {
  if (state.players[player].markersLeft <= 0) return false;
  const r = state.regions[region];
  const threshold =
    state.config.numPlayers === 2
      ? r.markers.reduce((a, b) => a + b, 0)
      : r.markers[player];
  const effectiveSize = tigerLeader ? size + 1 : size;
  return effectiveSize > threshold;
}

/** All maximal candidate groupings of a hand into valid parties (for UI hints & AI). */
export function candidateParties(hand: Card[]): Card[][] {
  const dogs = hand.filter((c) => c.clan === "dog");
  const results: Card[][] = [];
  const byClan = new Map<string, Card[]>();
  const byColor = new Map<string, Card[]>();
  for (const c of hand) {
    if (c.clan === "dog") continue;
    byClan.set(c.clan, [...(byClan.get(c.clan) ?? []), c]);
    byColor.set(c.color, [...(byColor.get(c.color) ?? []), c]);
  }
  for (const group of [...byClan.values(), ...byColor.values()]) {
    results.push([...group, ...dogs].slice(0, PARTY_MAX));
  }
  return results;
}
