import React, { useRef, useState } from "react";
import { pct } from "./format.js";

/* SVG charts themed for the tournament-blue surface. Mark specs follow the
   dataviz skill: 2px lines, thin columns with 4px rounded data-ends and square
   baselines, hairline solid grids, 2px surface gaps, selective direct labels,
   tooltips that enhance but never gate. */

const GRID = "var(--chart-grid)";
const AXIS = "var(--chart-axis)";
const MUTED = "var(--ink-muted)";
const INK = "var(--ink-secondary)";
const CHALK = "var(--chalk)";
const SURFACE = "var(--cloth-1)";
const WIN_COLOR = "var(--ball-2)";
const LOSS_COLOR = "var(--ball-3)";

const BALL_FILLS = {
  0: "#f3efe4",
  1: "var(--ball-1)",
  2: "var(--ball-2)",
  3: "var(--ball-3)",
  4: "var(--ball-4)",
  5: "var(--ball-5)",
  6: "var(--ball-6)",
  7: "#8a4a52",
};

function useTooltip() {
  const [tip, setTip] = useState(null);
  const show = (xPct, yPct, content) => setTip({ xPct, yPct, content });
  const hide = () => setTip(null);
  const node = tip ? (
    <div className="chartTip" style={{ left: `${tip.xPct}%`, top: `${tip.yPct}%` }}>
      {tip.content}
    </div>
  ) : null;
  return { show, hide, node };
}

function columnPath(x, yTop, width, height) {
  const r = Math.min(4, height, width / 2);
  const right = x + width;
  const bottom = yTop + height;
  return `M ${x} ${bottom} L ${x} ${yTop + r} Q ${x} ${yTop} ${x + r} ${yTop}
          L ${right - r} ${yTop} Q ${right} ${yTop} ${right} ${yTop + r}
          L ${right} ${bottom} Z`;
}

/* A pool ball drawn in SVG, for chart axes. */
function SvgBall({ cx, cy, n, r = 9 }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={BALL_FILLS[n] ?? "#f3efe4"} stroke="rgba(0,0,0,0.45)" strokeWidth="1" />
      {n > 0 && <circle cx={cx} cy={cy} r={r * 0.55} fill="#f3efe4" />}
      {n > 0 && (
        <text x={cx} y={cy + 3} fontSize={r * 0.9} fontWeight="700" fill="#1c1c1c" textAnchor="middle" fontFamily="var(--font-heading)">
          {n}
        </text>
      )}
    </g>
  );
}

