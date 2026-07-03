import React, { useEffect, useState } from "react";
import { api } from "./api.js";

export default function Sessions({ navigate }) {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .sessions()
      .then((payload) => setSessions(payload.sessions))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!sessions) return <p className="sub">Loading…</p>;

  return (
    <div className="card" style={{ marginTop: 10 }}>
      <h3>Session log</h3>
      <p className="sub">
        Every day of recorded pool, newest first — {sessions.length} sessions
      </p>
      <table className="data">
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
          {sessions.map((s) => (
            <tr key={s.session_id}>
              <td>{s.date}</td>
              <td>
                <a
                  href={`#/at/${encodeURIComponent(s.venue)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`#/at/${encodeURIComponent(s.venue)}`);
                  }}
                >
                  {s.venue}
                </a>
              </td>
              <td>{s.games}</td>
              <td className={s.wins >= s.losses ? "wl-win" : "wl-loss"}>
                {s.wins}–{s.losses}
              </td>
              <td>
                {s.opponents.map((name, i) => (
                  <React.Fragment key={name}>
                    {i > 0 && ", "}
                    <a
                      href={`#/vs/${encodeURIComponent(name)}`}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
