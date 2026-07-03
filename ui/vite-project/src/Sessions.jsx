import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { GameRows, Section, WinLoss } from "./components.jsx";
import { dateLabel } from "./format.js";

export default function Sessions({ navigate }) {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState({});

  useEffect(() => {
    api
      .sessions()
      .then((payload) => setSessions(payload.sessions))
      .catch((e) => setError(e.message));
  }, []);

  const toggle = async (sessionId) => {
    setOpen((current) => {
      if (current[sessionId]) {
        const next = { ...current };
        delete next[sessionId];
        return next;
      }
      return { ...current, [sessionId]: current[sessionId] || "loading" };
    });
    if (!open[sessionId]) {
      try {
        const detail = await api.sessionDetail(sessionId);
        setOpen((current) => (current[sessionId] ? { ...current, [sessionId]: detail } : current));
      } catch (e) {
        setOpen((current) => {
          const next = { ...current };
          delete next[sessionId];
          return next;
        });
        setError(e.message);
      }
    }
  };

  const filtered = useMemo(() => {
    if (!sessions) return [];
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) => s.venue.includes(q) || s.opponents.some((o) => o.includes(q)) || s.date.includes(q)
    );
  }, [sessions, query]);

  if (error && !sessions) return <p className="pageError">{error}</p>;
  if (!sessions) return <p className="muted">Loading…</p>;

  const rows = [];
  let lastYear = null;
  for (const s of filtered) {
    const year = s.date.slice(0, 4);
    if (year !== lastYear) {
      rows.push({ divider: year, key: `y-${year}` });
      lastYear = year;
    }
    rows.push({ session: s, key: s.session_id });
  }

  return (
    <Section
      eyebrow="The log"
      title="Every session, every game"
      lede={`A session is one day of pool at one table. ${sessions.length} of them so far, newest first. Click a session to unfold the games inside it.`}
    >
      <input
        type="text"
        className="tableSearch"
        placeholder="Filter by venue, opponent, or date…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
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
            {rows.map((row) =>
              row.divider ? (
                <tr key={row.key} className="yearDivider">
                  <td colSpan={6}>{row.divider}</td>
                </tr>
              ) : (
                <React.Fragment key={row.key}>
                  <tr className="rowClickable" onClick={() => toggle(row.session.session_id)}>
                    <td className="muted">{open[row.session.session_id] ? "▾" : "▸"}</td>
                    <td>{dateLabel(row.session.date)}</td>
                    <td>
                      <a
                        href={`#/at/${encodeURIComponent(row.session.venue)}`}
                        style={{ color: "inherit" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          navigate(`#/at/${encodeURIComponent(row.session.venue)}`);
                        }}
                      >
                        {row.session.venue}
                      </a>
                    </td>
                    <td>{row.session.games}</td>
                    <td>
                      <WinLoss wins={row.session.wins} losses={row.session.losses} />
                    </td>
                    <td>
                      {row.session.opponents.map((name, i) => (
                        <React.Fragment key={name}>
                          {i > 0 && ", "}
                          <a
                            href={`#/vs/${encodeURIComponent(name)}`}
                            style={{ color: "inherit" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              navigate(`#/vs/${encodeURIComponent(name)}`);
                            }}
                          >
                            {name}
                          </a>
                        </React.Fragment>
                      ))}
                    </td>
                  </tr>
                  {open[row.session.session_id] && (
                    <tr>
                      <td colSpan={6} style={{ padding: "0 10px 12px 34px" }}>
                        {open[row.session.session_id] === "loading" ? (
                          <p className="muted" style={{ margin: "8px 0 0" }}>
                            Loading…
                          </p>
                        ) : (
                          <GameRows games={open[row.session.session_id].games} />
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
