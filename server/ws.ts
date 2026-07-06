// Ethnos multiplayer server — Bun WebSocket, in-memory rooms.
// Server-authoritative: it owns each room's GameState, validates every action
// through the same pure engine the client uses, and broadcasts the new state.
// Run with: bun run server  (defaults to port 3001)

import type { ServerWebSocket } from "bun";
import { nextAiMove } from "../src/game/ai";
import { RECOMMENDED_CLANS } from "../src/game/constants";
import { applyAction, newGame } from "../src/game/engine";
import { redactState } from "../src/game/redact";
import { CLANS, type Action, type Clan, type GameState } from "../src/game/types";

const PORT = Number(process.env.PORT ?? 3001);
const MAX_PLAYERS = 6;
const AI_DELAY_MS = 900;
/** How long a room survives after its last socket drops (refresh, flaky wifi). */
const ROOM_GRACE_MS = 10 * 60 * 1000;
const BOT_NAMES = ["Hiroshi", "Emi", "Wilfred", "Rowan", "Sable"];

interface SocketData {
  clientId: string;
  roomCode: string | null;
}
type WS = ServerWebSocket<SocketData>;

interface Seat {
  name: string;
  clientId: string | null; // null = bot
  connected: boolean;
}

interface Room {
  code: string;
  hostClientId: string;
  seats: Seat[];
  clanMode: "recommended" | "random";
  state: GameState | null;
  sockets: Set<WS>;
  aiTimer: ReturnType<typeof setTimeout> | null;
  emptyTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, Room>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoomCode(): string {
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZ"; // no I/L/O to avoid confusion
  let code = "";
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function send(ws: WS, msg: unknown) {
  ws.send(JSON.stringify(msg));
}

function broadcast(room: Room, msg: unknown) {
  const payload = JSON.stringify(msg);
  for (const ws of room.sockets) ws.send(payload);
}

function lobbySnapshot(room: Room) {
  return {
    t: "lobby",
    code: room.code,
    clanMode: room.clanMode,
    started: room.state !== null,
    seats: room.seats.map((s, i) => ({
      seat: i,
      name: s.name,
      isBot: s.clientId === null,
      connected: s.connected,
      isHost: s.clientId === room.hostClientId,
    })),
  };
}

function seatOf(room: Room, clientId: string): number {
  return room.seats.findIndex((s) => s.clientId === clientId);
}

function broadcastLobby(room: Room) {
  broadcast(room, lobbySnapshot(room));
}

/** Send `ws` its seat's redacted view of the game (spectators see no hands). */
function sendState(ws: WS, room: Room) {
  if (!room.state) return;
  send(ws, { t: "state", state: redactState(room.state, seatOf(room, ws.data.clientId)) });
}

function broadcastState(room: Room) {
  if (!room.state) return;
  for (const ws of room.sockets) sendState(ws, room);
}

function anyHumanConnected(room: Room): boolean {
  return room.seats.some((s) => s.clientId !== null && s.connected);
}

/** The move the server owes the game right now, if any. */
function pendingServerMove(room: Room): Action | null {
  if (!room.state || room.state.phase === "over") return null;
  const ai = nextAiMove(room.state);
  if (ai) return ai.action;
  // Nobody left to click "next Age": advance abandoned games automatically.
  if (room.state.phase === "ageScored" && !anyHumanConnected(room)) {
    return { type: "startNextAge" };
  }
  return null;
}

/** Run pending AI moves (bots and disconnected seats) with a small delay. */
function scheduleAi(room: Room) {
  if (room.aiTimer) {
    clearTimeout(room.aiTimer);
    room.aiTimer = null;
  }
  if (!room.state || !pendingServerMove(room)) return;
  const quickPhase = room.state.phase === "monkeyDecision" || room.state.phase === "ageScored";
  room.aiTimer = setTimeout(() => {
    room.aiTimer = null;
    // Recompute from the room's current state: a human may have reconnected
    // (or acted) since this timer was scheduled.
    const action = pendingServerMove(room);
    if (!action || !room.state) return;
    try {
      room.state = applyAction(room.state, action);
    } catch (e) {
      console.error(`[${room.code}] AI action failed:`, e);
      return;
    }
    broadcastState(room);
    scheduleAi(room);
  }, quickPhase ? 400 : AI_DELAY_MS);
}

function pickClans(mode: Room["clanMode"], count: number): Clan[] {
  if (mode === "recommended") return RECOMMENDED_CLANS.slice(0, count);
  const pool = [...CLANS];
  const picked: Clan[] = [];
  while (picked.length < count) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picked;
}

function deleteRoom(room: Room) {
  if (room.aiTimer) clearTimeout(room.aiTimer);
  if (room.emptyTimer) clearTimeout(room.emptyTimer);
  rooms.delete(room.code);
  console.log(`[${room.code}] room deleted. Rooms: ${rooms.size}`);
}

/**
 * Called whenever a socket leaves. A started game keeps its room alive for
 * ROOM_GRACE_MS so a refresh or dropped connection can reclaim its seat; a
 * lobby with no humans is gone for good, so it is deleted immediately.
 */
function scheduleRoomCleanup(room: Room) {
  if (room.sockets.size > 0) return;
  const reclaimable = room.state !== null && room.seats.some((s) => s.clientId !== null);
  if (!reclaimable) {
    deleteRoom(room);
    return;
  }
  if (room.emptyTimer) clearTimeout(room.emptyTimer);
  room.emptyTimer = setTimeout(() => deleteRoom(room), ROOM_GRACE_MS);
  console.log(`[${room.code}] empty, deleting in ${ROOM_GRACE_MS / 60000}min unless reclaimed`);
}

/** Attach a socket to a room, cancelling any pending empty-room cleanup. */
function attachSocket(room: Room, ws: WS) {
  room.sockets.add(ws);
  ws.data.roomCode = room.code;
  if (room.emptyTimer) {
    clearTimeout(room.emptyTimer);
    room.emptyTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------

function handleCreate(ws: WS, name: string) {
  leaveCurrentRoom(ws);
  const room: Room = {
    code: makeRoomCode(),
    hostClientId: ws.data.clientId,
    seats: [{ name: name || "Host", clientId: ws.data.clientId, connected: true }],
    clanMode: "recommended",
    state: null,
    sockets: new Set(),
    aiTimer: null,
    emptyTimer: null,
  };
  rooms.set(room.code, room);
  attachSocket(room, ws);
  send(ws, { t: "joined", code: room.code, seat: 0 });
  broadcastLobby(room);
  console.log(`[${room.code}] created by ${name}. Rooms: ${rooms.size}`);
}

function handleJoin(ws: WS, code: string, name: string) {
  const room = rooms.get(code.toUpperCase());
  if (!room) return send(ws, { t: "error", msg: `Room ${code.toUpperCase()} not found` });
  leaveCurrentRoom(ws);

  // Reconnect: this client already owns a seat in the room.
  const existing = seatOf(room, ws.data.clientId);
  if (existing >= 0) {
    room.seats[existing].connected = true;
    if (room.state) room.state.players[existing].isAI = false;
    attachSocket(room, ws);
    send(ws, { t: "joined", code: room.code, seat: existing });
    broadcastLobby(room);
    if (room.state) {
      broadcastState(room);
      scheduleAi(room); // stop any AI takeover of the reclaimed seat
    }
    return;
  }

  if (room.state) return send(ws, { t: "error", msg: "Game already started in this room" });
  if (room.seats.length >= MAX_PLAYERS) return send(ws, { t: "error", msg: "Room is full" });

  room.seats.push({ name: name || `Player ${room.seats.length + 1}`, clientId: ws.data.clientId, connected: true });
  attachSocket(room, ws);
  send(ws, { t: "joined", code: room.code, seat: room.seats.length - 1 });
  broadcastLobby(room);
}

function requireHostRoom(ws: WS): Room | null {
  const room = ws.data.roomCode ? rooms.get(ws.data.roomCode) : null;
  if (!room) {
    send(ws, { t: "error", msg: "Not in a room" });
    return null;
  }
  if (room.hostClientId !== ws.data.clientId) {
    send(ws, { t: "error", msg: "Only the host can do that" });
    return null;
  }
  return room;
}

function handleAddBot(ws: WS) {
  const room = requireHostRoom(ws);
  if (!room || room.state) return;
  if (room.seats.length >= MAX_PLAYERS) return send(ws, { t: "error", msg: "Room is full" });
  const used = new Set(room.seats.map((s) => s.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${room.seats.length + 1}`;
  room.seats.push({ name, clientId: null, connected: true });
  broadcastLobby(room);
}

function handleRemoveBot(ws: WS) {
  const room = requireHostRoom(ws);
  if (!room || room.state) return;
  for (let i = room.seats.length - 1; i >= 0; i--) {
    if (room.seats[i].clientId === null) {
      room.seats.splice(i, 1);
      broadcastLobby(room);
      return;
    }
  }
}

function handleClanMode(ws: WS, mode: string) {
  const room = requireHostRoom(ws);
  if (!room || room.state) return;
  room.clanMode = mode === "random" ? "random" : "recommended";
  broadcastLobby(room);
}

function handleStart(ws: WS) {
  const room = requireHostRoom(ws);
  if (!room || room.state) return;
  const n = room.seats.length;
  if (n < 2) return send(ws, { t: "error", msg: "Need at least 2 players (add a bot?)" });
  const smallGame = n <= 3;
  room.state = newGame({
    numPlayers: n,
    playerNames: room.seats.map((s) => s.name),
    aiPlayers: room.seats.map((s) => s.clientId === null),
    clans: pickClans(room.clanMode, smallGame ? 5 : 6),
    agesTotal: smallGame ? 2 : 3,
    seed: Math.floor(Math.random() * 2 ** 31),
  });
  broadcastLobby(room);
  broadcastState(room);
  scheduleAi(room);
  console.log(`[${room.code}] game started with ${n} players`);
}

/** Host rematch: back to the lobby with the same seats (minus anyone gone). */
function handleAgain(ws: WS) {
  const room = requireHostRoom(ws);
  if (!room || !room.state || room.state.phase !== "over") return;
  if (room.aiTimer) {
    clearTimeout(room.aiTimer);
    room.aiTimer = null;
  }
  room.state = null;
  // A disconnected human seat would stall the next game (it is neither a bot
  // nor anyone's turn to take) — drop those; they can simply rejoin.
  room.seats = room.seats.filter((s) => s.clientId === null || s.connected);
  broadcastLobby(room);
  console.log(`[${room.code}] rematch — back to lobby with ${room.seats.length} seats`);
}

function handleAction(ws: WS, action: Action) {
  const room = ws.data.roomCode ? rooms.get(ws.data.roomCode) : null;
  if (!room || !room.state) return send(ws, { t: "error", msg: "No game in progress" });
  const seat = seatOf(room, ws.data.clientId);
  if (seat < 0) return send(ws, { t: "error", msg: "You have no seat in this room" });
  if ("player" in action && action.player !== seat) {
    return send(ws, { t: "error", msg: "You can only act for your own seat" });
  }
  try {
    room.state = applyAction(room.state, action);
  } catch (e) {
    // A second "start next age" click races harmlessly; stay quiet about it.
    if (action.type !== "startNextAge") {
      send(ws, { t: "error", msg: e instanceof Error ? e.message : String(e) });
    }
    return;
  }
  broadcastState(room);
  scheduleAi(room);
}

function leaveCurrentRoom(ws: WS) {
  const room = ws.data.roomCode ? rooms.get(ws.data.roomCode) : null;
  ws.data.roomCode = null;
  if (!room) return;
  room.sockets.delete(ws);
  const seat = seatOf(room, ws.data.clientId);
  if (seat >= 0) {
    room.seats[seat].connected = false;
    if (room.state && room.state.phase !== "over") {
      // Keep the game moving: the empty seat plays on as an AI until rejoin.
      room.state.players[seat].isAI = true;
      broadcastState(room);
      scheduleAi(room);
    } else if (!room.state) {
      room.seats.splice(seat, 1);
      if (room.seats.length > 0 && room.hostClientId === ws.data.clientId) {
        const nextHuman = room.seats.find((s) => s.clientId !== null);
        if (nextHuman) room.hostClientId = nextHuman.clientId!;
      }
    }
  }
  broadcastLobby(room);
  scheduleRoomCleanup(room);
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

// In production this process also serves the static Next.js export (`out/`,
// built by `bun run build`). In dev the folder simply doesn't exist and
// `next dev` serves the app instead.
const STATIC_DIR = new URL("../out/", import.meta.url).pathname;

async function serveStatic(pathname: string): Promise<Response | null> {
  if (pathname.includes("..")) return null;
  const path = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  // Next's export maps the route /foo to out/foo.html.
  for (const candidate of [path, `${path}.html`, `${path}/index.html`]) {
    const file = Bun.file(STATIC_DIR + candidate.replace(/^\//, ""));
    if (await file.exists()) return new Response(file);
  }
  return null;
}

Bun.serve<SocketData, never>({
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);
    const clientId = url.searchParams.get("cid") ?? crypto.randomUUID();
    if (server.upgrade(req, { data: { clientId, roomCode: null } })) return;
    const page = await serveStatic(url.pathname);
    if (page) return page;
    return new Response("Ethnos multiplayer server. Connect via WebSocket.", { status: 200 });
  },
  websocket: {
    open(ws) {
      send(ws, { t: "hello", clientId: ws.data.clientId });
    },
    message(ws, raw) {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      switch (msg.t) {
        case "create":
          return handleCreate(ws, String(msg.name ?? ""));
        case "join":
          return handleJoin(ws, String(msg.code ?? ""), String(msg.name ?? ""));
        case "addBot":
          return handleAddBot(ws);
        case "removeBot":
          return handleRemoveBot(ws);
        case "clanMode":
          return handleClanMode(ws, String(msg.mode ?? ""));
        case "start":
          return handleStart(ws);
        case "again":
          return handleAgain(ws);
        case "action":
          return handleAction(ws, msg.action as Action);
        case "leave":
          return leaveCurrentRoom(ws);
      }
    },
    close(ws) {
      leaveCurrentRoom(ws);
    },
  },
});

console.log(`Ethnos multiplayer server listening on ws://localhost:${PORT}`);
