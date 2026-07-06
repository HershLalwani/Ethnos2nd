"use client";

import { useEffect } from "react";
import { decideAction } from "@/game/ai";
import { pendingAiMove, useGame } from "@/store/gameStore";
import { LobbyScreen } from "./LobbyScreen";
import { SetupScreen } from "./SetupScreen";
import { GameScene } from "./three/GameScene";
import { HandBar } from "./hud/HandBar";
import { LogFeed } from "./hud/LogFeed";
import { Modals } from "./hud/Modals";
import { PoolBar } from "./hud/PoolBar";
import { SideDrawer } from "./hud/SideDrawer";
import { TopBar } from "./hud/TopBar";

export default function GameApp() {
  const game = useGame((s) => s.game);
  const mode = useGame((s) => s.mode);
  const lobby = useGame((s) => s.lobby);
  const connStatus = useGame((s) => s.connStatus);
  const dispatch = useGame((s) => s.dispatch);
  const joinRoom = useGame((s) => s.joinRoom);

  // Refreshed mid-game? Reclaim our seat. The code is cleared first so a dead
  // room doesn't loop; a successful join stores it again.
  useEffect(() => {
    const code = sessionStorage.getItem("ethnos-room");
    if (!code) return;
    sessionStorage.removeItem("ethnos-room");
    joinRoom(code, sessionStorage.getItem("ethnos-name") ?? "");
  }, [joinRoom]);

  // Drive AI turns locally in solo mode (the server drives them online).
  useEffect(() => {
    if (mode !== "local") return;
    const move = pendingAiMove(game);
    if (!move) return;
    const delay = game!.phase === "monkeyDecision" ? 450 : 950;
    const t = setTimeout(() => dispatch(move.action), delay);
    return () => clearTimeout(t);
  }, [game, mode, dispatch]);

  // Debug/E2E hook: step any pending move (including the human's) from the console.
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__ethnos = {
      state: () => useGame.getState().game,
      step: () => {
        const s = useGame.getState();
        const g = s.game;
        if (!g) return "no-game";
        if (g.phase === "ageScored") {
          s.dispatch({ type: "startNextAge" });
          return "next-age";
        }
        if (g.phase === "over") return "over";
        const actor =
          g.phase === "monkeyDecision"
            ? g.monkeyPending[0]
            : g.phase === "owlChain"
              ? g.owlPlayer!
              : g.current;
        s.dispatch(decideAction(g, actor));
        return g.phase;
      },
    };
  }, []);

  if (!game) {
    if (mode === "online" && lobby) return <LobbyScreen />;
    return <SetupScreen />;
  }

  return (
    <div className="app-root">
      <GameScene />
      <TopBar />
      <PoolBar />
      <LogFeed />
      <HandBar />
      <SideDrawer />
      <Modals />
      {mode === "online" && connStatus !== "open" && (
        <div className="conn-banner">⚡ Connection lost — reconnecting… (your seat is saved)</div>
      )}
    </div>
  );
}
