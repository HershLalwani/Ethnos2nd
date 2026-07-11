"use client";

import { create } from "zustand";
import { nextAiMove } from "@/game/ai";
import { applyAction, koiSymbolsCrossed, newGame } from "@/game/engine";
import { KOI_TRACK_END } from "@/game/constants";
import type { Action, Card, GameConfig, GameState, RegionColor } from "@/game/types";
import { isValidLeader, isValidParty } from "@/game/validate";
import { NetClient, type ServerMessage } from "@/lib/net";

/** Extra choices a pending Party play still needs from the human player. */
export interface PlayWizard {
  cardIds: string[];
  leaderId: string;
  needsDeer: boolean;
  koiCrossings: number;
  keepAllowance: number;
  deerRegion: RegionColor | null;
  koiBonusRegions: RegionColor[];
  keepCardIds: string[];
}

export type Lobby = Extract<ServerMessage, { t: "lobby" }>;

interface GameStore {
  mode: "local" | "online";
  game: GameState | null;
  humanId: number;
  lobby: Lobby | null;
  roomCode: string | null;
  connStatus: "idle" | "connecting" | "open" | "closed";
  selected: string[];
  leaderId: string | null;
  /** Card ids in the player's preferred display order (drag-to-reorder). */
  handOrder: string[];
  wizard: PlayWizard | null;
  drawerOpen: boolean;
  scoringDismissed: boolean;
  error: string | null;

  start: (config: GameConfig) => void;
  quit: () => void;
  dispatch: (action: Action) => void;

  createRoom: (name: string) => void;
  joinRoom: (code: string, name: string) => void;
  addBot: () => void;
  removeBot: () => void;
  setClanMode: (mode: "recommended" | "random") => void;
  startOnline: () => void;
  playAgain: () => void;

  toggleCard: (id: string) => void;
  setHandOrder: (ids: string[]) => void;
  setLeader: (id: string) => void;
  clearSelection: () => void;
  beginPlay: () => void;
  updateWizard: (patch: Partial<PlayWizard>) => void;
  confirmWizard: () => void;
  cancelWizard: () => void;
  setDrawer: (open: boolean) => void;
  dismissScoring: () => void;
  setError: (msg: string | null) => void;
}

export function selectedCards(game: GameState, humanId: number, selected: string[]): Card[] {
  const hand = game.players[humanId].hand;
  return selected
    .map((id) => hand.find((c) => c.id === id))
    .filter((c): c is Card => !!c);
}

/** Hand in the player's chosen display order; cards not yet ordered keep draw order at the end. */
export function orderHand(hand: Card[], order: string[]): Card[] {
  const pos = new Map(order.map((id, i) => [id, i]));
  const known = hand.filter((c) => pos.has(c.id));
  const rest = hand.filter((c) => !pos.has(c.id));
  known.sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
  return [...known, ...rest];
}

const net = new NetClient();

