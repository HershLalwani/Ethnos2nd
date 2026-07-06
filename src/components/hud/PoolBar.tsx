"use client";

import { CLAN_INFO, HAND_LIMIT, REGION_INFO } from "@/game/constants";
import { humanCanAct, useGame } from "@/store/gameStore";

/** The face-up Ally Pool and the Ally Deck, docked at the top of the screen. */
export function PoolBar() {
  const game = useGame((s) => s.game);
  const humanId = useGame((s) => s.humanId);
  const dispatch = useGame((s) => s.dispatch);
  if (!game) return null;

  const canRecruit =
    humanCanAct(game, humanId) &&
    game.phase === "turn" &&
    game.players[humanId].hand.length < HAND_LIMIT;

  return (
    <div className="pool-bar">
      <div className="pool-label">ALLY POOL</div>
      <div className="pool-cards">
        {game.pool.length === 0 && <span className="pool-empty">empty</span>}
        {game.pool.map((card) => {
          const region = REGION_INFO[card.color];
          const info = CLAN_INFO[card.clan];
          const lightText = card.color === "white" || card.color === "yellow";
          return (
            <button
              key={card.id}
              className={`pool-card ${canRecruit ? "recruitable" : ""}`}
              style={{ ["--region" as string]: region.hex }}
              title={`${info.name} — ${region.name}\n${info.ability}`}
              disabled={!canRecruit}
              onClick={() => dispatch({ type: "recruitPool", player: humanId, cardId: card.id })}
            >
              <span className={`region-tag ${lightText ? "light-text" : ""}`}>
                {region.name.replace(" Region", "")}
              </span>
              <span className="emoji">{info.emoji}</span>
            </button>
          );
        })}
      </div>
      <button
        className={`deck-btn ${canRecruit ? "recruitable" : ""}`}
        disabled={!canRecruit || game.deck.length === 0}
        title="Draw the top card of the Ally Deck"
        onClick={() => dispatch({ type: "recruitDeck", player: humanId })}
      >
        <span className="deck-face">🐉</span>
        <span>Deck {game.deck.length}</span>
      </button>
    </div>
  );
}