export function RollingLine({ series, windowSize }) {
  const tooltip = useTooltip();
  const svgRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(null);
  const W = 680;
  const H = 230;
  const pad = { l: 42, r: 54, t: 14, b: 30 };

  if (!series || series.length < 2) {
    return <p className="muted">Not enough games here for a {windowSize}-game window yet.</p>;
  }

  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i) => pad.l + (i / (series.length - 1)) * iw;
  const y = (v) => pad.t + (1 - v) * ih;
  const points = series.map((p, i) => `${x(i)},${y(p.win_rate)}`).join(" ");
  const areaPoints = `${pad.l},${y(0)} ${points} ${x(series.length - 1)},${y(0)}`;
  const last = series[series.length - 1];

  const yearTicks = [];
  let prevYear = null;
  series.forEach((p, i) => {
    const year = p.date.slice(0, 4);
    if (year !== prevYear) {
      if (prevYear !== null) yearTicks.push({ i, year });
      prevYear = year;
    }
  });

  const onMove = (evt) => {
    const rect = svgRef.current.getBoundingClientRect();
    const vx = ((evt.clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(series.length - 1, Math.round(((vx - pad.l) / iw) * (series.length - 1))));
    setHoverIdx(i);
    const p = series[i];
    tooltip.show(
      (x(i) / W) * 100,
      (y(p.win_rate) / H) * 100,
      <>
        game <strong>{p.seq}</strong> · {p.date} · <strong>{pct(p.win_rate, 0)}</strong> over last {windowSize}
      </>
    );
  };
  const onLeave = () => {
    setHoverIdx(null);
    tooltip.hide();
  };

  return (
    <div className="chartWrap">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerLeave={onLeave}>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? AXIS : GRID} strokeWidth="1" />
            <text x={pad.l - 7} y={y(v) + 3.5} fontSize="10.5" fill={MUTED} textAnchor="end">
              {v * 100}%
            </text>
          </g>
        ))}
        {yearTicks.map((t) => (
          <g key={t.year}>
            <line x1={x(t.i)} x2={x(t.i)} y1={H - pad.b} y2={H - pad.b + 5} stroke={AXIS} strokeWidth="1" />
            <text x={x(t.i)} y={H - pad.b + 17} fontSize="10" fill={MUTED} textAnchor="middle">
              {t.year}
            </text>
          </g>
        ))}
        <polygon points={areaPoints} fill="rgba(95, 168, 232, 0.09)" />
        <polyline points={points} fill="none" stroke={CHALK} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hoverIdx !== null && (
          <g>
            <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={pad.t} y2={H - pad.b} stroke={AXIS} strokeWidth="1" />
            <circle cx={x(hoverIdx)} cy={y(series[hoverIdx].win_rate)} r="5" fill={CHALK} stroke={SURFACE} strokeWidth="2" />
          </g>
        )}
        <circle cx={x(series.length - 1)} cy={y(last.win_rate)} r="4.5" fill={CHALK} stroke={SURFACE} strokeWidth="2" />
        <text x={x(series.length - 1) + 9} y={y(last.win_rate) + 4} fontSize="12" fontWeight="600" fill={INK}>
          {pct(last.win_rate, 0)}
        </text>
      </svg>
      {tooltip.node}
    </div>
  );
}

/* Loser's-balls-left histogram. mode: "all" | "win" | "loss".
   Aggregate mode is a single series; split modes color by result. */
