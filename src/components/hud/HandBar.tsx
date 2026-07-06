"use client";

import { CLAN_INFO, REGION_INFO } from "@/game/constants";
import type { Card } from "@/game/types";
import { isValidParty, markerEligible } from "@/game/validate";
import { humanCanAct, selectedCards, useGame } from "@/store/gameStore";

function HandCard({
  card,
  selected,
  isLeader,
  showLeaderBtn,
  onToggle,
  onLeader,
}: {
  card: Card;
  selected: boolean;
  isLeader: boolean;
  showLeaderBtn: boolean;
  onToggle: () => void;
  onLeader: () => void;
}) {
  const region = REGION_INFO[card.color];
  const info = CLAN_INFO[card.clan];
  const lightText = card.color === "white" || card.color === "yellow";
  return (
    <div
      className={`hand-card ${selected ? "selected" : ""}`}
      style={{ ["--region" as string]: region.hex }}
      onClick={onToggle}
      title={info.ability}
    >
      {selected && showLeaderBtn && card.clan !== "dog" && (
        <button
          className={`leader-btn ${isLeader ? "is-leader" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onLeader();
          }}
        >
          {isLeader ? "★ Leader" : "☆ Lead"}
        </button>
      )}
      <span className={`region-tag ${lightText ? "light-text" : ""}`}>
        {region.name.replace(" Region", "")}
      </span>
      <span className="emoji">{info.emoji}</span>
      <span className="clan-name">{info.name}</span>
    </div>
  );
}

export function HandBar() {
  const game = useGame((s) => s.game);
  const humanId = useGame((s) => s.humanId);
  const selected = useGame((s) => s.selected);
  const leaderId = useGame((s) => s.leaderId);
  const toggleCard = useGame((s) => s.toggleCard);
  const setLeader = useGame((s) => s.setLeader);
  const clearSelection = useGame((s) => s.clearSelection);
  const beginPlay = useGame((s) => s.beginPlay);
  const dispatch = useGame((s) => s.dispatch);
  if (!game) return null;

  const player = game.players[humanId];
  const canAct = humanCanAct(game, humanId);
  const inOwlChain = game.phase === "owlChain" && game.owlPlayer === humanId;

  const cards = selectedCards(game, humanId, selected);
  const nonDogs = cards.filter((c) => c.clan !== "dog");
  const validParty = cards.length > 0 && isValidParty(cards);
  const effectiveLeader =
    (leaderId && cards.find((c) => c.id === leaderId)) ||
    (nonDogs.length === 1 ? nonDogs[0] : null);
  const needsLeaderPick = validParty && !effectiveLeader;

  let preview = "";
  if (validParty && effectiveLeader) {
    if (effectiveLeader.clan === "deer") {
      preview = "Deer Leader: you will choose the Region.";
    } else {
      const eligible = markerEligible(
        game,
        humanId,
        effectiveLeader.color,
        cards.length,
        effectiveLeader.clan === "tiger"
      );
      preview = eligible
        ? `Places a marker in the ${REGION_INFO[effectiveLeader.color].name}.`
        : "Too small to place a marker (still scores at Age end).";
    }
  }

  return (
    <div className="hand-dock">
      {canAct && (
        <div className="action-bar">
          {cards.length === 0 ? (
            <span className="hint">
              {inOwlChain
                ? "Owl chain: select cards for another Party, or end your turn."
                : "Recruit from the Ally Pool at the top — or select cards here to play a Party."}
            </span>
          ) : (
            <>
              <span className={validParty ? "hint" : "invalid"}>
                Party of {cards.length} {validParty ? "✓" : "— must share a clan or a color"}
              </span>
              {needsLeaderPick && <span className="invalid">Pick a Leader (★ on a card)</span>}
              {preview && <span className="hint">{preview}</span>}
              <button
                className="primary"
                disabled={!validParty || !effectiveLeader}
                onClick={() => {
                  if (effectiveLeader && !leaderId) setLeader(effectiveLeader.id);
                  beginPlay();
                }}
              >
                Play Party
              </button>
              <button onClick={clearSelection}>Clear</button>
            </>
          )}
          {inOwlChain && (
            <button onClick={() => dispatch({ type: "endOwlChain", player: humanId })}>
              End Turn
            </button>
          )}
        </div>
      )}
      <div className="hand-cards">
        {player.hand.map((card) => (
          <HandCard
            key={card.id}
            card={card}
            selected={selected.includes(card.id)}
            isLeader={leaderId === card.id}
            showLeaderBtn={nonDogs.length > 1}
            onToggle={() => canAct && toggleCard(card.id)}
            onLeader={() => setLeader(card.id)}
          />
        ))}
      </div>
    </div>
  );
}
