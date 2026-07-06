"use client";

import { PLAYER_COLORS } from "@/game/constants";
import { useGame } from "@/store/gameStore";

export function LogFeed() {
  const game = useGame((s) => s.game);
  if (!game) return null;
  const entries = game.log.slice(-9).reverse();
  return (
    <div className="log-feed">
      {entries.map((e, i) => (
        <div
          key={`${game.log.length}-${i}`}
          className={`log-entry ${e.kind}`}
          style={
            e.player !== undefined
              ? { borderLeftColor: PLAYER_COLORS[e.player].hex }
              : undefined
          }
        >
          {e.player !== undefined && (
            <span className="dot" style={{ background: PLAYER_COLORS[e.player].hex }} />
          )}
          {e.text}
        </div>
      ))}
    </div>
  );
}
