"use client";

import { useState } from "react";
import { CLAN_INFO, RECOMMENDED_CLANS } from "@/game/constants";
import { CLANS, type Clan } from "@/game/types";
import { useGame } from "@/store/gameStore";

const AI_NAMES = ["Hiroshi", "Emi", "Wilfred", "Rowan", "Sable"];

function pickRandomClans(count: number): Clan[] {
  const pool = [...CLANS];
  const picked: Clan[] = [];
  while (picked.length < count) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picked;
}

export function SetupScreen() {
  const start = useGame((s) => s.start);
  const createRoom = useGame((s) => s.createRoom);
  const joinRoom = useGame((s) => s.joinRoom);
  const connStatus = useGame((s) => s.connStatus);
  const error = useGame((s) => s.error);
  const [tab, setTab] = useState<"solo" | "online">("solo");
  const [name, setName] = useState("You");
  const [code, setCode] = useState("");
  const [numPlayers, setNumPlayers] = useState(4);
  const [clanMode, setClanMode] = useState<"recommended" | "random">("recommended");

  const smallGame = numPlayers <= 3;
  const clanCount = smallGame ? 5 : 6;
  const clans = clanMode === "recommended" ? RECOMMENDED_CLANS.slice(0, clanCount) : null;

  const beginSolo = () => {
    const chosen = clans ?? pickRandomClans(clanCount);
    start({
      numPlayers,
      playerNames: [name.trim() || "You", ...AI_NAMES.slice(0, numPlayers - 1)],
      aiPlayers: [false, ...Array(numPlayers - 1).fill(true)],
      clans: chosen,
      agesTotal: smallGame ? 2 : 3,
      seed: Math.floor(Math.random() * 2 ** 31),
    });
  };

  return (
    <div className="setup-root">
      <div className="setup-panel">
        <h1>ETHNOS</h1>
        <p className="tagline">
          2nd Edition — unite the Clans, control the Regions, become the Emperor of Ethnos.
        </p>

        <div className="setup-row">
          <label>Your name</label>
          <input type="text" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="setup-row opt-row">
          <button className={`opt ${tab === "solo" ? "picked" : ""}`} onClick={() => setTab("solo")}>
            🏝 Solo vs AI
          </button>
          <button className={`opt ${tab === "online" ? "picked" : ""}`} onClick={() => setTab("online")}>
            🌐 Multiplayer
          </button>
        </div>

        {tab === "solo" ? (
          <>
            <div className="setup-row">
              <label>Players (you + AI rivals)</label>
              <div className="opt-row">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    className={`opt ${numPlayers === n ? "picked" : ""}`}
                    onClick={() => setNumPlayers(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 12.5, opacity: 0.7, marginTop: 6 }}>
                {smallGame
                  ? "2-3 players: two Ages, 5 Clans, tougher marker placement."
                  : "Three Ages, 6 Clans."}
              </p>
            </div>

            <div className="setup-row">
              <label>Clans</label>
              <div className="opt-row">
                <button
                  className={`opt ${clanMode === "recommended" ? "picked" : ""}`}
                  onClick={() => setClanMode("recommended")}
                >
                  Recommended (first game)
                </button>
                <button
                  className={`opt ${clanMode === "random" ? "picked" : ""}`}
                  onClick={() => setClanMode("random")}
                >
                  Random
                </button>
              </div>
              <div className="clan-preview">
                {(clans ?? Array.from({ length: clanCount })).map((c, i) => (
                  <span key={i} className="party-chip">
                    {c ? `${CLAN_INFO[c as Clan].emoji} ${CLAN_INFO[c as Clan].name}` : "❓ Random"}
                  </span>
                ))}
              </div>
            </div>

            <button className="primary start-btn" onClick={beginSolo}>
              Set sail for Ethnos ⛵
            </button>
          </>
        ) : (
          <>
            <div className="setup-row">
              <label>Host a new room (up to 6 players, bots can fill seats)</label>
              <button className="primary start-btn" onClick={() => createRoom(name.trim() || "Host")}>
                Create room 🏰
              </button>
            </div>
            <div className="setup-row">
              <label>Or join a friend&apos;s room</label>
              <div className="opt-row" style={{ alignItems: "stretch" }}>
                <input
                  type="text"
                  placeholder="CODE"
                  value={code}
                  maxLength={4}
                  style={{ width: 120, textTransform: "uppercase", letterSpacing: 4, textAlign: "center" }}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <button
                  className="primary"
                  disabled={code.trim().length < 4}
                  onClick={() => joinRoom(code, name.trim() || "Player")}
                >
                  Join ⚓
                </button>
              </div>
            </div>
            {connStatus === "connecting" && <p className="tagline">Connecting to the server…</p>}
            {connStatus === "closed" && (
              <p style={{ color: "#ff9d76", fontSize: 13.5 }}>
                ⚠ Can&apos;t reach the multiplayer server. Start it with <code>bun run server</code>.
              </p>
            )}
            {error && <p style={{ color: "#ff9d76", fontSize: 13.5, marginTop: 8 }}>⚠ {error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
