# Ethnos — 2nd Edition (digital)

A browser adaptation of **Ethnos: 2nd Edition** (Paolo Mori, CMON 2024) built with
**Bun + Next.js + Three.js** (react-three-fiber). The board is a 3D island surrounded
by animated water, seen from a player's seat at the table. Region prestige tokens
float and bob above the island, your hand sits at the bottom of the screen, and a
side drawer shows every player's cards, tokens, prestige, and whose turn it is.

## Run it

```sh
bun install
bun dev         # http://localhost:3000
bun run server  # multiplayer WebSocket server on :3001 (only needed for online play)
bun test        # engine unit tests
bun run build   # production build
```

Set `NEXT_PUBLIC_WS_URL` if the WebSocket server is not on `<host>:3001`.

## How to play

- **Setup screen**: pick 2–6 players (you play seat 1; the rest are AI), and either
  the rulebook's recommended first-game clans or a random six (five in 2–3 player games).
- **Recruit**: on your turn, click a face-up card on the floating rafts (Ally Pool)
  or click the deck to draw blind.
- **Play a Party**: click cards in your hand (same clan OR same color; Dogs are wild),
  choose the Leader (★), then *Play Party*. Marker placement, leader abilities, and
  discards resolve automatically; Deer/Koi/Red Panda choices open a picker
  (you can also click a region on the island directly for Deer/Koi picks).
- The Age ends when the third Dragon is revealed; scoring appears in a summary modal.

## Online multiplayer

Pick **🌐 Multiplayer** on the setup screen. The host creates a room and shares its
4-letter code; up to 6 seats, and bots can fill empty ones. The server is
authoritative: it runs the same pure engine, validates every action against the
sender's seat, and sends each client a **redacted view** — other players' hand
cards, the deck order (Dragon positions!), and the RNG seed are masked, so
devtools reveal nothing you couldn't see at a real table.

- **Disconnects**: a dropped player's seat is played by the AI until they return;
  a refreshed tab rejoins its seat automatically (rooms survive 10 minutes empty).
- **Rematch**: after the final scoring, the host can restart the room with the
  same seats.

## Rules coverage

The full 2nd-edition ruleset from the official CMON rulebook, including all 12 clans
(Owl Summoners, Rabbit Scientists, Red Panda Sages, Bear Stonewards, Raccoon Merchants,
Koi Sea Spirits, Tiger Samurai, Monkey Nomads, Dog Townsfolk, Fox Ninjas,
Deer Wind Knights, Raven Wizards), Owl chains, Fox tie-breaking, Koi board scoring,
2-player marker/scoring variants, 2-age games for 2–3 players, and the exact
first-player / tie-break / end-of-game rules.

**Approximated component values** — the rulebook does not enumerate some printed
numbers, so these live in [`src/game/constants.ts`](src/game/constants.ts) with
comments and are trivial to correct against a physical copy:
prestige-token distribution (two each of 4–12), Koi board length/symbol spaces and
its Age scoring values, Bear token Age bonuses, Monkey migration table, and
Raccoon coin values.

## Architecture

- `src/game/` — a **pure, JSON-serializable engine** (`newGame` + `applyAction`
  reducer with a seeded RNG). No React/Three imports, fully unit-tested; ready to be
  moved behind a server or synced over a realtime channel for online multiplayer.
- `src/game/ai.ts` — heuristic opponents (party enumeration + region-stake scoring),
  used by solo mode, server bots, and disconnected-seat autoplay.
- `src/game/redact.ts` — per-seat views of the state for the multiplayer server.
- `server/ws.ts` — Bun WebSocket server: in-memory rooms with 4-letter codes,
  seat reclaim on reconnect, host-controlled lobby (bots, clan mode, start, rematch).
- `src/lib/net.ts` — thin client with a per-tab identity and send queueing.
- `src/store/gameStore.ts` — zustand store bridging the engine to the UI, including
  the multi-step "play wizard" for leader abilities that need choices.
- `src/components/three/` — the island scene: shader water, region plateaus,
  control markers, floating prestige plates, Koi track lily pads, fox tokens,
  and the clickable Ally Pool / deck.
- `src/components/hud/` — DOM overlays: hand bar, action bar, players drawer,
  log feed, and modals (ability wizard, Monkey migration, Age scoring, game over).

### Debug console hook

In the browser console: `__ethnos.state()` returns the current game state and
`__ethnos.step()` plays one AI-chosen move for whoever must act (including you) —
useful for fast-forwarding and testing.
