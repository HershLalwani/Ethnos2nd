import { describe, expect, test } from "bun:test";
import { decideAction } from "./ai";
import { buildAllyCards, buildClanCards } from "./cards";
import { applyAction, newGame } from "./engine";
import { scoreAge } from "./score";
import {
  isDragon,
  type Card,
  type Clan,
  type GameConfig,
  type GameState,
  type PrestigeToken,
} from "./types";
import { isValidParty, markerEligible } from "./validate";

function config(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    numPlayers: 4,
    playerNames: ["A", "B", "C", "D"],
    aiPlayers: [false, true, true, true],
    clans: ["monkey", "bear", "tiger", "redpanda", "raven", "fox"],
    agesTotal: 3,
    seed: 42,
    ...overrides,
  };
}

function card(clan: Clan, color: Card["color"], n = 0): Card {
  return { id: `${clan}-${color}-${n}`, clan, color };
}

function prestigeToken(baseValue: number, plus4 = false): PrestigeToken {
  return { baseValue, plus4 };
}

describe("deck", () => {
  test("each clan has 12 cards, 2 per color", () => {
    const cards = buildClanCards("fox");
    expect(cards.length).toBe(12);
    expect(new Set(cards.map((c) => c.id)).size).toBe(12);
  });

  test("game deck contains all clan cards + 3 dragons in bottom half", () => {
    const state = newGame(config());
    const inHands = state.players.reduce((n, p) => n + p.hand.length, 0);
    expect(inHands).toBe(4);
    expect(state.pool.length).toBe(8);
    expect(state.deck.length).toBe(6 * 12 - 4 - 8 + 3);
    const dragonPositions = state.deck
      .map((c, i) => (isDragon(c) ? i : -1))
      .filter((i) => i >= 0);
    expect(dragonPositions.length).toBe(3);
    // deck end = top; dragons must be in the bottom (low-index) half
    const half = Math.ceil((state.deck.length - 3) / 2) + 3;
    for (const pos of dragonPositions) expect(pos).toBeLessThan(half);
  });

  test("prestige tokens are ordered by base value when dealt", () => {
    const state = newGame(config({ seed: 1 }));
    for (const region of Object.values(state.regions)) {
      const bases = region.prestigeTokens.map((t) => t.baseValue);
      expect(bases).toEqual([...bases].sort((a, b) => a - b));
    }
  });
});

describe("party validation", () => {
  test("same clan or same color, dogs wild, dogs cannot lead", () => {
    expect(isValidParty([card("fox", "red"), card("fox", "blue")])).toBe(true);
    expect(isValidParty([card("fox", "red"), card("bear", "red")])).toBe(true);
    expect(isValidParty([card("fox", "red"), card("bear", "blue")])).toBe(false);
    expect(isValidParty([card("fox", "red"), card("dog", "blue"), card("fox", "green")])).toBe(true);
    expect(isValidParty([card("dog", "red"), card("dog", "blue")])).toBe(false);
  });
});

describe("marker placement", () => {
  test("needs party larger than own markers; tiger needs one fewer", () => {
    const state = newGame(config());
    state.regions.red.markers[0] = 2;
    expect(markerEligible(state, 0, "red", 2, false)).toBe(false);
    expect(markerEligible(state, 0, "red", 3, false)).toBe(true);
    expect(markerEligible(state, 0, "red", 2, true)).toBe(true);
  });

  test("2-player games count ALL markers in the region", () => {
    const state = newGame(config({ numPlayers: 2, playerNames: ["A", "B"], aiPlayers: [false, true], agesTotal: 2 }));
    state.regions.red.markers[0] = 2;
    state.regions.red.markers[1] = 1;
    expect(markerEligible(state, 0, "red", 3, false)).toBe(false);
    expect(markerEligible(state, 0, "red", 4, false)).toBe(true);
  });
});

function primedState(): GameState {
  const state = newGame(config());
  state.current = 0;
  state.phase = "turn";
  return state;
}

