// Per-seat redaction of the authoritative GameState. The multiplayer server
// never sends a client anything their player couldn't see at the table:
// other players' hand cards, the deck order (and Dragon positions!), and the
// RNG state are all masked. Shapes and counts are preserved so the client UI
// can keep rendering the same GameState type.

import type { Card, GameState } from "./types";

/** Placeholder for a face-down card. The clan/color are meaningless. */
function maskedCard(id: string): Card {
  return { id, clan: "dog", color: "red" };
}

/**
 * The view of `state` that `seat` is allowed to see. Pass -1 for a spectator
 * view (every hand masked). Returns a new state; the input is not touched.
 */
export function redactState(state: GameState, seat: number): GameState {
  const view = structuredClone(state);

  // The seed and RNG state would let a client replay the shuffles.
  view.rngState = 0;
  view.config = { ...view.config, seed: 0 };

  // Deck: only its size is public. Masking every entry as a plain card also
  // hides where the Dragons sit.
  view.deck = view.deck.map((_, i) => maskedCard(`deck-${i}`));

  // Other players' hands: counts only.
  for (const p of view.players) {
    if (p.id === seat) continue;
    p.hand = p.hand.map((_, i) => maskedCard(`hidden-${p.id}-${i}`));
  }

  return view;
}
