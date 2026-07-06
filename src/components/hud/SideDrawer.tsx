"use client";

import { CLAN_INFO, PLAYER_COLORS } from "@/game/constants";
import { boardMarkerTotal } from "@/game/score";
import { useGame } from "@/store/gameStore";
import { PlayerTag } from "./PlayerTag";

export function SideDrawer() {
  const game = useGame((s) => s.game);
  const humanId = useGame((s) => s.humanId);
  const drawerOpen = useGame((s) => s.drawerOpen);
  const setDrawer = useGame((s) => s.setDrawer);
  if (!game) return null;

  const actor =
    game.phase === "owlChain" && game.owlPlayer !== null ? game.owlPlayer : game.current;

  return (
    <div className={`drawer ${drawerOpen ? "open" : ""}`}>
      <div className="drawer-head">
        <span>PLAYERS</span>
        <button onClick={() => setDrawer(false)}>✕</button>
      </div>
      <div className="drawer-body">
        {game.players.map((p) => {
          const isTurn =
            (game.phase === "turn" || game.phase === "owlChain") && actor === p.id;
          return (
            <div
              key={p.id}
              className={`player-card ${isTurn ? "active" : ""}`}
              style={{ borderLeft: `6px solid ${PLAYER_COLORS[p.id].hex}` }}
            >
              <div className="row">
                <PlayerTag seat={p.id} name={p.name} you={p.id === humanId} showColorName />
                {isTurn && <span>⟵ turn</span>}
                <span style={{ marginLeft: "auto", fontWeight: 800, color: "#ffd75e" }}>
                  {p.prestige} ✦
                </span>
              </div>
              <div className="stats">
                <span title="Cards in hand">🂠 {p.hand.length}</span>
                <span title="Control markers on the board">📍 {boardMarkerTotal(game, p.id)}</span>
                <span title="Markers in reserve">◍ {p.markersLeft}</span>
                {game.koiInPlay && <span title="Koi board position">🐟 {p.koiPos}</span>}
                {p.monkeyBoard.length > 0 && (
                  <span title="Monkey Settlement markers">🐵 {p.monkeyBoard.length}</span>
                )}
                {p.foxTokens.length > 0 && (
                  <span title="Fox tokens">🦊 {p.foxTokens.join(", ")}</span>
                )}
                {game.bearHolder?.player === p.id && (
                  <span title={`Bear token (party of ${game.bearHolder.size})`}>
                    🐻 {game.bearHolder.size}
                  </span>
                )}
              </div>
              {p.parties.length > 0 && (
                <div className="parties">
                  {p.parties.map((party, i) => {
                    const leader = party.cards.find((c) => c.id === party.leaderId);
                    return (
                      <span key={i} className="party-chip" title={leader && CLAN_INFO[leader.clan].name}>
                        {leader ? CLAN_INFO[leader.clan].emoji : "?"} ×{party.cards.length}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="drawer-section">
          <span>
            <b>Clans in play:</b>{" "}
            {game.config.clans.map((c) => `${CLAN_INFO[c].emoji} ${CLAN_INFO[c].name}`).join(" · ")}
          </span>
          {game.config.clans.includes("fox") && (
            <span>
              <b>Fox tokens left:</b> {game.foxAvailable.join(", ") || "none"}
            </span>
          )}
          {game.config.clans.includes("raccoon") && (
            <span>
              <b>Raccoon coins left:</b> {game.raccoonCoins.length}
            </span>
          )}
          <span>
            <b>Dragons revealed:</b> {game.dragonsRevealed} / 3
          </span>
        </div>
      </div>
    </div>
  );
}