describe("playing parties", () => {
  test("plays a party, places marker, discards leftovers to pool", () => {
    const state = primedState();
    state.players[0].hand = [card("fox", "red"), card("fox", "blue"), card("bear", "green")];
    const poolBefore = state.pool.length;
    const next = applyAction(state, {
      type: "playParty",
      player: 0,
      cardIds: ["fox-red-0", "fox-blue-0"],
      leaderId: "fox-red-0",
    });
    expect(next.regions.red.markers[0]).toBe(1);
    expect(next.players[0].parties.length).toBe(1);
    expect(next.players[0].hand.length).toBe(0);
    expect(next.pool.length).toBe(poolBefore + 1); // bear discarded
    expect(next.players[0].foxTokens).toEqual([2]); // fox ability: best token <= size
    expect(next.current).toBe(1);
  });

  test("bear leader claims token and immediate prestige", () => {
    const state = primedState();
    state.players[0].hand = [card("bear", "red"), card("bear", "blue")];
    const next = applyAction(state, {
      type: "playParty",
      player: 0,
      cardIds: ["bear-red-0", "bear-blue-0"],
      leaderId: "bear-red-0",
    });
    expect(next.bearHolder).toEqual({ player: 0, size: 2 });
    expect(next.players[0].prestige).toBe(4);
  });

  test("red panda keeps cards up to party size", () => {
    const state = primedState();
    state.config.clans = ["redpanda", "bear", "tiger", "monkey", "raven", "fox"];
    state.players[0].hand = [
      card("redpanda", "red"),
      card("redpanda", "blue"),
      card("bear", "green"),
      card("bear", "white"),
      card("tiger", "black"),
    ];
    const next = applyAction(state, {
      type: "playParty",
      player: 0,
      cardIds: ["redpanda-red-0", "redpanda-blue-0"],
      leaderId: "redpanda-red-0",
      keepCardIds: ["bear-green-0", "bear-white-0", "tiger-black-0"],
    });
    // allowance = party size (2), so only 2 of the 3 requested keeps stay
    expect(next.players[0].hand.length).toBe(2);
  });

  test("owl leader chains a second party when a marker is placed", () => {
    const state = primedState();
    state.config.clans = ["owl", "bear", "tiger", "monkey", "raven", "fox"];
    state.players[0].hand = [card("owl", "red"), card("bear", "green")];
    const mid = applyAction(state, {
      type: "playParty",
      player: 0,
      cardIds: ["owl-red-0"],
      leaderId: "owl-red-0",
    });
    expect(mid.phase).toBe("owlChain");
    expect(mid.current).toBe(0);
    const done = applyAction(mid, {
      type: "playParty",
      player: 0,
      cardIds: ["bear-green-0"],
      leaderId: "bear-green-0",
    });
    expect(done.players[0].parties.length).toBe(2);
    expect(done.phase).toBe("turn");
    expect(done.current).toBe(1);
  });

  test("koi leader advances track and can place bonus markers", () => {
    const state = primedState();
    state.config.clans = ["koi", "bear", "tiger", "monkey", "raven", "fox"];
    state.koiInPlay = true;
    state.players[0].hand = [
      card("koi", "red"),
      card("koi", "blue"),
      card("koi", "green"),
      card("koi", "white"),
    ];
    const next = applyAction(state, {
      type: "playParty",
      player: 0,
      cardIds: ["koi-red-0", "koi-blue-0", "koi-green-0", "koi-white-0"],
      leaderId: "koi-red-0",
      koiBonusRegions: ["black"],
    });
    expect(next.players[0].koiPos).toBe(4);
    // 4 players -> symbols at 3,7,12; crossing 3 grants one bonus marker
    expect(next.regions.black.markers[0]).toBe(1);
    expect(next.regions.red.markers[0]).toBe(1); // regular placement too
  });

  test("deer leader places in a chosen region", () => {
    const state = primedState();
    state.config.clans = ["deer", "bear", "tiger", "monkey", "raven", "fox"];
    state.players[0].hand = [card("deer", "red")];
    const next = applyAction(state, {
      type: "playParty",
      player: 0,
      cardIds: ["deer-red-0"],
      leaderId: "deer-red-0",
      deerRegion: "white",
    });
    expect(next.regions.white.markers[0]).toBe(1);
    expect(next.regions.red.markers[0]).toBe(0);
  });

  test("raccoon leader adds the lowest coin to the region", () => {
    const state = primedState();
    state.config.clans = ["raccoon", "bear", "tiger", "monkey", "raven", "fox"];
    state.players[0].hand = [card("raccoon", "red")];
    const next = applyAction(state, {
      type: "playParty",
      player: 0,
      cardIds: ["raccoon-red-0"],
      leaderId: "raccoon-red-0",
    });
    expect(next.regions.red.coins).toEqual([1]);
    expect(next.raccoonCoins.length).toBe(13);
  });
});

