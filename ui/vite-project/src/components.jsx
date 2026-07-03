import React from "react";
import { WIN_TYPE_LABELS } from "./format.js";

export function Section({ eyebrow, title, lede, action, children }) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
        </div>
        {action || null}
      </div>
      {lede ? <p className="sectionCopy">{lede}</p> : null}
      {children}
    </section>
  );
}

export function StatCard({ label, value, detail }) {
  return (
    <div className="statCard">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export function Takeaway({ children }) {
  return (
    <p className="takeaway">
      <span className="takeawayMark">◆</span>
      {children}
    </p>
  );
}

export function PillToggle({ options, value, onChange }) {
  return (
    <div className="pillToggle">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={value === opt.value ? "on" : ""}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Meter({ value, label }) {
  return (
    <span className="meter">
      <span className="meterFill" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
      <span className="meterNotch" />
      <span className="meterLabel">{label}</span>
    </span>
  );
}

/* A rendered pool ball. n: 0 = cue ball, 1..8 = that ball.
   Without a size prop, dimensions come from CSS (26px default, 40px in the
   record form); with one, everything scales inline. */
export function Ball({ n, size }) {
  const style = size ? { width: size, height: size, fontSize: Math.round(size * 0.45) } : undefined;
  const innerStyle = size ? { width: Math.round(size * 0.58), height: Math.round(size * 0.58) } : undefined;
  return (
    <span className={`ballIcon ballIcon-${n}`} style={style} aria-label={n === 0 ? "cue ball" : `${n} ball`}>
      {n > 0 ? <i style={innerStyle}>{n}</i> : null}
    </span>
  );
}

export function WinLoss({ wins, losses }) {
  return (
    <span className={wins >= losses ? "wlWin" : "wlLoss"}>
      {wins}–{losses}
    </span>
  );
}

function cutthroatSummary(game, me) {
  const places = game.finish_places || {};
  const order = Object.keys(places).sort((a, b) => places[a] - places[b]);
  if (!order.length) return "cutthroat";
  return `cutthroat · ${order.map((n) => (n === me ? "me" : n)).join(" → ")}`;
}

/* The game-by-game log for one session, shared by the session log page and
   the scoped dashboard panel. */
export function GameRows({ games, me = "ted" }) {
  return (
    <div className="gameLog">
      {games.map((g) => (
        <div className="gamerow" key={g.id}>
          <span className={g.result === "win" ? "wlWin" : "wlLoss"}>{g.result === "win" ? "W" : "L"}</span>
          <span className="muted">#{g.seq}</span>
          <span>vs {g.opponents.join(", ")}</span>
          {g.teammates.length ? <span className="meta">with {g.teammates.join(", ")}</span> : null}
          <span className="meta">
            {g.game_type === "cutthroat" ? (
              cutthroatSummary(g, me)
            ) : (
              <>
                {WIN_TYPE_LABELS[g.win_type] || g.win_type}
                {g.loser_balls_left !== null && (
                  <>
                    {" · loser had "}
                    <Ball n={g.loser_balls_left} size={18} />
                  </>
                )}
                {g.winner_balls_left > 0 && (
                  <>
                    {", winner "}
                    <Ball n={g.winner_balls_left} size={18} />
                  </>
                )}
                {g.breaker ? ` · ${g.breaker} broke` : ""}
              </>
            )}
          </span>
          {g.notes ? <span className="meta gameNote">{g.notes}</span> : null}
        </div>
      ))}
    </div>
  );
}
