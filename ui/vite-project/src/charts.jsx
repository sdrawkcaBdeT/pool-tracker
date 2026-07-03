import React, { useRef, useState } from "react";

/* Shared SVG chart pieces. Marks follow the dataviz specs: 2px lines, <=24px
   bars with 4px rounded data-ends (square at the baseline), hairline solid
   gridlines, surface gaps/rings, selective direct labels, hover tooltips that
   enhance but never gate (all values are also direct-labeled or tabled). */

const SERIES = "var(--series-1)";
const WASH = "var(--series-1-wash)";
const DEEMPH = "var(--deemph)";
const GRID = "var(--grid)";
const BASE = "var(--baseline)";
const MUTED = "var(--text-muted)";
const INK = "var(--text-secondary)";
const SURFACE = "var(--surface-1)";

function useTooltip() {
  const [tip, setTip] = useState(null);
  const show = (xPct, yPct, content) => setTip({ xPct, yPct, content });
  const hide = () => setTip(null);
  const node = tip ? (
    <div className="tooltip" style={{ left: `${tip.xPct}%`, top: `${tip.yPct}%` }}>
      {tip.content}
    </div>
  ) : null;
  return { show, hide, node };
}

/* Column with a 4px rounded top and square baseline. */
function columnPath(x, yTop, width, height) {
  const r = Math.min(4, height, width / 2);
  const right = x + width;
  const bottom = yTop + height;
  return `M ${x} ${bottom} L ${x} ${yTop + r} Q ${x} ${yTop} ${x + r} ${yTop}
          L ${right - r} ${yTop} Q ${right} ${yTop} ${right} ${yTop + r}
          L ${right} ${bottom} Z`;
}

/* Horizontal bar with a 4px rounded data-end (right), square at the left baseline. */
function hbarPath(x, y, width, height) {
  const r = Math.min(4, width, height / 2);
  const right = x + width;
  return `M ${x} ${y} L ${right - r} ${y} Q ${right} ${y} ${right} ${y + r}
          L ${right} ${y + height - r} Q ${right} ${y + height} ${right - r} ${y + height}
          L ${x} ${y + height} Z`;
}

export function RollingLine({ series, windowSize }) {
  const tooltip = useTooltip();
  const svgRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(null);
  const W = 680;
  const H = 220;
  const pad = { l: 40, r: 52, t: 12, b: 26 };

  if (!series || series.length < 2) {
    return <p className="sub">Not enough games for a {windowSize}-game window here.</p>;
  }

  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i) => pad.l + (i / (series.length - 1)) * iw;
  const y = (v) => pad.t + (1 - v) * ih;
  const points = series.map((p, i) => `${x(i)},${y(p.win_rate)}`).join(" ");
  const areaPoints = `${pad.l},${y(0)} ${points} ${x(series.length - 1)},${y(0)}`;
  const last = series[series.length - 1];

  const onMove = (evt) => {
    const rect = svgRef.current.getBoundingClientRect();
    const vx = ((evt.clientX - rect.left) / rect.width) * W;
    const i = Math.max(
      0,
      Math.min(series.length - 1, Math.round(((vx - pad.l) / iw) * (series.length - 1)))
    );
    setHoverIdx(i);
    const p = series[i];
    tooltip.show(
      (x(i) / W) * 100,
      (y(p.win_rate) / H) * 100,
      `game ${p.seq} · ${p.date} · ${(p.win_rate * 100).toFixed(0)}%`
    );
  };
  const onLeave = () => {
    setHoverIdx(null);
    tooltip.hide();
  };

  return (
    <div className="chart-wrap">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerLeave={onLeave}>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? BASE : GRID} strokeWidth="1" />
            <text x={pad.l - 6} y={y(v) + 3.5} fontSize="10.5" fill={MUTED} textAnchor="end">
              {v * 100}%
            </text>
          </g>
        ))}
        <polygon points={areaPoints} fill={WASH} />
        <polyline
          points={points}
          fill="none"
          stroke={SERIES}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hoverIdx !== null && (
          <g>
            <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={pad.t} y2={H - pad.b} stroke={BASE} strokeWidth="1" />
            <circle cx={x(hoverIdx)} cy={y(series[hoverIdx].win_rate)} r="5" fill={SERIES} stroke={SURFACE} strokeWidth="2" />
          </g>
        )}
        <circle cx={x(series.length - 1)} cy={y(last.win_rate)} r="4.5" fill={SERIES} stroke={SURFACE} strokeWidth="2" />
        <text x={x(series.length - 1) + 9} y={y(last.win_rate) + 4} fontSize="12" fontWeight="600" fill={INK}>
          {(last.win_rate * 100).toFixed(0)}%
        </text>
      </svg>
      {tooltip.node}
    </div>
  );
}

