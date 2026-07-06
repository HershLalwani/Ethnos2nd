import { buildAllyCards } from "./cards";
import {
  BEAR_IMMEDIATE,
  FOX_TOKEN_VALUES,
  HAND_LIMIT,
  KOI_SYMBOLS_SMALL,
  KOI_SYMBOLS_STANDARD,
  KOI_TRACK_END,
  MARKERS_PER_PLAYER,
  PRESTIGE_TOKENS,
  RACCOON_COIN_VALUES,
  CLAN_INFO,
  REGION_INFO,
} from "./constants";
import { nextRandom, shuffle } from "./rng";
import { computeWinners, scoreAge } from "./score";
import {
  isDragon,
  REGION_COLORS,
  type Action,
  type Card,
  type GameConfig,
  type GameState,
  type LogEntry,
  type PlayerState,
  type RegionColor,
  type RegionState,
} from "./types";
import { isValidLeader, isValidParty, markerEligible } from "./validate";

function log(state: GameState, entry: Omit<LogEntry, "turn">) {
  state.log.push({ turn: state.turnCount, ...entry });
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}

function playerName(state: GameState, p: number): string {
  return state.players[p].name;
}

export function koiSymbols(state: GameState): number[] {
  return state.config.numPlayers <= 3 ? KOI_SYMBOLS_SMALL : KOI_SYMBOLS_STANDARD;
}

