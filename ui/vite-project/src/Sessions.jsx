import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { Section, WinLoss } from "./components.jsx";
import { dateLabel } from "./format.js";

export default function Sessions({ navigate }) {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api
      .sessions()
      .then((payload) => setSessions(payload.sessions))
      .catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!sessions) return [];
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) => s.venue.includes(q) || s.opponents.some((o) => o.includes(q)) || s.date.includes(q)
    );
  }, [sessions, query]);

  if (error) return <p className="pageError">{error}</p>;
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
      title="Every session"
      lede={`A session is one day of pool at one table. ${sessions.length} of them so far, newest first.`}
    >
      <input
        type="text"
        className="tableSearch"
        placeholder="Filter by venue, opponent, or date…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="tableScroller">
        <table>
          <thead>
            <tr>
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
                  <td colSpan={5}>{row.divider}</td>
                </tr>
              ) : (
                <tr key={row.key}>
                  <td>{dateLabel(row.session.date)}</td>
                  <td>
                    <a
                      href={`#/at/${encodeURIComponent(row.session.venue)}`}
                      style={{ color: "inherit" }}
                      onClick={(e) => {
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
              )
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
