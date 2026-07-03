import React, { useEffect, useState } from "react";
import { api, pct, signedPts } from "./api.js";
import { BreakBars, Columns, GroupedColumns, HBars, RollingLine } from "./charts.jsx";

const WIN_TYPE_LABELS = {
  regulation: "regulation",
  early_8: "early 8",
  scratch_on_8: "scratch on 8",
  wrong_pocket: "wrong pocket",
  win_on_break: "win on break",
};

function scopeToParam(scope) {
  if (scope.type === "overall") return "overall";
  return `${scope.type}:${scope.key}`;
}

function scopeLabel(scope) {
  if (scope.type === "overall") return "All games";
  if (scope.type === "opponent") return `vs ${scope.key}`;
  if (scope.type === "venue") return `at ${scope.key}`;
  return scope.key;
}

function Tile({ label, value, detail }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {detail && <div className="detail">{detail}</div>}
    </div>
  );
}

export default function Dashboard({ scope, navigate }) {
  const [scopes, setScopes] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.scopes().then(setScopes).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .dashboard(scopeToParam(scope))
      .then((payload) => {
        setData(payload);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [scope.type, scope.key]);

  const topOpponents = scopes ? scopes.opponents.slice(0, 6) : [];
  const moreOpponents = scopes ? scopes.opponents.slice(6) : [];

  return (
    <div>
      <div className="scopebar">
        <div className="chips">
          <button
            className={`chip ${scope.type === "overall" ? "active" : ""}`}
            onClick={() => navigate("#/")}
          >
            All
          </button>
          {topOpponents.map((o) => (
            <button
              key={o.name}
              className={`chip ${scope.type === "opponent" && scope.key === o.name ? "active" : ""}`}
              onClick={() => navigate(`#/vs/${encodeURIComponent(o.name)}`)}
            >
              {o.name}
            </button>
          ))}
        </div>
        {scopes && (
          <>
            <select
              value={scope.type === "opponent" && moreOpponents.some((o) => o.name === scope.key) ? scope.key : ""}
              onChange={(e) => e.target.value && navigate(`#/vs/${encodeURIComponent(e.target.value)}`)}
            >
              <option value="">more opponents…</option>
              {moreOpponents.map((o) => (
                <option key={o.name} value={o.name}>
                  {o.name} ({o.games})
                </option>
              ))}
            </select>
            <select
              value={scope.type === "venue" ? scope.key : ""}
              onChange={(e) => e.target.value && navigate(`#/at/${encodeURIComponent(e.target.value)}`)}
            >
              <option value="">venue…</option>
              {scopes.venues.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.games})
                </option>
              ))}
            </select>
            <select
              value={scope.type === "year" ? scope.key : ""}
              onChange={(e) => e.target.value && navigate(`#/year/${e.target.value}`)}
            >
              <option value="">year…</option>
              {scopes.years.map((y) => (
                <option key={y.year} value={y.year}>
                  {y.year} ({y.games})
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="sub">Loading…</p>}

      {data && data.record.games === 0 && <div className="notice">No games in this scope yet.</div>}

      {data && data.record.games > 0 && (
        <div className="grid" style={{ opacity: loading ? 0.55 : 1, transition: "opacity 120ms" }}>
          <div className="card wide">
            <h3>{scopeLabel(scope)}</h3>
            <p className="sub">
              {data.record.first_date} → {data.record.last_date} · {data.record.sessions} session
              {data.record.sessions === 1 ? "" : "s"}
              {" · "}
              {Object.entries(data.game_types)
                .map(([type, count]) => `${count} ${type}`)
                .join(" · ")}
            </p>
            <div className="hero">
              <div className="big">
                {data.record.wins}–{data.record.losses}
                <small>{pct(data.record.win_rate)} win rate</small>
              </div>
            </div>
            <div className="tiles">
              <Tile
                label={`Last ${data.trailing.days} days`}
                value={
                  data.trailing.games
                    ? `${data.trailing.wins}–${data.trailing.losses}`
                    : "no games"
                }
                detail={data.trailing.games ? pct(data.trailing.win_rate) : `since ${data.trailing.since}`}
              />
              <Tile
                label="Current streak"
                value={
                  data.streaks.current ? (
                    <span className={data.streaks.current.type === "win" ? "up" : "down"}>
                      {data.streaks.current.type === "win" ? "W" : "L"}
                      {data.streaks.current.length}
                    </span>
                  ) : (
                    "–"
                  )
                }
                detail={`best W${data.streaks.longest_win} · worst L${data.streaks.longest_loss}`}
              />
              <Tile
                label="Both on the 8"
                value={`${data.margins.on_the_8.wins}–${data.margins.on_the_8.losses}`}
                detail={`${pct(data.margins.on_the_8.win_rate)} in hill–hill games`}
              />
              <Tile
                label="Break advantage"
                value={signedPts(data.break.advantage)}
                detail="breaking vs receiving"
              />
            </div>
          </div>

          <div className="card wide">
            <h3>Rolling form</h3>
            <p className="sub">{data.rolling.window}-game rolling win rate, oldest to newest</p>
            <RollingLine series={data.rolling.series} windowSize={data.rolling.window} />
          </div>

          <div className="card">
            <h3>Is breaking an advantage?</h3>
            <p className="sub">Win rate by who breaks (8-ball games)</p>
            <BreakBars me={data.break.me_breaking} them={data.break.them_breaking} />
          </div>

          <div className="card">
            <h3>How games end</h3>
            <p className="sub">Win type in my wins vs my losses</p>
            <div className="legend">
              <span className="key">
                <span className="swatch" style={{ background: "var(--series-1)" }} /> in wins
              </span>
              <span className="key">
                <span className="swatch" style={{ background: "var(--deemph)" }} /> in losses
              </span>
            </div>
            {(() => {
              const order = ["regulation", "early_8", "scratch_on_8", "wrong_pocket", "win_on_break"];
              const present = order.filter(
                (t) => (data.win_types.wins[t] || 0) + (data.win_types.losses[t] || 0) > 0
              );
              const max = Math.max(
                ...present.map((t) => Math.max(data.win_types.wins[t] || 0, data.win_types.losses[t] || 0)),
                1
              );
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <HBars
                    items={present.map((t) => ({ label: WIN_TYPE_LABELS[t], value: data.win_types.wins[t] || 0 }))}
                    max={max}
                  />
                  <HBars
                    items={present.map((t) => ({ label: WIN_TYPE_LABELS[t], value: data.win_types.losses[t] || 0 }))}
                    color="var(--deemph)"
                    max={max}
                  />
                </div>
              );
            })()}
          </div>

          <div className="card wide">
            <h3>Margin of victory</h3>
            <p className="sub">Loser's balls still on the table when the game ended</p>
            <GroupedColumns
              buckets={[0, 1, 2, 3, 4, 5, 6, 7]}
              seriesA={data.margins.when_winning}
              seriesB={data.margins.when_losing}
              labelA="when I win (their balls left)"
              labelB="when I lose (my balls left)"
              xTitle="balls left"
            />
          </div>

          {data.by_year.length > 1 && (
            <div className="card wide">
              <h3>Year by year</h3>
              <p className="sub">Win rate per year — hover for volume</p>
              <Columns
                items={data.by_year.map((y) => ({
                  label: String(y.year),
                  value: y.win_rate,
                  games: y.games,
                  wins: y.wins,
                }))}
                format={(v) => `${(v * 100).toFixed(0)}%`}
                detail={(d) => `${d.label}: ${d.wins}–${d.games - d.wins} over ${d.games} games`}
              />
            </div>
          )}

          {data.cutthroat && (
            <div className="card">
              <h3>Cutthroat</h3>
              <p className="sub">Three-player games, tracked separately</p>
              <div className="tiles">
                <Tile label="Record" value={`${data.cutthroat.wins}–${data.cutthroat.losses}`} detail={`${data.cutthroat.games} games`} />
                <Tile
                  label="Finishes"
                  value={Object.entries(data.cutthroat.finish_places)
                    .map(([place, count]) => `${count}× ${place === "1" ? "1st" : place === "2" ? "2nd" : "3rd"}`)
                    .join(" · ") || "–"}
                />
              </div>
            </div>
          )}

          <div className={`card ${data.cutthroat ? "" : "wide"}`}>
            <h3>Recent sessions</h3>
            <p className="sub">Latest days of play in this scope</p>
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Venue</th>
                  <th>Record</th>
                  <th>Opponents</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_sessions.map((s) => (
                  <tr key={s.session_id}>
                    <td>{s.date}</td>
                    <td>{s.venue}</td>
                    <td className={s.wins >= s.losses ? "wl-win" : "wl-loss"}>
                      {s.wins}–{s.losses}
                    </td>
                    <td>{s.opponents.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
