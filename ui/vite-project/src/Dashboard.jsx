import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { GameRows, Meter, PillToggle, Section, StatCard, Takeaway, WinLoss } from "./components.jsx";
import { BreakBars, Columns, MarginHistogram, RollingLine, Stack100 } from "./charts.jsx";
import {
  WIN_TYPE_COLORS,
  WIN_TYPE_LABELS,
  WIN_TYPE_ORDER,
  dateLabel,
  pValue,
  pct,
  record,
  signedPts,
} from "./format.js";

function scopeToParam(scope) {
  if (scope.type === "overall") return "overall";
  return `${scope.type}:${scope.key}`;
}

function scopeTitle(scope) {
  if (scope.type === "opponent") return `vs ${scope.key}`;
  if (scope.type === "venue") return scope.key;
  if (scope.type === "year") return scope.key;
  return "All games";
}

const RESULT_TOGGLE = [
  { value: "all", label: "All games" },
  { value: "win", label: "My wins" },
  { value: "loss", label: "My losses" },
];

function formLine(data) {
  const s = data.streaks.current;
  const t = data.trailing;
  const streakBit = s
    ? s.type === "win"
      ? s.length === 1
        ? "I won the last game"
        : `I've won ${s.length} straight`
      : s.length === 1
        ? "I dropped the last game"
        : `I've dropped ${s.length} straight`
    : "";
  const trailingBit = t.games
    ? `Over the last year I'm ${t.wins}–${t.losses} (${pct(t.win_rate, 0)}).`
    : "Nothing recorded in the last year.";
  return `${streakBit}. ${trailingBit} Best run ever: ${data.streaks.longest_win} wins. Worst skid: ${data.streaks.longest_loss}.`;
}

function breakLine(b) {
  if (b.advantage === null) return "Not enough games on one side of the break to say anything yet.";
  const p = pValue(b.p_value);
  const base = `I win ${pct(b.me_breaking.win_rate, 1)} of games when I break and ${pct(
    b.them_breaking.win_rate,
    1
  )} when I don't. The break is worth ${signedPts(b.advantage)} here${p ? ` (${p}, recalculated as games come in)` : ""}.`;
  const n = b.me_breaking.games + b.them_breaking.games;
  return n < 40 ? `${base} Thin sample though, so call it a lean, not a fact.` : base;
}

function winTypesLine(winTypes) {
  const total = (key) => (winTypes.wins[key] || 0) + (winTypes.losses[key] || 0);
  const all = WIN_TYPE_ORDER.reduce((a, k) => a + total(k), 0);
  if (!all) return null;
  const reg = total("regulation");
  const mistakes = total("early_8") + total("scratch_on_8") + total("wrong_pocket");
  return `${pct(reg / all, 0)} of these games ended clean in regulation. ${mistakes} ended on an 8-ball mistake: sinking it early, scratching on it, or calling the wrong pocket.`;
}

function marginsLine(margins) {
  const totals = margins.when_winning.map((v, i) => v + margins.when_losing[i]);
  const all = totals.reduce((a, b) => a + b, 0);
  if (!all) return null;
  const modeIdx = totals.indexOf(Math.max(...totals));
  const closeShare = (totals[0] + totals[1]) / all;
  const o8 = margins.on_the_8;
  const o8Bit = o8.games
    ? ` When both of us were on the 8, I went ${o8.wins}–${o8.losses}.`
    : "";
  return `Most common margin: loser stuck with ${modeIdx === 0 ? "nothing but the 8" : `${modeIdx} left`}. ${pct(
    closeShare,
    0
  )} of games end within one ball.${o8Bit}`;
}

function DetailHeader({ scope, data, navigate }) {
  const r = data.record;
  const types = Object.entries(data.game_types)
    .map(([type, count]) => `${count} ${type}`)
    .join(", ");
  return (
    <section className="panel">
      <button type="button" className="backButton" onClick={() => navigate("#/")}>
        ← All games
      </button>
      <div className="detailHeader">
        <h2>{scopeTitle(scope)}</h2>
        <span className="detailRecord">
          {r.wins}–{r.losses}
        </span>
      </div>
      <div className="detailMeta">
        <span>
          win rate <b>{pct(r.win_rate)}</b>
        </span>
        <span>
          first <b>{dateLabel(r.first_date)}</b>
        </span>
        <span>
          last <b>{dateLabel(r.last_date)}</b>
        </span>
        <span>
          <b>{r.sessions}</b> session{r.sessions === 1 ? "" : "s"}
        </span>
        <span>{types}</span>
      </div>
    </section>
  );
}

