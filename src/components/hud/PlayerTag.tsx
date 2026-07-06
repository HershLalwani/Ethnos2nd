"use client";

import { PLAYER_COLORS } from "@/game/constants";

/** A player's name rendered with their marker color — used everywhere a
 * player is mentioned so colors are instantly recognizable. */
export function PlayerTag({
  seat,
  name,
  you,
  showColorName,
}: {
  seat: number;
  name: string;
  you?: boolean;
  showColorName?: boolean;
}) {
  const color = PLAYER_COLORS[seat];
  return (
    <span className="player-tag">
      <span className="dot" style={{ background: color.hex }} />
      <span style={{ color: color.hex, fontWeight: 700 }}>
        {name}
        {you ? " (you)" : ""}
      </span>
      {showColorName && <span className="color-name">{color.name}</span>}
    </span>
  );
}