export function Columns({ items, format, detail }) {
  const tooltip = useTooltip();
  const W = 680;
  const H = 200;
  const pad = { l: 10, r: 10, t: 22, b: 24 };
  if (!items || !items.length) return null;

  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(...items.map((d) => d.value), 0.0001);
  const band = iw / items.length;
  const bw = Math.min(24, band * 0.6);
  const y = (v) => pad.t + (1 - v / max) * ih;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} onPointerLeave={tooltip.hide}>
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke={BASE} strokeWidth="1" />
        {items.map((d, i) => {
          const cx = pad.l + band * i + band / 2;
          const top = y(d.value);
          return (
            <g
              key={d.label}
              onPointerMove={() =>
                tooltip.show((cx / W) * 100, (top / H) * 100, detail ? detail(d) : format(d.value))
              }
            >
              <rect x={pad.l + band * i} y={pad.t} width={band} height={ih} fill="transparent" />
              <path d={columnPath(cx - bw / 2, top, bw, H - pad.b - top)} fill={SERIES} />
              <text x={cx} y={top - 6} fontSize="11" fill={INK} textAnchor="middle" fontWeight="600">
                {format(d.value)}
              </text>
              <text x={cx} y={H - pad.b + 14} fontSize="10.5" fill={MUTED} textAnchor="middle">
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

export function GroupedColumns({ buckets, seriesA, seriesB, labelA, labelB, xTitle }) {
  const tooltip = useTooltip();
  const W = 680;
  const H = 210;
  const pad = { l: 10, r: 10, t: 18, b: 34 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(...seriesA, ...seriesB, 1);
  const band = iw / buckets.length;
  const bw = Math.min(20, band * 0.32);
  const y = (v) => pad.t + (1 - v / max) * ih;

  return (
    <div>
      <div className="legend">
        <span className="key">
          <span className="swatch" style={{ background: SERIES }} /> {labelA}
        </span>
        <span className="key">
          <span className="swatch" style={{ background: DEEMPH }} /> {labelB}
        </span>
      </div>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} onPointerLeave={tooltip.hide}>
          <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke={BASE} strokeWidth="1" />
          {buckets.map((bucket, i) => {
            const cx = pad.l + band * i + band / 2;
            const ax = cx - bw - 1; /* 2px surface gap between the pair */
            const bx = cx + 1;
            const aTop = y(seriesA[i]);
            const bTop = y(seriesB[i]);
            return (
              <g
                key={bucket}
                onPointerMove={() =>
                  tooltip.show(
                    (cx / W) * 100,
                    (Math.min(aTop, bTop) / H) * 100,
                    `${bucket} left · ${labelA}: ${seriesA[i]} · ${labelB}: ${seriesB[i]}`
                  )
                }
              >
                <rect x={pad.l + band * i} y={pad.t} width={band} height={ih} fill="transparent" />
                {seriesA[i] > 0 && <path d={columnPath(ax, aTop, bw, H - pad.b - aTop)} fill={SERIES} />}
                {seriesB[i] > 0 && <path d={columnPath(bx, bTop, bw, H - pad.b - bTop)} fill={DEEMPH} />}
                {seriesA[i] > 0 && (
                  <text x={ax + bw / 2} y={aTop - 5} fontSize="10" fill={INK} textAnchor="middle">
                    {seriesA[i]}
                  </text>
                )}
                {seriesB[i] > 0 && (
                  <text x={bx + bw / 2} y={bTop - 5} fontSize="10" fill={MUTED} textAnchor="middle">
                    {seriesB[i]}
                  </text>
                )}
                <text x={cx} y={H - pad.b + 15} fontSize="10.5" fill={MUTED} textAnchor="middle">
                  {bucket}
                </text>
              </g>
            );
          })}
          {xTitle && (
            <text x={W / 2} y={H - 4} fontSize="10.5" fill={MUTED} textAnchor="middle">
              {xTitle}
            </text>
          )}
        </svg>
        {tooltip.node}
      </div>
    </div>
  );
}

export function HBars({ items, color = SERIES, max }) {
  const W = 320;
  const rowH = 26;
  const barH = 14;
  const labelW = 108;
  const valueW = 34;
  const H = items.length * rowH + 4;
  const scaleMax = max || Math.max(...items.map((d) => d.value), 1);
  const iw = W - labelW - valueW;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`}>
        {items.map((d, i) => {
          const bw = Math.max(d.value > 0 ? 3 : 0, (d.value / scaleMax) * iw);
          const yTop = i * rowH + (rowH - barH) / 2;
          return (
            <g key={d.label}>
              <text x={labelW - 8} y={yTop + barH - 3} fontSize="11" fill={INK} textAnchor="end">
                {d.label}
              </text>
              {d.value > 0 && <path d={hbarPath(labelW, yTop, bw, barH)} fill={color} />}
              <text x={labelW + bw + 6} y={yTop + barH - 3} fontSize="11" fill={MUTED}>
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function BreakBars({ me, them }) {
  const W = 320;
  const H = 190;
  const pad = { l: 12, r: 12, t: 26, b: 40 };
  const ih = H - pad.t - pad.b;
  const y = (v) => pad.t + (1 - v) * ih;
  const items = [
    { label: "I break", stats: me },
    { label: "They break", stats: them },
  ];
  const band = (W - pad.l - pad.r) / 2;
  const bw = 24;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <line x1={pad.l} x2={W - pad.r} y1={y(0.5)} y2={y(0.5)} stroke={GRID} strokeWidth="1" />
        <text x={W - pad.r} y={y(0.5) - 4} fontSize="9.5" fill={MUTED} textAnchor="end">
          50%
        </text>
        <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke={BASE} strokeWidth="1" />
        {items.map((d, i) => {
          const cx = pad.l + band * i + band / 2;
          const rate = d.stats.win_rate ?? 0;
          const top = y(rate);
          return (
            <g key={d.label}>
              <path d={columnPath(cx - bw / 2, top, bw, y(0) - top)} fill={i === 0 ? SERIES : DEEMPH} />
              <text x={cx} y={top - 7} fontSize="13" fontWeight="650" fill={INK} textAnchor="middle">
                {d.stats.win_rate === null ? "–" : `${(rate * 100).toFixed(1)}%`}
              </text>
              <text x={cx} y={y(0) + 15} fontSize="11" fill={INK} textAnchor="middle">
                {d.label}
              </text>
              <text x={cx} y={y(0) + 29} fontSize="10" fill={MUTED} textAnchor="middle">
                {d.stats.wins}–{d.stats.games - d.stats.wins} of {d.stats.games}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