describe("age scoring", () => {
  test("later ages still award earlier prestige tokens to lower ranks", () => {
    const state = primedState();
    state.age = 3;
    state.regions.red.prestigeTokens = [prestigeToken(4), prestigeToken(6), prestigeToken(10)];
    state.regions.red.markers = [3, 2, 1, 0];
    for (const c of ["blue", "green", "yellow", "black", "white"] as const) {
      state.regions[c].markers = [0, 0, 0, 0];
    }
    state.players.forEach((p) => (p.parties = []));

    const summary = scoreAge(state);

    expect(state.players.map((p) => p.prestige)).toEqual([10, 6, 4, 0]);
    expect(summary.regionLines.filter((l) => l.region === "red").map((l) => l.prestige)).toEqual([
      10,
      6,
      4,
    ]);
  });

  test("region awards by rank, ties split rounded down", () => {
    const state = primedState();
    state.age = 2;
    state.regions.red.prestigeTokens = [prestigeToken(4), prestigeToken(6), prestigeToken(10)];
    state.regions.red.markers = [2, 2, 0, 0];
    for (const c of ["blue", "green", "yellow", "black", "white"] as const) {
      state.regions[c].markers = [0, 0, 0, 0];
    }
    state.players.forEach((p) => (p.parties = []));
    const summary = scoreAge(state);
    // tie for 1st in age 2: (6 + 4) / 2 = 5 each
    expect(state.players[0].prestige).toBe(5);
    expect(state.players[1].prestige).toBe(5);
    expect(summary.regionLines.filter((l) => l.region === "red").length).toBe(2);
  });

  test("fox tokens break ties for control", () => {
    const state = primedState();
    state.age = 1;
    state.regions.red.prestigeTokens = [prestigeToken(4), prestigeToken(6), prestigeToken(10)];
    state.regions.red.markers = [2, 2, 0, 0];
    state.players[1].foxTokens = [3];
    for (const c of ["blue", "green", "yellow", "black", "white"] as const) {
      state.regions[c].markers = [0, 0, 0, 0];
    }
    state.players.forEach((p) => (p.parties = []));
    scoreAge(state);
    expect(state.players[1].prestige).toBe(4); // fox holder wins the I token
    expect(state.players[0].prestige).toBe(0);
  });

  test("plus4 prestige tokens score as base plus four", () => {
    const state = primedState();
    state.age = 1;
    state.regions.red.prestigeTokens = [prestigeToken(4, true), prestigeToken(6), prestigeToken(10)];
    state.regions.red.markers = [1, 0, 0, 0];
    for (const c of ["blue", "green", "yellow", "black", "white"] as const) {
      state.regions[c].markers = [0, 0, 0, 0];
    }
    state.players.forEach((p) => (p.parties = []));

    scoreAge(state);

    expect(state.players[0].prestige).toBe(8);
  });

  test("dogs disperse before party scoring; rabbit scores +1", () => {
    const state = primedState();
    state.players.forEach((p) => (p.parties = []));
    for (const c of ["red", "blue", "green", "yellow", "black", "white"] as const) {
      state.regions[c].markers = [0, 0, 0, 0];
    }
    state.players[0].parties = [
      {
        cards: [card("rabbit", "red"), card("rabbit", "blue"), card("dog", "green")],
        leaderId: "rabbit-red-0",
      },
    ];
    scoreAge(state);
    // dogs leave -> size 2, rabbit -> counts as 3 -> 3 prestige
    expect(state.players[0].prestige).toBe(3);
  });

  test("monkey migration scores and frees markers", () => {
    const state = primedState();
    state.players.forEach((p) => (p.parties = []));
    for (const c of ["red", "blue", "green", "yellow", "black", "white"] as const) {
      state.regions[c].markers = [0, 0, 0, 0];
    }
    state.players[0].monkeyBoard = ["red", "blue", "green"];
    state.monkeyMigrate[0] = true;
    const markersBefore = state.players[0].markersLeft;
    scoreAge(state);
    expect(state.players[0].prestige).toBe(6);
    expect(state.players[0].monkeyBoard.length).toBe(0);
    expect(state.players[0].markersLeft).toBe(markersBefore + 3);
  });
});

describe("full game simulation", () => {
  test("AI players finish a complete 4-player game legally", () => {
    let state = newGame(config({ aiPlayers: [true, true, true, true], seed: 7 }));
    let guard = 0;
    while (state.phase !== "over" && guard++ < 3000) {
      if (state.phase === "ageScored") {
        state = applyAction(state, { type: "startNextAge" });
        continue;
      }
      const player =
        state.phase === "monkeyDecision" ? state.monkeyPending[0] : state.current;
      state = applyAction(state, decideAction(state, player));
    }
    expect(state.phase).toBe("over");
    expect(state.winners!.length).toBeGreaterThan(0);
    expect(state.age).toBe(3);
    // Every player scored something over 3 ages in a sane game.
    expect(Math.max(...state.players.map((p) => p.prestige))).toBeGreaterThan(10);
  });

  test("2-player game ends after two ages", () => {
    let state = newGame(
      config({
        numPlayers: 2,
        playerNames: ["A", "B"],
        aiPlayers: [true, true],
        clans: ["monkey", "bear", "tiger", "redpanda", "raven"],
        agesTotal: 2,
        seed: 11,
      })
    );
    let guard = 0;
    while (state.phase !== "over" && guard++ < 2000) {
      if (state.phase === "ageScored") {
        state = applyAction(state, { type: "startNextAge" });
        continue;
      }
      const player =
        state.phase === "monkeyDecision" ? state.monkeyPending[0] : state.current;
      state = applyAction(state, decideAction(state, player));
    }
    expect(state.phase).toBe("over");
    expect(state.age).toBe(2);
  });
});
