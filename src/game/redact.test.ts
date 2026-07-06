import { describe, expect, test } from "bun:test";
import { newGame } from "./engine";
import { redactState } from "./redact";
import { isDragon, type GameConfig } from "./types";

const config: GameConfig = {
  numPlayers: 4,
  playerNames: ["A", "B", "C", "D"],
  aiPlayers: [false, true, true, true],
  clans: ["monkey", "bear", "tiger", "redpanda", "raven", "fox"],
  agesTotal: 3,
  seed: 1234,
};

describe("redactState", () => {
  test("keeps the viewer's hand and masks everyone else's", () => {
    const state = newGame(config);
    const view = redactState(state, 1);
    expect(view.players[1].hand).toEqual(state.players[1].hand);
    for (const p of [0, 2, 3]) {
      expect(view.players[p].hand.length).toBe(state.players[p].hand.length);
      for (const card of view.players[p].hand) {
        expect(card.id.startsWith("hidden-")).toBe(true);
      }
    }
  });

  test("masks the deck (size kept, dragons and order hidden)", () => {
    const state = newGame(config);
    const view = redactState(state, 0);
    expect(view.deck.length).toBe(state.deck.length);
    expect(view.deck.some(isDragon)).toBe(false);
    for (const entry of view.deck) expect(entry.id.startsWith("deck-")).toBe(true);
  });

  test("zeroes the seed and RNG state", () => {
    const state = newGame(config);
    const view = redactState(state, 0);
    expect(view.rngState).toBe(0);
    expect(view.config.seed).toBe(0);
  });

  test("leaves public information intact and does not mutate the input", () => {
    const state = newGame(config);
    const before = structuredClone(state);
    const view = redactState(state, 2);
    expect(state).toEqual(before);
    expect(view.pool).toEqual(state.pool);
    expect(view.regions).toEqual(state.regions);
    expect(view.log).toEqual(state.log);
    expect(view.players.map((p) => p.prestige)).toEqual(state.players.map((p) => p.prestige));
  });

  test("spectator view (seat -1) masks every hand", () => {
    const state = newGame(config);
    const view = redactState(state, -1);
    for (const p of view.players) {
      for (const card of p.hand) expect(card.id.startsWith("hidden-")).toBe(true);
    }
  });
});
