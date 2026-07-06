"use client";

import { CLAN_INFO, MONKEY_MIGRATE_PRESTIGE, REGION_INFO } from "@/game/constants";
import { REGION_COLORS, type RegionColor } from "@/game/types";
import { markerEligible } from "@/game/validate";
import { PLAYER_COLORS } from "@/game/constants";
import { useGame } from "@/store/gameStore";
import { PlayerTag } from "./PlayerTag";

function RegionPicker({
  picked,
  onPick,
  eligibility,
}: {
  picked: RegionColor[];
  onPick: (r: RegionColor) => void;
  eligibility?: (r: RegionColor) => boolean;
}) {
  return (
    <div className="region-grid">
      {REGION_COLORS.map((r) => {
        const info = REGION_INFO[r];
        const ok = eligibility ? eligibility(r) : true;
        const light = r === "white" || r === "yellow";
        return (
          <button
            key={r}
            className={`region-btn ${light ? "light" : ""} ${picked.includes(r) ? "picked" : ""}`}
            style={{ background: info.hex, opacity: ok ? 1 : 0.35 }}
            disabled={!ok}
            onClick={() => onPick(r)}
          >
            {info.name.replace(" Region", "")}
            <span className="small">{picked.includes(r) ? "chosen" : ok ? "" : "not eligible"}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Extra choices needed before a Party can be played (Deer / Koi / Red Panda). */
function PlayWizardModal() {
  const game = useGame((s) => s.game);
  const humanId = useGame((s) => s.humanId);
  const wizard = useGame((s) => s.wizard);
  const updateWizard = useGame((s) => s.updateWizard);
  const confirmWizard = useGame((s) => s.confirmWizard);
  const cancelWizard = useGame((s) => s.cancelWizard);
  if (!game || !wizard) return null;

  const partySize = wizard.cardIds.length;
  const hand = game.players[humanId].hand;
  const partyIds = new Set(wizard.cardIds);
  const leftovers = hand.filter((c) => !partyIds.has(c.id));
  const ready = !wizard.needsDeer || !!wizard.deerRegion;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Leader ability</h2>
        {wizard.needsDeer && (
          <>
            <p className="sub">
              🦌 Deer Wind Knights: choose ANY Region for your Control marker (Party of{" "}
              {partySize}).
            </p>
            <RegionPicker
              picked={wizard.deerRegion ? [wizard.deerRegion] : []}
              onPick={(r) => updateWizard({ deerRegion: r })}
              eligibility={(r) => markerEligible(game, humanId, r, partySize, false)}
            />
          </>
        )}
        {wizard.koiCrossings > 0 && (
          <>
            <p className="sub">
              🐟 Koi Sea Spirits: you passed {wizard.koiCrossings} Koi symbol
              {wizard.koiCrossings > 1 ? "s" : ""} — place {wizard.koiCrossings} bonus marker
              {wizard.koiCrossings > 1 ? "s" : ""} in ANY Region (no size limit). Click again to
              remove a pick; confirming with fewer picks skips the rest.
            </p>
            <RegionPicker
              picked={wizard.koiBonusRegions}
              onPick={(r) => {
                const cur = wizard.koiBonusRegions;
                if (cur.includes(r)) {
                  const idx = cur.indexOf(r);
                  updateWizard({ koiBonusRegions: cur.filter((_, i) => i !== idx) });
                } else if (cur.length < wizard.koiCrossings) {
                  updateWizard({ koiBonusRegions: [...cur, r] });
                }
              }}
            />
          </>
        )}
        {wizard.keepAllowance > 0 && (
          <>
            <p className="sub">
              🐼 Red Panda Sages: keep up to {wizard.keepAllowance} of your remaining cards instead
              of discarding them.
            </p>
            <div className="keep-grid">
              {leftovers.map((c) => {
                const picked = wizard.keepCardIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    className={`keep-card ${picked ? "picked" : ""}`}
                    onClick={() => {
                      if (picked) {
                        updateWizard({
                          keepCardIds: wizard.keepCardIds.filter((id) => id !== c.id),
                        });
                      } else if (wizard.keepCardIds.length < wizard.keepAllowance) {
                        updateWizard({ keepCardIds: [...wizard.keepCardIds, c.id] });
                      }
                    }}
                  >
                    {CLAN_INFO[c.clan].emoji} {REGION_INFO[c.color].name.replace(" Region", "")}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <div className="actions">
          <button onClick={cancelWizard}>Cancel</button>
          <button className="primary" disabled={!ready} onClick={confirmWizard}>
            Play Party
          </button>
        </div>
      </div>
    </div>
  );
}

function MonkeyModal() {
  const game = useGame((s) => s.game);
  const humanId = useGame((s) => s.humanId);
  const dispatch = useGame((s) => s.dispatch);
  if (!game || game.phase !== "monkeyDecision" || !game.monkeyPending.includes(humanId)) {
    return null;
  }
  const count = game.players[humanId].monkeyBoard.length;
  const prestige = MONKEY_MIGRATE_PRESTIGE[Math.min(count, MONKEY_MIGRATE_PRESTIGE.length - 1)];
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>🐵 Monkey Settlement</h2>
        <p className="sub">
          The Age has ended. You have {count} marker{count > 1 ? "s" : ""} on your Monkey
          Settlement board. Migrate now for <b>{prestige} Prestige</b>, or stay settled to grow
          the settlement and score more in a later Age.
        </p>
        <div className="actions">
          <button onClick={() => dispatch({ type: "monkeyDecision", player: humanId, migrate: false })}>
            Stay settled
          </button>
          <button
            className="primary"
            onClick={() => dispatch({ type: "monkeyDecision", player: humanId, migrate: true })}
          >
            Migrate (+{prestige} ✦)
          </button>
        </div>
      </div>
    </div>
  );
}

function regionLabel(region: string): string {
  return region === "koi" ? "🐟 Koi board" : REGION_INFO[region as RegionColor].name;
}

function AgeScoreModal() {
  const game = useGame((s) => s.game);
  const dismissed = useGame((s) => s.scoringDismissed);
  const dismissScoring = useGame((s) => s.dismissScoring);
  const dispatch = useGame((s) => s.dispatch);
  const quit = useGame((s) => s.quit);
  const mode = useGame((s) => s.mode);
  const lobby = useGame((s) => s.lobby);
  const humanId = useGame((s) => s.humanId);
  const playAgain = useGame((s) => s.playAgain);
  if (!game || !game.lastScoring || dismissed) return null;
  if (game.phase !== "ageScored" && game.phase !== "over") return null;

  const s = game.lastScoring;
  const over = game.phase === "over";
  const partyTotals = new Map<number, { count: number; prestige: number }>();
  for (const line of s.partyLines) {
    const cur = partyTotals.get(line.player) ?? { count: 0, prestige: 0 };
    partyTotals.set(line.player, {
      count: cur.count + 1,
      prestige: cur.prestige + line.prestige,
    });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>
          {over
            ? "🏆 Final scoring — the game ends"
            : `Age ${["Ⅰ", "Ⅱ", "Ⅲ"][s.age - 1]} has ended`}
        </h2>
        {s.regionLines.length > 0 && (
          <table className="score-table">
            <thead>
              <tr>
                <th>Region</th>
                <th>Player</th>
                <th>Rank</th>
                <th>Prestige</th>
              </tr>
            </thead>
            <tbody>
              {s.regionLines.map((l, i) => (
                <tr key={i}>
                  <td>{regionLabel(l.region)}</td>
                  <td>
                    <PlayerTag seat={l.player} name={game.players[l.player].name} />
                  </td>
                  <td>
                    {l.rank}
                    {l.tied ? " (tie)" : ""}
                  </td>
                  <td>+{l.prestige}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <table className="score-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Parties</th>
              <th>Party prestige</th>
            </tr>
          </thead>
          <tbody>
            {game.players.map((p) => {
              const t = partyTotals.get(p.id) ?? { count: 0, prestige: 0 };
              return (
                <tr key={p.id}>
                  <td>
                    <PlayerTag seat={p.id} name={p.name} />
                  </td>
                  <td>{t.count}</td>
                  <td>+{t.prestige}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {s.bonusLines.length > 0 && (
          <table className="score-table">
            <tbody>
              {s.bonusLines.map((b, i) => (
                <tr key={i}>
                  <td>
                    <PlayerTag seat={b.player} name={game.players[b.player].name} />
                  </td>
                  <td>{b.text}</td>
                  <td>+{b.prestige}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="totals-row">
          {[...game.players]
            .sort((a, b) => b.prestige - a.prestige)
            .map((p) => (
              <span
                key={p.id}
                className="total-chip"
                style={{ border: `2px solid ${PLAYER_COLORS[p.id].hex}` }}
              >
                {over && game.winners?.includes(p.id) ? "👑 " : ""}
                <PlayerTag seat={p.id} name={p.name} /> {p.prestige} ✦
              </span>
            ))}
        </div>
        <div className="actions">
          {over ? (
            mode === "online" ? (
              <>
                <button onClick={quit}>Leave room</button>
                {lobby?.seats.find((st) => st.seat === humanId)?.isHost ? (
                  <button className="primary" onClick={playAgain}>
                    Rematch (same room)
                  </button>
                ) : (
                  <span className="sub" style={{ alignSelf: "center" }}>
                    The host can start a rematch…
                  </span>
                )}
              </>
            ) : (
              <button className="primary" onClick={quit}>
                Play again
              </button>
            )
          ) : (
            <>
              <button onClick={dismissScoring}>View board</button>
              <button className="primary" onClick={() => dispatch({ type: "startNextAge" })}>
                Begin the next Age
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Reopen button when the user dismissed the scoring modal to look at the board. */
function ScoringReopen() {
  const game = useGame((s) => s.game);
  const dismissed = useGame((s) => s.scoringDismissed);
  const dispatch = useGame((s) => s.dispatch);
  if (!game || game.phase !== "ageScored" || !dismissed) return null;
  return (
    <div className="toast" style={{ background: "#2c3e5a" }}>
      <button className="primary" onClick={() => dispatch({ type: "startNextAge" })}>
        Begin the next Age →
      </button>
    </div>
  );
}

function ErrorToast() {
  const error = useGame((s) => s.error);
  const setError = useGame((s) => s.setError);
  if (!error) return null;
  return (
    <div className="toast" onClick={() => setError(null)}>
      ⚠ {error}
    </div>
  );
}

export function Modals() {
  return (
    <>
      <PlayWizardModal />
      <MonkeyModal />
      <AgeScoreModal />
      <ScoringReopen />
      <ErrorToast />
    </>
  );
}
