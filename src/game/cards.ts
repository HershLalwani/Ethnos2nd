import { REGION_COLORS, type Card, type Clan } from "./types";

/** Every clan has 12 cards: 2 in each of the 6 Region colors (144 total). */
export function buildClanCards(clan: Clan): Card[] {
  const cards: Card[] = [];
  for (const color of REGION_COLORS) {
    for (let n = 0; n < 2; n++) {
      cards.push({ id: `${clan}-${color}-${n}`, clan, color });
    }
  }
  return cards;
}

export function buildAllyCards(clans: Clan[]): Card[] {
  return clans.flatMap(buildClanCards);
}