export const useGame = create<GameStore>((set, get) => {
  if (typeof window !== "undefined") {
    net.onStatus = (status) => {
      set({ connStatus: status });
      // Socket came back after a drop: reclaim our seat. The server matches
      // us by client id, so this is a no-op if we never actually lost it.
      const { mode, roomCode } = get();
      if (status === "open" && mode === "online" && roomCode) {
        net.send({ t: "join", code: roomCode, name: sessionStorage.getItem("ethnos-name") ?? "" });
      }
    };
    net.onMessage = (msg) => {
      switch (msg.t) {
        case "joined":
          set({ mode: "online", roomCode: msg.code, humanId: msg.seat, error: null });
          // Remembered so a refreshed tab can reclaim its seat automatically.
          sessionStorage.setItem("ethnos-room", msg.code);
          break;
        case "lobby":
          set({ lobby: msg, roomCode: msg.code });
          // Rematch: the host sent everyone back to the lobby.
          if (!msg.started && get().mode === "online" && get().game) {
            // Card ids repeat between games, so the saved order must go too.
            set({
              game: null,
              selected: [],
              leaderId: null,
              handOrder: [],
              wizard: null,
              scoringDismissed: false,
            });
          }
          break;
        case "state": {
          const prev = get().game;
          const state = msg.state as GameState;
          const myTurn =
            (state.phase === "turn" && state.current === get().humanId) ||
            (state.phase === "owlChain" && state.owlPlayer === get().humanId);
          set({
            game: state,
            // Keep an in-progress selection only while it is still our turn.
            selected: myTurn ? get().selected : [],
            leaderId: myTurn ? get().leaderId : null,
            wizard: myTurn ? get().wizard : null,
            scoringDismissed:
              prev && prev.phase === state.phase ? get().scoringDismissed : false,
          });
          break;
        }
        case "error":
          set({ error: msg.msg });
          break;
        case "hello":
          break;
      }
    };
  }

  return {
    mode: "local",
    game: null,
    humanId: 0,
    lobby: null,
    roomCode: null,
    connStatus: "idle",
    selected: [],
    leaderId: null,
    handOrder: [],
    wizard: null,
    drawerOpen: false,
    scoringDismissed: false,
    error: null,

    start: (config) => {
      const humanId = config.aiPlayers.findIndex((ai) => !ai);
      set({
        mode: "local",
        game: newGame(config),
        humanId: humanId === -1 ? 0 : humanId,
        lobby: null,
        roomCode: null,
        selected: [],
        leaderId: null,
        handOrder: [],
        wizard: null,
        scoringDismissed: false,
      });
    },

    quit: () => {
      if (get().mode === "online") {
        net.send({ t: "leave" });
        net.close();
      }
      sessionStorage.removeItem("ethnos-room");
      set({
        mode: "local",
        game: null,
        lobby: null,
        roomCode: null,
        connStatus: "idle",
        selected: [],
        leaderId: null,
        handOrder: [],
        wizard: null,
      });
    },

    dispatch: (action) => {
      const { game, mode } = get();
      if (!game) return;
      if (mode === "online") {
        net.send({ t: "action", action });
        // Optimistically close local UI; the authoritative state follows.
        set({ wizard: null, selected: [], leaderId: null });
        return;
      }
      try {
        const next = applyAction(game, action);
        set({
          game: next,
          selected: [],
          leaderId: null,
          wizard: null,
          scoringDismissed: false,
          error: null,
        });
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e) });
      }
    },

    createRoom: (name) => {
      sessionStorage.setItem("ethnos-name", name);
      net.connect();
      net.send({ t: "create", name });
    },
    joinRoom: (code, name) => {
      sessionStorage.setItem("ethnos-name", name);
      net.connect();
      net.send({ t: "join", code: code.trim().toUpperCase(), name });
    },
    addBot: () => net.send({ t: "addBot" }),
    removeBot: () => net.send({ t: "removeBot" }),
    setClanMode: (mode) => net.send({ t: "clanMode", mode }),
    startOnline: () => net.send({ t: "start" }),
    playAgain: () => net.send({ t: "again" }),

    toggleCard: (id) => {
      const { selected, leaderId } = get();
      if (selected.includes(id)) {
        set({
          selected: selected.filter((s) => s !== id),
          leaderId: leaderId === id ? null : leaderId,
        });
      } else {
        set({ selected: [...selected, id] });
      }
    },

    setHandOrder: (ids) => set({ handOrder: ids }),
    setLeader: (id) => set({ leaderId: id }),
    clearSelection: () => set({ selected: [], leaderId: null }),

    /** Validate the selection, then either dispatch directly or open the wizard. */
    beginPlay: () => {
      const { game, humanId, selected, leaderId } = get();
      if (!game) return;
      const cards = selectedCards(game, humanId, selected);
      if (!isValidParty(cards)) return;

      let leader = leaderId;
      const nonDogs = cards.filter((c) => c.clan !== "dog");
      if (!leader || !isValidLeader(cards, leader)) {
        if (nonDogs.length === 1) leader = nonDogs[0].id;
        else return; // caller must pick a leader first
      }
      const leaderCard = cards.find((c) => c.id === leader)!;
      const player = game.players[humanId];

      const needsDeer = leaderCard.clan === "deer";
      const koiCrossings =
        leaderCard.clan === "koi"
          ? koiSymbolsCrossed(
              game,
              player.koiPos,
              Math.min(KOI_TRACK_END, player.koiPos + cards.length)
            )
          : 0;
      const keepAllowance =
        leaderCard.clan === "redpanda"
          ? Math.min(cards.length, player.hand.length - cards.length)
          : 0;

      if (!needsDeer && koiCrossings === 0 && keepAllowance === 0) {
        get().dispatch({
          type: "playParty",
          player: humanId,
          cardIds: selected,
          leaderId: leader,
        });
        return;
      }
      set({
        wizard: {
          cardIds: selected,
          leaderId: leader,
          needsDeer,
          koiCrossings,
          keepAllowance,
          deerRegion: null,
          koiBonusRegions: [],
          keepCardIds: [],
        },
      });
    },

    updateWizard: (patch) => {
      const { wizard } = get();
      if (wizard) set({ wizard: { ...wizard, ...patch } });
    },

    confirmWizard: () => {
      const { wizard, humanId } = get();
      if (!wizard) return;
      get().dispatch({
        type: "playParty",
        player: humanId,
        cardIds: wizard.cardIds,
        leaderId: wizard.leaderId,
        deerRegion: wizard.deerRegion ?? undefined,
        koiBonusRegions: wizard.koiBonusRegions,
        keepCardIds: wizard.keepCardIds,
      });
    },

    cancelWizard: () => set({ wizard: null }),
    setDrawer: (open) => set({ drawerOpen: open }),
    dismissScoring: () => set({ scoringDismissed: true }),
    setError: (msg) => set({ error: msg }),
  };
});

/** True when it is the human's turn to recruit or play. */
export function humanCanAct(game: GameState | null, humanId: number): boolean {
  if (!game) return false;
  if (game.phase === "turn") return game.current === humanId;
  if (game.phase === "owlChain") return game.owlPlayer === humanId;
  return false;
}

/** Compute the next AI action to run locally (single-player mode only). */
export function pendingAiMove(game: GameState | null): { player: number; action: Action } | null {
  if (!game) return null;
  return nextAiMove(game);
}