export function MarginHistogram({ whenWinning, whenLosing, mode }) {
  const tooltip = useTooltip();
  const W = 680;
  const H = 230;
  const pad = { l: 12, r: 12, t: 24, b: 40 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const values =
    mode === "win" ? whenWinning : mode === "loss" ? whenLosing : whenWinning.map((v, i) => v + whenLosing[i]);
  const color = mode === "win" ? WIN_COLOR : mode === "loss" ? LOSS_COLOR : CHALK;
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const max = Math.max(...values, 1);
  const band = iw / 8;
  const bw = Math.min(30, band * 0.5);
  const y = (v) => pad.t + (1 - v / max) * ih;

  return (
    <div className="chartWrap">
      <svg viewBox={`0 0 ${W} ${H}`} onPointerLeave={tooltip.hide}>
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke={AXIS} strokeWidth="1" />
        {values.map((v, i) => {
          const cx = pad.l + band * i + band / 2;
          const top = y(v);
          return (
            <g
              key={i}
              onPointerMove={() =>
                tooltip.show(
                  (cx / W) * 100,
                  (top / H) * 100,
                  <>
                    loser had <strong>{i}</strong> left · <strong>{v}</strong> games ({pct(v / total, 0)})
                  </>
                )
              }
            >
              <rect x={pad.l + band * i} y={pad.t} width={band} height={ih + 24} fill="transparent" />
              {v > 0 && <path d={columnPath(cx - bw / 2, top, bw, H - pad.b - top)} fill={color} />}
              {v > 0 && (
                <text x={cx} y={top - 6} fontSize="11" fill={INK} textAnchor="middle" fontWeight="600">
                  {v}
                </text>
              )}
              <SvgBall cx={cx} cy={H - pad.b + 16} n={i} />
            </g>
          );
        })}
      </svg>
      {tooltip.node}
    </div>
  );
}

/* Part-to-whole: one 100% bar with 2px gaps, labels below with swatch, %, count. */
export function Stack100({ items }) {
  const total = items.reduce((a, d) => a + d.value, 0);
  if (!total) return <p className="muted">Nothing recorded here.</p>;
  return (
    <div className="stack100">
      <div className="stackTrack">
        {items
          .filter((d) => d.value > 0)
          .map((d) => (
            <div
              key={d.label}
              className="stackSeg"
              style={{ flexGrow: d.value, background: d.color }}
              title={`${d.label}: ${d.value} (${pct(d.value / total, 1)})`}
            />
          ))}
      </div>
      <div className="stackLabels">
        {items
          .filter((d) => d.value > 0)
          .map((d) => (
            <span key={d.label}>
              <span className="legendDot" style={{ background: d.color }} />
              {d.label} <b>{pct(d.value / total, 1)}</b> ({d.value})
            </span>
          ))}
      </div>
    </div>
  );
}

export function BreakBars({ me, them }) {
  const W = 340;
  const H = 200;
  const pad = { l: 14, r: 14, t: 28, b: 44 };
  const ih = H - pad.t - pad.b;
  const y = (v) => pad.t + (1 - v) * ih;
  const items = [
    { label: "I break", stats: me, color: WIN_COLOR },
    { label: "They break", stats: them, color: AXIS },
  ];
  const band = (W - pad.l - pad.r) / 2;
  const bw = 26;

  return (
    <div className="chartWrap">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <line x1={pad.l} x2={W - pad.r} y1={y(0.5)} y2={y(0.5)} stroke={GRID} strokeWidth="1" />
        <text x={W - pad.r} y={y(0.5) - 4} fontSize="9.5" fill={MUTED} textAnchor="end">
          50%
        </text>
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke={AXIS} strokeWidth="1" />
        {items.map((d, i) => {
          const cx = pad.l + band * i + band / 2;
          const rate = d.stats.win_rate ?? 0;
          const top = y(rate);
          return (
            <g key={d.label}>
              <path d={columnPath(cx - bw / 2, top, bw, y(0) - top)} fill={d.color} />
              <text x={cx} y={top - 8} fontSize="14" fontWeight="700" fill={INK} textAnchor="middle" fontFamily="var(--font-heading)">
                {d.stats.win_rate === null ? "–" : pct(rate, 1)}
              </text>
              <text x={cx} y={y(0) + 16} fontSize="11.5" fill={INK} textAnchor="middle">
                {d.label}
              </text>
              <text x={cx} y={y(0) + 31} fontSize="10" fill={MUTED} textAnchor="middle">
                {d.stats.wins}–{d.stats.games - d.stats.wins} of {d.stats.games}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Columns({ items, format, detail, onPick }) {
  const tooltip = useTooltip();
  const W = 680;
  const H = 210;
  const pad = { l: 12, r: 12, t: 24, b: 26 };
  if (!items || !items.length) return null;

  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(...items.map((d) => d.value), 0.0001);
  const band = iw / items.length;
  const bw = Math.min(26, band * 0.6);
  const y = (v) => pad.t + (1 - v / max) * ih;

  return (
    <div className="chartWrap">
      <svg viewBox={`0 0 ${W} ${H}`} onPointerLeave={tooltip.hide}>
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke={AXIS} strokeWidth="1" />
        {items.map((d, i) => {
          const cx = pad.l + band * i + band / 2;
          const top = y(d.value);
          return (
            <g
              key={d.label}
              style={onPick ? { cursor: "pointer" } : undefined}
              onClick={onPick ? () => onPick(d) : undefined}
              onPointerMove={() => tooltip.show((cx / W) * 100, (top / H) * 100, detail ? detail(d) : format(d.value))}
            >
              <rect x={pad.l + band * i} y={pad.t} width={band} height={ih} fill="transparent" />
              <path d={columnPath(cx - bw / 2, top, bw, H - pad.b - top)} fill={WIN_COLOR} />
              <text x={cx} y={top - 6} fontSize="11" fill={INK} textAnchor="middle" fontWeight="600">
                {format(d.value)}
              </text>
              <text x={cx} y={H - pad.b + 15} fontSize="10.5" fill={MUTED} textAnchor="middle">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {tooltip.node}
    </div>
  );
}