/** Koi symbols crossed when moving from `from` to `to` on the Koi board. */
export function koiSymbolsCrossed(state: GameState, from: number, to: number): number {
  return koiSymbols(state).filter((s) => from < s && s <= to).length;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function newGame(config: GameConfig): GameState {
  const smallGame = config.numPlayers <= 3;
  const players: PlayerState[] = [];
  for (let i = 0; i < config.numPlayers; i++) {
    players.push({
      id: i,
      name: config.playerNames[i] ?? `Player ${i + 1}`,
      isAI: config.aiPlayers[i] ?? i !== 0,
      hand: [],
      parties: [],
      prestige: 0,
      // One marker sits on the Prestige track; one near the Koi board if in play.
      markersLeft:
        MARKERS_PER_PLAYER - 1 - (config.clans.includes("koi") ? 1 : 0),
      monkeyBoard: [],
      foxTokens: [],
      koiPos: 0,
    });
  }

  const state: GameState = {
    config,
    players,
    regions: {} as Record<RegionColor, RegionState>,
    deck: [],
    pool: [],
    dragonsRevealed: 0,
    age: 1,
    current: 0,
    firstPlayer: 0,
    lastDragonPlayer: null,
    phase: "turn",
    owlPlayer: null,
    pendingRavenDraws: [],
    bearHolder: null,
    foxAvailable: [...FOX_TOKEN_VALUES],
    raccoonCoins: [...RACCOON_COIN_VALUES],
    monkeyPending: [],
    monkeyMigrate: {},
    koiInPlay: config.clans.includes("koi"),
    lastScoring: null,
    winners: null,
    log: [],
    turnCount: 0,
    rngState: config.seed >>> 0 || 1,
  };

  // Prestige tokens: shuffle, deal 3 per Region (2 in 2-3p games, "4+" removed),
  // then sort ascending within each Region (lowest on the "I" space).
  const tokenPool = shuffle(
    state,
    PRESTIGE_TOKENS.filter((t) => !smallGame || !t.forFourPlus).map((t) => t.value)
  );
  const perRegion = smallGame ? 2 : 3;
  REGION_COLORS.forEach((color, i) => {
    const tokens = tokenPool.slice(i * perRegion, (i + 1) * perRegion).sort((a, b) => a - b);
    state.regions[color] = {
      color,
      prestigeTokens: tokens,
      markers: players.map(() => 0),
      coins: [],
    };
  });

  state.firstPlayer = Math.floor(nextRandom(state) * config.numPlayers);
  log(state, {
    kind: "age",
    text: `The First Age dawns over Ethnos. Clans: ${config.clans
      .map((c) => CLAN_INFO[c].name)
      .join(", ")}.`,
  });
  beginAge(state);
  return state;
}

/** Deal a new Age: hands, Ally Pool, Dragons into the bottom half of the deck. */
function beginAge(state: GameState) {
  for (const p of state.players) {
    p.hand = [];
    p.parties = [];
    p.foxTokens = [];
  }
  state.foxAvailable = [...FOX_TOKEN_VALUES];
  state.bearHolder = null;
  state.dragonsRevealed = 0;
  state.pendingRavenDraws = [];
  state.owlPlayer = null;
  state.monkeyPending = [];
  state.monkeyMigrate = {};

  // All ally cards are reshuffled together each Age.
  let deck = shuffle(state, buildAllyCards(state.config.clans) as (Card | { id: string; dragon: true })[]);

  // 1. Each player draws 1 card (before Dragons enter the deck).
  for (const p of state.players) {
    p.hand.push(deck.pop() as Card);
  }
  // 2. Ally Pool: twice the number of players, face up.
  state.pool = [];
  for (let i = 0; i < state.config.numPlayers * 2; i++) {
    state.pool.push(deck.pop() as Card);
  }
  // 3. Shuffle the 3 Dragons into the bottom half (deck end = top).
  const half = Math.floor(deck.length / 2);
  const bottom = deck.slice(0, half);
  const top = deck.slice(half);
  const dragons = [1, 2, 3].map((n) => ({ id: `dragon-${n}`, dragon: true as const }));
  state.deck = [...shuffle(state, [...bottom, ...dragons]), ...top];

  state.current = state.firstPlayer;
  state.phase = "turn";
  log(state, {
    kind: "age",
    text: `Age ${["I", "II", "III"][state.age - 1]} begins. ${playerName(state, state.firstPlayer)} goes first.`,
  });
}

// ---------------------------------------------------------------------------
// Drawing / dragons
// ---------------------------------------------------------------------------

/**
 * Draw from the deck, revealing Dragons along the way. Returns the drawn ally
 * card, or null if the Age ended (3rd Dragon) or the deck ran out.
 */
function drawFromDeck(state: GameState, player: number): Card | null {
  while (state.deck.length > 0) {
    const entry = state.deck.pop()!;
    if (isDragon(entry)) {
      state.dragonsRevealed++;
      state.lastDragonPlayer = player;
      log(state, {
        kind: "dragon",
        player,
        text: `${playerName(state, player)} reveals a Dragon! (${state.dragonsRevealed}/3)`,
      });
      if (state.dragonsRevealed >= 3) {
        endAge(state);
        return null;
      }
      continue; // draw another card
    }
    return entry;
  }
  // Failsafe: an empty deck ends the Age (cannot occur with Dragons in play).
  endAge(state);
  return null;
}

// ---------------------------------------------------------------------------
// Turn actions
// ---------------------------------------------------------------------------

function assertTurn(state: GameState, player: number, phases: GameState["phase"][]) {
  if (!phases.includes(state.phase)) throw new Error(`Illegal action in phase ${state.phase}`);
  if (state.current !== player) throw new Error("Not your turn");
}

function advanceTurn(state: GameState) {
  if (state.phase !== "turn") return; // Age may have ended mid-resolution
  state.current = (state.current + 1) % state.config.numPlayers;
  state.turnCount++;
}

/**
 * End-of-turn bookkeeping shared by playParty/endOwlChain:
 * Red Panda keeps, discard to the Ally Pool, then Raven draws.
 */
function finishTurn(state: GameState, player: number, keepCardIds: string[] | undefined) {
  const p = state.players[player];
  const lastParty = p.parties[p.parties.length - 1];
  const leader = lastParty?.cards.find((c) => c.id === lastParty.leaderId);
  const keepAllowance = leader?.clan === "redpanda" ? lastParty.cards.length : 0;

  const keeps = new Set((keepCardIds ?? []).slice(0, keepAllowance));
  const kept: Card[] = [];
  const discarded: Card[] = [];
  for (const card of p.hand) {
    if (keeps.has(card.id) && kept.length < keepAllowance) kept.push(card);
    else discarded.push(card);
  }
  p.hand = kept;
  state.pool.push(...discarded);
  if (discarded.length > 0) {
    log(state, {
      kind: "action",
      player,
      text: `${p.name} discards ${discarded.length} card${discarded.length > 1 ? "s" : ""} to the Ally Pool.`,
    });
  }
  if (kept.length > 0) {
    log(state, {
      kind: "ability",
      player,
      text: `${p.name}'s Red Panda Sages keep ${kept.length} card${kept.length > 1 ? "s" : ""} in hand.`,
    });
  }

  // Raven Wizards: draw from the deck for each Raven-led Party this turn.
  for (const draws of state.pendingRavenDraws) {
    for (let i = 0; i < draws; i++) {
      const card = drawFromDeck(state, player);
      if (!card) {
        state.pendingRavenDraws = [];
        return; // Age ended mid-draw
      }
      p.hand.push(card);
    }
    log(state, {
      kind: "ability",
      player,
      text: `${p.name}'s Raven Wizards draw ${draws} card${draws > 1 ? "s" : ""} from the deck.`,
    });
  }
  state.pendingRavenDraws = [];
  state.owlPlayer = null;
  state.phase = "turn";
  advanceTurn(state);
}

function resolvePlayParty(
  state: GameState,
  action: Extract<Action, { type: "playParty" }>
): void {
  const player = action.player;
  const p = state.players[player];
  const cards = action.cardIds.map((id) => {
    const card = p.hand.find((c) => c.id === id);
    if (!card) throw new Error(`Card ${id} not in hand`);
    return card;
  });
  if (!isValidParty(cards)) throw new Error("Invalid party");
  if (!isValidLeader(cards, action.leaderId)) throw new Error("Invalid leader");
  const leader = cards.find((c) => c.id === action.leaderId)!;
  const size = cards.length;

  // Lay the Party down.
  const ids = new Set(action.cardIds);
  p.hand = p.hand.filter((c) => !ids.has(c.id));
  p.parties.push({ cards, leaderId: leader.id });

  // Target Region: Leader color, or any Region for a Deer Leader.
  const region: RegionColor =
    leader.clan === "deer" && action.deerRegion ? action.deerRegion : leader.color;

  log(state, {
    kind: "action",
    player,
    text: `${p.name} plays a Party of ${size} led by a ${REGION_INFO[leader.color].name.split(" ")[0].toLowerCase()} ${CLAN_INFO[leader.clan].name.replace(/s Clan$/, "")}.`,
  });

  // Place a Control marker if the Party is large enough.
  let markerPlaced = false;
  if (markerEligible(state, player, region, size, leader.clan === "tiger")) {
    state.regions[region].markers[player]++;
    p.markersLeft--;
    markerPlaced = true;
    log(state, {
      kind: "action",
      player,
      text: `${p.name} places a Control marker in the ${REGION_INFO[region].name}.`,
    });
  }

  // Leader ability.
  switch (leader.clan) {
    case "bear": {
      if (!state.bearHolder || size > state.bearHolder.size) {
        state.bearHolder = { player, size };
        p.prestige += BEAR_IMMEDIATE;
        log(state, {
          kind: "ability",
          player,
          text: `${p.name} claims the Bear token with a Party of ${size} (+${BEAR_IMMEDIATE} Prestige).`,
        });
      }
      break;
    }
    case "raccoon": {
      if (state.raccoonCoins.length > 0) {
        const value = Math.min(...state.raccoonCoins);
        state.raccoonCoins.splice(state.raccoonCoins.indexOf(value), 1);
        state.regions[leader.color].coins.push(value);
        log(state, {
          kind: "ability",
          player,
          text: `${p.name} places a ${value}-value Coin on the ${REGION_INFO[leader.color].name}.`,
        });
      }
      break;
    }
    case "koi": {
      const from = p.koiPos;
      p.koiPos = Math.min(KOI_TRACK_END, p.koiPos + size);
      const crossed = koiSymbolsCrossed(state, from, p.koiPos);
      log(state, {
        kind: "ability",
        player,
        text: `${p.name} advances to space ${p.koiPos} on the Koi board.`,
      });
      const bonusRegions = (action.koiBonusRegions ?? []).slice(0, crossed);
      for (const bonus of bonusRegions) {
        if (p.markersLeft <= 0) break;
        state.regions[bonus].markers[player]++;
        p.markersLeft--;
        log(state, {
          kind: "ability",
          player,
          text: `${p.name} passes a Koi symbol and places a marker in the ${REGION_INFO[bonus].name}.`,
        });
      }
      break;
    }
    case "monkey": {
      if (!p.monkeyBoard.includes(leader.color) && p.markersLeft > 0) {
        p.monkeyBoard.push(leader.color);
        p.markersLeft--;
        log(state, {
          kind: "ability",
          player,
          text: `${p.name} settles a marker on the ${leader.color} space of their Monkey Settlement board.`,
        });
      }
      break;
    }
    case "fox": {
      const options = state.foxAvailable.filter((v) => v <= size);
      if (options.length > 0) {
        const take = Math.max(...options);
        state.foxAvailable.splice(state.foxAvailable.indexOf(take), 1);
        p.foxTokens.push(take);
        log(state, {
          kind: "ability",
          player,
          text: `${p.name} takes the ${take} Fox token.`,
        });
      }
      break;
    }
    case "raven": {
      state.pendingRavenDraws.push(size);
      break;
    }
    default:
      break;
  }

  // Owl Summoners: chain another Party before discarding, if a marker was placed.
  const canChain =
    leader.clan === "owl" && markerPlaced && p.hand.some((c) => c.clan !== "dog");
  if (canChain) {
    state.phase = "owlChain";
    state.owlPlayer = player;
    log(state, {
      kind: "ability",
      player,
      text: `${p.name}'s Owl Summoners allow another Party to be played!`,
    });
    return;
  }

  finishTurn(state, player, action.keepCardIds);
}

// ---------------------------------------------------------------------------
// Age end
// ---------------------------------------------------------------------------

function endAge(state: GameState) {
  log(state, { kind: "age", text: `The third Dragon ends Age ${["I", "II", "III"][state.age - 1]}!` });
  // Allies disperse: all hands are discarded.
  for (const p of state.players) p.hand = [];
  state.pool = [];
  state.pendingRavenDraws = [];
  state.owlPlayer = null;

  // Players with Monkey markers choose whether to migrate (auto on final Age).
  const finalAge = state.age === state.config.agesTotal;
  state.monkeyPending = finalAge
    ? []
    : state.players.filter((p) => p.monkeyBoard.length > 0).map((p) => p.id);
  if (state.monkeyPending.length > 0) {
    state.phase = "monkeyDecision";
    return;
  }
  finalizeAge(state);
}

function finalizeAge(state: GameState) {
  state.lastScoring = scoreAge(state);
  log(state, {
    kind: "score",
    text: `Age ${["I", "II", "III"][state.age - 1]} scored. Prestige: ${state.players
      .map((p) => `${p.name} ${p.prestige}`)
      .join(", ")}.`,
  });

  if (state.age === state.config.agesTotal) {
    state.phase = "over";
    state.winners = computeWinners(state);
    log(state, {
      kind: "score",
      text: `${state.winners.map((w) => playerName(state, w)).join(" & ")} ${
        state.winners.length > 1 ? "are" : "is"
      } crowned Emperor of Ethnos!`,
    });
  } else {
    state.phase = "ageScored";
  }
}

function startNextAge(state: GameState) {
  if (state.phase !== "ageScored") throw new Error("No Age to start");
  state.age++;
  // First player: least Prestige; ties go to the player closest (clockwise)
  // to whoever drew the third Dragon.
  const minPrestige = Math.min(...state.players.map((p) => p.prestige));
  const tied = state.players.filter((p) => p.prestige === minPrestige).map((p) => p.id);
  const start = state.lastDragonPlayer ?? 0;
  for (let i = 0; i < state.config.numPlayers; i++) {
    const candidate = (start + i) % state.config.numPlayers;
    if (tied.includes(candidate)) {
      state.firstPlayer = candidate;
      break;
    }
  }
  beginAge(state);
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function applyAction(prev: GameState, action: Action): GameState {
  const state = structuredClone(prev);
  switch (action.type) {
    case "recruitDeck": {
      assertTurn(state, action.player, ["turn"]);
      const p = state.players[action.player];
      if (p.hand.length >= HAND_LIMIT) throw new Error("Hand limit reached — you must play a Party");
      const card = drawFromDeck(state, action.player);
      if (card) {
        p.hand.push(card);
        log(state, {
          kind: "action",
          player: action.player,
          text: `${p.name} recruits an Ally from the deck.`,
        });
        advanceTurn(state);
      }
      break;
    }
    case "recruitPool": {
      assertTurn(state, action.player, ["turn"]);
      const p = state.players[action.player];
      if (p.hand.length >= HAND_LIMIT) throw new Error("Hand limit reached — you must play a Party");
      const idx = state.pool.findIndex((c) => c.id === action.cardId);
      if (idx === -1) throw new Error("Card not in the Ally Pool");
      const [card] = state.pool.splice(idx, 1);
      p.hand.push(card);
      log(state, {
        kind: "action",
        player: action.player,
        text: `${p.name} recruits the ${card.color} ${CLAN_INFO[card.clan].name.replace(/s? .*$/, "")} from the Ally Pool.`,
      });
      advanceTurn(state);
      break;
    }
    case "playParty": {
      assertTurn(state, action.player, ["turn", "owlChain"]);
      if (state.phase === "owlChain" && state.owlPlayer !== action.player) {
        throw new Error("Owl chain belongs to another player");
      }
      resolvePlayParty(state, action);
      break;
    }
    case "endOwlChain": {
      if (state.phase !== "owlChain" || state.owlPlayer !== action.player) {
        throw new Error("No Owl chain to end");
      }
      finishTurn(state, action.player, action.keepCardIds);
      break;
    }
    case "monkeyDecision": {
      if (state.phase !== "monkeyDecision") throw new Error("No Monkey decision pending");
      if (!state.monkeyPending.includes(action.player)) throw new Error("No decision for this player");
      state.monkeyMigrate[action.player] = action.migrate;
      state.monkeyPending = state.monkeyPending.filter((p) => p !== action.player);
      log(state, {
        kind: "ability",
        player: action.player,
        text: `${playerName(state, action.player)}'s Monkeys ${action.migrate ? "migrate!" : "stay settled."}`,
      });
      if (state.monkeyPending.length === 0) finalizeAge(state);
      break;
    }
    case "startNextAge": {
      startNextAge(state);
      break;
    }
  }
  return state;
}
