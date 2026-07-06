"use client";

import { useGame } from "@/store/gameStore";
import { PlayerTag } from "./PlayerTag";

export function TopBar() {
  const game = useGame((s) => s.game);
  const humanId = useGame((s) => s.humanId);
  const mode = useGame((s) => s.mode);
  const roomCode = useGame((s) => s.roomCode);
  const drawerOpen = useGame((s) => s.drawerOpen);
  const setDrawer = useGame((s) => s.setDrawer);
  const quit = useGame((s) => s.quit);
  if (!game) return null;

  const roman = ["Ⅰ", "Ⅱ", "Ⅲ"][game.age - 1];
  const actor =
    game.phase === "owlChain" && game.owlPlayer !== null ? game.owlPlayer : game.current;
  const isHuman = actor === humanId && (game.phase === "turn" || game.phase === "owlChain");

  return (
    <div className="top-bar">
      <div className="chip logo">ETHNOS</div>
      <div className="chip">Age {roman}</div>
      <div className="chip" title="Dragons revealed — the third ends the Age">
        {[0, 1, 2].map((i) => (
          <span key={i} className={i < game.dragonsRevealed ? "" : "dim"}>
            🐉
          </span>
        ))}
      </div>
      {mode === "online" && roomCode && (
        <div className="chip" title="Room code — share it to invite players">
          🏰 {roomCode}
        </div>
      )}
      <div className="turn-banner">
        <div className={`chip ${isHuman ? "your-turn" : ""}`}>
          {game.phase === "over" ? (
            "Game over"
          ) : game.phase === "monkeyDecision" ? (
            "Age end — Monkeys deciding…"
          ) : game.phase === "ageScored" ? (
            "Age scored"
          ) : isHuman ? (
            game.phase === "owlChain" ? (
              "Owl chain — play another Party or end your turn"
            ) : (
              "Your turn"
            )
          ) : (
            <>
              <PlayerTag seat={actor} name={game.players[actor].name} />
              <span>&nbsp;is thinking…</span>
            </>
          )}
        </div>
      </div>
      <div className="top-right">
        <button onClick={() => setDrawer(!drawerOpen)}>☰ Players</button>
        <button className="danger" onClick={quit}>
          {mode === "online" ? "Leave" : "New Game"}
        </button>
      </div>
    </div>
  );
}