/* Session rows with click-to-expand game logs, scoped to the current slice.
   On opponent pages the expansion shows only that opponent's games, with a
   note about how many others happened the same day. */
function SessionLog({ sessions, scope, navigate }) {
  const [open, setOpen] = useState({});
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setOpen({});
    setShowAll(false);
  }, [scope.type, scope.key]);

  const toggle = async (sessionId) => {
    if (open[sessionId]) {
      setOpen((current) => {
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
      return;
    }
    setOpen((current) => ({ ...current, [sessionId]: "loading" }));
    try {
      const detail = await api.sessionDetail(sessionId);
      setOpen((current) => (current[sessionId] ? { ...current, [sessionId]: detail } : current));
    } catch {
      setOpen((current) => {
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
    }
  };

  const visible = showAll ? sessions : sessions.slice(0, 5);

  return (
    <>
      <div className="tableScroller">
        <table>
          <thead>
            <tr>
              <th style={{ width: 24 }} />
              <th>Date</th>
              <th>Venue</th>
              <th>Games</th>
              <th>Record</th>
              <th>Opponents</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => {
              const detail = open[s.session_id];
              let shown = null;
              let hidden = 0;
              if (detail && detail !== "loading") {
                shown =
                  scope.type === "opponent"
                    ? detail.games.filter((g) => g.opponents.includes(scope.key))
                    : detail.games;
                hidden = detail.games.length - shown.length;
              }
              return (
                <React.Fragment key={s.session_id}>
                  <tr className="rowClickable" onClick={() => toggle(s.session_id)}>
                    <td className="muted">{detail ? "▾" : "▸"}</td>
                    <td>{dateLabel(s.date)}</td>
                    <td>{s.venue}</td>
                    <td>{s.games}</td>
                    <td>
                      <WinLoss wins={s.wins} losses={s.losses} />
                    </td>
                    <td>{s.opponents.join(", ")}</td>
                  </tr>
                  {detail && (
                    <tr>
                      <td colSpan={6} style={{ padding: "0 10px 12px 34px" }}>
                        {detail === "loading" ? (
                          <p className="muted" style={{ margin: "8px 0 0" }}>
                            Loading…
                          </p>
                        ) : (
                          <>
                            <GameRows games={shown} />
                            {hidden > 0 && (
                              <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>
                                {hidden} more game{hidden === 1 ? "" : "s"} that day against someone
                                else, in the{" "}
                                <a
                                  href="#/sessions"
                                  style={{ color: "inherit" }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    navigate("#/sessions");
                                  }}
                                >
                                  full log
                                </a>
                                .
                              </p>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {sessions.length > 5 && !showAll && (
        <button type="button" className="backButton" onClick={() => setShowAll(true)}>
          Show all {sessions.length} sessions
        </button>
      )}
    </>
  );
}

function RivalsBoard({ opponents, navigate }) {
  const [sortKey, setSortKey] = useState("games");
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const rows = [...opponents];
    rows.sort((a, b) => {
      const av = a[sortKey] ?? -1;
      const bv = b[sortKey] ?? -1;
      if (av === bv) return b.games - a.games;
      return (av < bv ? -1 : 1) * (asc ? 1 : -1);
    });
    return rows;
  }, [opponents, sortKey, asc]);

  const header = (key, label) => (
    <th>
      <button
        type="button"
        onClick={() => {
          if (sortKey === key) setAsc(!asc);
          else {
            setSortKey(key);
            setAsc(false);
          }
        }}
      >
        {label}
        {sortKey === key ? <span className="sortArrow">{asc ? "▲" : "▼"}</span> : null}
      </button>
    </th>
  );

  return (
    <div className="tableScroller">
      <table>
        <thead>
          <tr>
            <th>Opponent</th>
            {header("games", "Games")}
            <th>Record</th>
            {header("win_rate", "My win rate")}
            {header("first_date", "First played")}
            {header("last_date", "Last played")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((o) => (
            <tr key={o.name} className="rowClickable" onClick={() => navigate(`#/vs/${encodeURIComponent(o.name)}`)}>
              <td>{o.name}</td>
              <td>{o.games}</td>
              <td>
                <WinLoss wins={o.wins} losses={o.losses} />
              </td>
              <td>
                <Meter value={o.win_rate ?? 0} label={pct(o.win_rate, 0)} />
              </td>
              <td className="muted">{dateLabel(o.first_date)}</td>
              <td className="muted">{dateLabel(o.last_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard({ scope, navigate }) {
  const [scopes, setScopes] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [winTypeMode, setWinTypeMode] = useState("all");
  const [marginMode, setMarginMode] = useState("all");

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

  const isOverall = scope.type === "overall";
  const topOpponents = scopes ? scopes.opponents.slice(0, 6) : [];
  const moreOpponents = scopes ? scopes.opponents.slice(6) : [];

  const winTypeItems = useMemo(() => {
    if (!data) return [];
    return WIN_TYPE_ORDER.map((key) => ({
      label: WIN_TYPE_LABELS[key],
      color: WIN_TYPE_COLORS[key],
      value:
        winTypeMode === "win"
          ? data.win_types.wins[key] || 0
          : winTypeMode === "loss"
            ? data.win_types.losses[key] || 0
            : (data.win_types.wins[key] || 0) + (data.win_types.losses[key] || 0),
    }));
  }, [data, winTypeMode]);

  return (
    <div>
      <div className="scopeBar">
        <div className="scopeChips">
          <button type="button" className={`scopeChip ${isOverall ? "on" : ""}`} onClick={() => navigate("#/")}>
            All
          </button>
          {topOpponents.map((o) => (
            <button
              key={o.name}
              type="button"
              className={`scopeChip ${scope.type === "opponent" && scope.key === o.name ? "on" : ""}`}
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
              <option value="">everyone else…</option>
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
              <option value="">by venue…</option>
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
              <option value="">by year…</option>
              {scopes.years.map((y) => (
                <option key={y.year} value={y.year}>
                  {y.year} ({y.games})
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {error && <p className="pageError">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && data.record.games === 0 && <div className="notice">Nothing recorded in this slice yet.</div>}

      {data && data.record.games > 0 && (
        <div style={{ opacity: loading ? 0.55 : 1, transition: "opacity 120ms" }}>
          {!isOverall && <DetailHeader scope={scope} data={data} navigate={navigate} />}

          {isOverall && (
            <blockquote className="doctrine">
              <p>"It's commonly accepted that breaking is an advantage in pool. But is it, in the games I play?"</p>
              <footer>the question that started the notebook, spring 2017</footer>
              <div className="doctrineStamp">
                <span className="verdict verdict-confirmed">Confirmed</span>
                <a className="buttonLink" href="#/story" onClick={(e) => { e.preventDefault(); navigate("#/story"); }}>
                  See the test
                </a>
              </div>
            </blockquote>
          )}

          <Section
            eyebrow="Form"
            title="How I'm playing"
            lede={`Win rate over a rolling ${data.rolling.window}-game window, every game in this slice, oldest to newest.`}
          >
            <RollingLine series={data.rolling.series} windowSize={data.rolling.window} />
            <Takeaway>{formLine(data)}</Takeaway>
          </Section>

          <div className="twoCol">
            <Section eyebrow="The break" title="Is breaking an advantage?">
              <BreakBars me={data.break.me_breaking} them={data.break.them_breaking} />
              <Takeaway>{breakLine(data.break)}</Takeaway>
            </Section>

            <Section
              eyebrow="Endings"
              title="How games end"
              action={<PillToggle options={RESULT_TOGGLE} value={winTypeMode} onChange={setWinTypeMode} />}
            >
              <p className="sectionCopy muted" style={{ fontSize: "0.9rem" }}>
                8-ball games only. Regulation is a clean finish. The rest ended some other way:
                an early 8, a scratch on the 8, a wrong pocket, or the 8 off the break.
              </p>
              <Stack100 items={winTypeItems} />
              {winTypeMode === "all" && winTypesLine(data.win_types) ? (
                <Takeaway>{winTypesLine(data.win_types)}</Takeaway>
              ) : null}
            </Section>
          </div>

          <Section
            eyebrow="Margins"
            title="How close the games are"
            lede="What the loser still had on the table when the game ended. Zero means they were down to the 8."
            action={<PillToggle options={RESULT_TOGGLE} value={marginMode} onChange={setMarginMode} />}
          >
            <MarginHistogram
              whenWinning={data.margins.when_winning}
              whenLosing={data.margins.when_losing}
              mode={marginMode}
            />
            {marginMode === "all" && marginsLine(data.margins) ? (
              <Takeaway>{marginsLine(data.margins)}</Takeaway>
            ) : null}
          </Section>

          {isOverall && scopes && (
            <Section
              eyebrow="Rivals"
              title="Everyone I've played"
              lede="Every opponent in the book. Click a row for the full head-to-head."
            >
              <RivalsBoard opponents={scopes.opponents} navigate={navigate} />
              <Takeaway>
                {(() => {
                  const [a, b] = scopes.opponents;
                  const total = scopes.opponents.reduce((acc, o) => acc + o.games, 0);
                  return `${a.name} and ${b.name} are ${pct((a.games + b.games) / total, 0)} of every game I've recorded. Everyone else is a sample size problem.`;
                })()}
              </Takeaway>
            </Section>
          )}

          {isOverall && scopes && (
            <div className="twoCol">
              <Section eyebrow="Venues" title="Where the games happen">
                <div className="cardGrid">
                  {scopes.venues.slice(0, 6).map((v) => (
                    <div
                      key={v.name}
                      className="miniCard clickable"
                      onClick={() => navigate(`#/at/${encodeURIComponent(v.name)}`)}
                    >
                      <header>
                        <h3>{v.name}</h3>
                        <span className="muted">{v.games}</span>
                      </header>
                      <p>
                        <WinLoss wins={v.wins} losses={v.losses} /> ({pct(v.win_rate, 0)}),{" "}
                        {v.first_date.slice(0, 4)} to {v.last_date.slice(0, 4)}
                      </p>
                    </div>
                  ))}
                </div>
                {scopes.venues.length > 6 ? (
                  <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                    Plus {scopes.venues.length - 6} more in the venue dropdown up top.
                  </p>
                ) : null}
              </Section>

              <Section eyebrow="Seasons" title="Year by year" lede="Click a column to open that year.">
                <Columns
                  items={data.by_year.map((y) => ({
                    label: String(y.year),
                    value: y.win_rate,
                    games: y.games,
                    wins: y.wins,
                  }))}
                  format={(v) => pct(v, 0)}
                  detail={(d) => (
                    <>
                      <strong>{d.label}</strong>: {d.wins}–{d.games - d.wins} over {d.games} games
                    </>
                  )}
                  onPick={(d) => navigate(`#/year/${d.label}`)}
                />
              </Section>
            </div>
          )}

          {!isOverall && data.by_year.length > 1 && (
            <Section eyebrow="Seasons" title="Year by year">
              <Columns
                items={data.by_year.map((y) => ({
                  label: String(y.year),
                  value: y.win_rate,
                  games: y.games,
                  wins: y.wins,
                }))}
                format={(v) => pct(v, 0)}
                detail={(d) => (
                  <>
                    <strong>{d.label}</strong>: {d.wins}–{d.games - d.wins} over {d.games} games
                  </>
                )}
              />
            </Section>
          )}

          {data.cutthroat && (
            <Section
              eyebrow="Cutthroat"
              title="The three-player games"
              lede="Cutthroat is its own animal, so it stays out of the 8-ball numbers above."
            >
              <div className="cardGrid">
                <StatCard label="Record" value={record(data.cutthroat)} detail={`${data.cutthroat.games} games`} />
                <StatCard
                  label="Finishes"
                  value={Object.entries(data.cutthroat.finish_places)
                    .map(([place, count]) => `${count}×${place === "1" ? "1st" : place === "2" ? "2nd" : "3rd"}`)
                    .join("  ")}
                  detail="first place means I won the table"
                />
              </div>
            </Section>
          )}

          <Section
            eyebrow="The log"
            title="Session by session"
            lede="Click a session to unfold the game-by-game."
            action={
              <a className="buttonLink" href="#/sessions" onClick={(e) => { e.preventDefault(); navigate("#/sessions"); }}>
                Searchable log
              </a>
            }
          >
            <SessionLog sessions={data.sessions} scope={scope} navigate={navigate} />
          </Section>

          {isOverall && (
            <div className="methodNote">
              <b>Where this data comes from.</b> Every game here was written down by hand after
              playing, into a spreadsheet I kept from April 2017 through the end of 2025, and now
              through this site. During the import I found ten rows from fall 2017 where I'd
              entered the two balls-left columns backwards; those are corrected, and each one says
              so in its notes. Two games are recorded in a way that can't be right, and I left
              them as they are rather than guess. Numbers I couldn't trust stay out of the math.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
