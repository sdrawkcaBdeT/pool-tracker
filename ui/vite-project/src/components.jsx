import React from "react";

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
