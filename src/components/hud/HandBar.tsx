"use client";

import { useRef, useState } from "react";
import { CLAN_INFO, REGION_INFO } from "@/game/constants";
import type { Card } from "@/game/types";
import { isValidParty, markerEligible } from "@/game/validate";
import { humanCanAct, orderHand, selectedCards, useGame } from "@/store/gameStore";

function HandCard({
  card,
  selected,
  isLeader,
  showLeaderBtn,
  dragging,
  onToggle,
  onLeader,
  onPointerDown,
}: {
  card: Card;
  selected: boolean;
  isLeader: boolean;
  showLeaderBtn: boolean;
  dragging?: boolean;
  onToggle: () => void;
  onLeader: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const region = REGION_INFO[card.color];
  const info = CLAN_INFO[card.clan];
  const lightText = card.color === "white" || card.color === "yellow";
  return (
    <div
      className={`hand-card ${selected ? "selected" : ""} ${dragging ? "dragging" : ""}`}
      style={{ ["--region" as string]: region.hex }}
      onClick={onToggle}
      onPointerDown={onPointerDown}
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
  const handOrder = useGame((s) => s.handOrder);
  const toggleCard = useGame((s) => s.toggleCard);
  const setLeader = useGame((s) => s.setLeader);
  const clearSelection = useGame((s) => s.clearSelection);
  const beginPlay = useGame((s) => s.beginPlay);
  const dispatch = useGame((s) => s.dispatch);

  const cardsRef = useRef<HTMLDivElement>(null);
  // Set while a drag is in flight so the click that follows pointerup
  // doesn't also toggle the card's selection.
  const wasDrag = useRef(false);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);

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

  const hand = orderHand(player.hand, handOrder);

  /** Slide the dragged card to the slot under the pointer, live. */
  const reorderTo = (dragId: string, clientX: number) => {
    const container = cardsRef.current;
    if (!container) return;
    const s = useGame.getState();
    if (!s.game) return;
    const shown = orderHand(s.game.players[s.humanId].hand, s.handOrder);
    const els = Array.from(container.querySelectorAll<HTMLElement>(".hand-card"));
    if (els.length !== shown.length) return;
    const others: string[] = [];
    const centers: number[] = [];
    shown.forEach((c, i) => {
      if (c.id === dragId) return;
      others.push(c.id);
      const r = els[i].getBoundingClientRect();
      centers.push(r.left + r.width / 2);
    });
    let at = centers.findIndex((cx) => clientX < cx);
    if (at === -1) at = others.length;
    const next = [...others.slice(0, at), dragId, ...others.slice(at)];
    if (shown.some((c, i) => c.id !== next[i])) s.setHandOrder(next);
  };

  const startDrag = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    wasDrag.current = false;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    const grab = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const onMove = (ev: PointerEvent) => {
      if (!wasDrag.current && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
      wasDrag.current = true;
      setDrag({ id, x: ev.clientX - grab.x, y: ev.clientY - grab.y });
      reorderTo(id, ev.clientX);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const dragCard = drag ? hand.find((c) => c.id === drag.id) : null;

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
      <div className="hand-cards" ref={cardsRef}>
        {hand.map((card) => (
          <HandCard
            key={card.id}
            card={card}
            selected={selected.includes(card.id)}
            isLeader={leaderId === card.id}
            showLeaderBtn={nonDogs.length > 1}
            dragging={drag?.id === card.id}
            onToggle={() => !wasDrag.current && canAct && toggleCard(card.id)}
            onLeader={() => !wasDrag.current && setLeader(card.id)}
            onPointerDown={(e) => startDrag(e, card.id)}
          />
        ))}
      </div>
      {drag && dragCard && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <HandCard
            card={dragCard}
            selected={false}
            isLeader={false}
            showLeaderBtn={false}
            onToggle={() => {}}
            onLeader={() => {}}
          />
        </div>
      )}
    </div>
  );
}
