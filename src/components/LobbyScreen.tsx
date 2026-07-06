"use client";

import { PLAYER_COLORS } from "@/game/constants";
import { PlayerTag } from "./hud/PlayerTag";
import { useGame } from "@/store/gameStore";

export function LobbyScreen() {
  const lobby = useGame((s) => s.lobby);
  const humanId = useGame((s) => s.humanId);
  const addBot = useGame((s) => s.addBot);
  const removeBot = useGame((s) => s.removeBot);
  const setClanMode = useGame((s) => s.setClanMode);
  const startOnline = useGame((s) => s.startOnline);
  const quit = useGame((s) => s.quit);
  const error = useGame((s) => s.error);
  if (!lobby) return null;

  const me = lobby.seats.find((s) => s.seat === humanId);
  const isHost = !!me?.isHost;
  const hasBot = lobby.seats.some((s) => s.isBot);

  return (
    <div className="setup-root">
      <div className="setup-panel">
        <h1>ETHNOS</h1>
        <p className="tagline">Waiting in the harbor — share the room code with your rivals.</p>

        <div className="room-code">
          <label>ROOM CODE</label>
          <div className="code">{lobby.code}</div>
        </div>

        <div className="setup-row">
          <label>
            Players ({lobby.seats.length}/6) — colors are assigned by seat
          </label>
          <div className="lobby-seats">
            {lobby.seats.map((s) => (
              <div
                key={s.seat}
                className="lobby-seat"
                style={{ borderLeftColor: PLAYER_COLORS[s.seat].hex }}
              >
                <PlayerTag seat={s.seat} name={s.name} you={s.seat === humanId} showColorName />
                <span className="seat-flags">
                  {s.isBot && "🤖 bot"}
                  {s.isHost && " ⭐ host"}
                  {!s.isBot && !s.connected && " ⚠ disconnected"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <>
            <div className="setup-row">
              <label>Clans</label>
              <div className="opt-row">
                <button
                  className={`opt ${lobby.clanMode === "recommended" ? "picked" : ""}`}
                  onClick={() => setClanMode("recommended")}
                >
                  Recommended (first game)
                </button>
                <button
                  className={`opt ${lobby.clanMode === "random" ? "picked" : ""}`}
                  onClick={() => setClanMode("random")}
                >
                  Random
                </button>
              </div>
            </div>
            <div className="setup-row opt-row">
              <button className="opt" disabled={lobby.seats.length >= 6} onClick={addBot}>
                + Add bot
              </button>
              <button className="opt" disabled={!hasBot} onClick={removeBot}>
                − Remove bot
              </button>
            </div>
            <button
              className="primary start-btn"
              disabled={lobby.seats.length < 2}
              onClick={startOnline}
            >
              {lobby.seats.length < 2 ? "Waiting for players (or add a bot)…" : "Start the game ⚔"}
            </button>
          </>
        ) : (
          <p className="tagline" style={{ marginTop: 18 }}>
            Waiting for the host to start the game…
          </p>
        )}

        {error && <p style={{ color: "#ff9d76", marginTop: 10, fontSize: 13.5 }}>⚠ {error}</p>}

        <button className="danger start-btn" style={{ marginTop: 10 }} onClick={quit}>
          Leave room
        </button>
      </div>
    </div>
  );
}
