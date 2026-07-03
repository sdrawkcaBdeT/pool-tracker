import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

const WIN_TYPES = [
  ["regulation", "regulation"],
  ["early_8", "early 8"],
  ["scratch_on_8", "scratch on 8"],
  ["wrong_pocket", "wrong pocket"],
  ["win_on_break", "win on break"],
];

const todayISO = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

function ChipRow({ options, selected, onToggle, allowNew, newPlaceholder }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="chips">
      {options.map((name) => (
        <button
          key={name}
          type="button"
          className={`chip ${selected.includes(name) ? "active" : ""}`}
          onClick={() => onToggle(name)}
        >
          {name}
        </button>
      ))}
      {allowNew && (
        <input
          type="text"
          placeholder={newPlaceholder || "add…"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              onToggle(draft.trim().toLowerCase());
              setDraft("");
            }
          }}
          style={{ width: 110, padding: "6px 10px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit" }}
        />
      )}
    </div>
  );
}

function BallRow({ value, onChange }) {
  return (
    <div className="ballrow">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
        <button
          key={n}
          type="button"
          className={`ball ${value === n ? "selected" : ""}`}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function Record() {
  const [mode, setMode] = useState("loading");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [roster, setRoster] = useState(null);

  const [sessionDate, setSessionDate] = useState(todayISO());
  const [sessionVenue, setSessionVenue] = useState("");
  const [session, setSession] = useState(null);
  const [games, setGames] = useState([]);

  const [gameType, setGameType] = useState("singles");
  const [opponents, setOpponents] = useState([]);
  const [teammate, setTeammate] = useState(null);
  const [result, setResult] = useState(null);
  const [winType, setWinType] = useState("regulation");
  const [loserBalls, setLoserBalls] = useState(null);
  const [winnerBalls, setWinnerBalls] = useState(0);
  const [breaker, setBreaker] = useState(null);
  const [ctWinner, setCtWinner] = useState(null);
  const [ctFirstOut, setCtFirstOut] = useState(null);
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const me = roster?.me || "ted";

  useEffect(() => {
    api
      .me()
      .then((r) => setMode(r.mode))
      .catch(() => setMode("observer"));
  }, []);

  useEffect(() => {
    if (mode !== "owner") return;
    api
      .roster()
      .then((r) => {
        setRoster(r);
        if (r.last_session) setSessionVenue(r.last_session.venue);
      })
      .catch((e) => setError(e.message));
  }, [mode]);

  const login = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.login(pin);
      setMode("owner");
      setPin("");
    } catch (err) {
      setError(err.status === 401 ? "Wrong PIN." : err.message);
    }
  };

  const startSession = async () => {
    setError(null);
    try {
      const created = await api.createSession({ date: sessionDate, venue: sessionVenue });
      setSession(created);
      const detail = await api.sessionGames(created.id);
      setGames(detail.games);
      if (detail.games.length) {
        const lastGame = detail.games[detail.games.length - 1];
        setOpponents(lastGame.opponents);
        setGameType(lastGame.game_type);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const opponentLimit = gameType === "singles" ? 1 : 2;
  const toggleOpponent = (name) => {
    if (name === me) return;
    setOpponents((current) => {
      if (current.includes(name)) return current.filter((n) => n !== name);
      const next = [...current, name];
      return next.slice(-opponentLimit);
    });
  };

  const lastGame = games.length ? games[games.length - 1] : null;
  const suggestedBreaker = useMemo(() => {
    if (!lastGame) return me;
    if (lastGame.game_type === "cutthroat") {
      const places = lastGame.finish_places || {};
      const first = Object.keys(places).find((k) => places[k] === 1);
      return first || me;
    }
    return lastGame.result === "win" ? me : lastGame.opponents[0];
  }, [games]);

  const breakerOptions = [me, ...opponents, ...(teammate ? [teammate] : [])];
  const activeBreaker = breaker && breakerOptions.includes(breaker) ? breaker : suggestedBreaker;

  const cutthroatPeople = [me, ...opponents];
  const effectiveResult = gameType === "cutthroat" ? (ctWinner === me ? "win" : ctWinner ? "loss" : null) : result;

  const canSave =
    session &&
    opponents.length === opponentLimit &&
    (gameType === "cutthroat"
      ? ctWinner && ctFirstOut && ctWinner !== ctFirstOut
      : effectiveResult && winType && loserBalls !== null) &&
    !saving;

  const resetGameForm = () => {
    setResult(null);
    setWinType("regulation");
    setLoserBalls(null);
    setWinnerBalls(0);
    setBreaker(null);
    setCtWinner(null);
    setCtFirstOut(null);
    setNotes("");
    setEditingId(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      session_id: session.id,
      game_type: gameType,
      result: effectiveResult,
      win_type: gameType === "cutthroat" ? null : winType,
      breaker: activeBreaker,
      loser_balls_left: gameType === "cutthroat" ? null : loserBalls,
      winner_balls_left: gameType === "cutthroat" ? null : winType === "regulation" ? 0 : winnerBalls,
      opponents,
      teammates: gameType === "doubles" && teammate ? [teammate] : [],
      finish_places:
        gameType === "cutthroat"
          ? Object.fromEntries(
              cutthroatPeople.map((name) => [
                name,
                name === ctWinner ? 1 : name === ctFirstOut ? 3 : 2,
              ])
            )
          : {},
      notes,
      entry_mode: session.date === todayISO() ? "live" : "post_game",
    };
    try {
      if (editingId) {
        const updated = await api.updateGame(editingId, payload);
        setGames((current) => current.map((g) => (g.id === updated.id ? updated : g)));
      } else {
        const created = await api.createGame(payload);
        setGames((current) => [...current, created]);
      }
      resetGameForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const editGame = (game) => {
    setEditingId(game.id);
    setGameType(game.game_type);
    setOpponents(game.opponents);
    setTeammate(game.teammates[0] || null);
    setResult(game.result);
    setWinType(game.win_type || "regulation");
    setLoserBalls(game.loser_balls_left);
    setWinnerBalls(game.winner_balls_left ?? 0);
    setBreaker(game.breaker);
    setNotes(game.notes || "");
    if (game.game_type === "cutthroat") {
      const places = game.finish_places || {};
      setCtWinner(Object.keys(places).find((k) => places[k] === 1) || null);
      setCtFirstOut(Object.keys(places).find((k) => places[k] === 3) || null);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeGame = async (game) => {
    if (!window.confirm(`Delete game ${game.seq}?`)) return;
    try {
      await api.deleteGame(game.id);
      setGames((current) => current.filter((g) => g.id !== game.id));
      if (editingId === game.id) resetGameForm();
    } catch (err) {
      setError(err.message);
    }
  };

  if (mode === "loading") return <p className="sub">Loading…</p>;

  if (mode === "observer") {
    return (
      <div className="record">
        <div className="card" style={{ marginTop: 10 }}>
          <h3>Owner login</h3>
          <p className="sub">Recording is owner-only. Viewing everything else needs no login.</p>
          <form onSubmit={login}>
            <div className="field">
              <label>PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
              />
            </div>
            {error && <p className="error">{error}</p>}
            <button className="savebtn" type="submit" disabled={!pin}>
              Log in
            </button>
          </form>
        </div>
      </div>
    );
  }

  const playerNames = roster ? roster.players.map((p) => p.name) : [];
  const venueNames = roster ? roster.venues.map((v) => v.name) : [];
  const tally = games.reduce(
    (acc, g) => {
      acc[g.result === "win" ? 0 : 1] += 1;
      return acc;
    },
    [0, 0]
  );

  return (
    <div className="record">
      {!session && (
        <div className="card" style={{ marginTop: 10 }}>
          <h3>Start a session</h3>
          <p className="sub">A session is one day of play at one venue.</p>
          <div className="field">
            <label>Date</label>
            <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Venue</label>
            <ChipRow
              options={venueNames.slice(0, 6)}
              selected={sessionVenue ? [sessionVenue] : []}
              onToggle={(name) => setSessionVenue(name)}
              allowNew
              newPlaceholder="new venue…"
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button className="savebtn" onClick={startSession} disabled={!sessionVenue || !sessionDate}>
            Start session
          </button>
        </div>
      )}

      {session && (
        <>
          <div className="card" style={{ marginTop: 10 }}>
            <h3>
              {session.date} · {session.venue}
            </h3>
            <p className="sub">
              Session so far: {tally[0]}–{tally[1]}
              {" · "}
              <a
                href="#/record"
                onClick={(e) => {
                  e.preventDefault();
                  setSession(null);
                  setGames([]);
                  resetGameForm();
                }}
              >
                switch session
              </a>
            </p>

            <div className="field">
              <label>Game type</label>
              <ChipRow
                options={["singles", "doubles", "cutthroat"]}
                selected={[gameType]}
                onToggle={(t) => {
                  setGameType(t);
                  setOpponents((current) => current.slice(0, t === "singles" ? 1 : 2));
                  setTeammate(null);
                  setCtWinner(null);
                  setCtFirstOut(null);
                }}
              />
            </div>

            <div className="field">
              <label>
                Opponent{opponentLimit > 1 ? "s" : ""} ({opponents.length}/{opponentLimit})
              </label>
              <ChipRow
                options={[...new Set([...playerNames.slice(0, 10), ...opponents])]}
                selected={opponents}
                onToggle={toggleOpponent}
                allowNew
                newPlaceholder="new player…"
              />
            </div>

            {gameType === "doubles" && (
              <div className="field">
                <label>My teammate</label>
                <ChipRow
                  options={[...new Set([...playerNames.filter((n) => !opponents.includes(n)).slice(0, 8), ...(teammate ? [teammate] : [])])]}
                  selected={teammate ? [teammate] : []}
                  onToggle={(name) => setTeammate((current) => (current === name ? null : name))}
                  allowNew
                  newPlaceholder="new player…"
                />
              </div>
            )}

            {gameType !== "cutthroat" && (
              <>
                <div className="field">
                  <label>Result</label>
                  <div className="bigbtns">
                    <button
                      type="button"
                      className={`bigbtn win ${result === "win" ? "selected" : ""}`}
                      onClick={() => setResult("win")}
                    >
                      W
                    </button>
                    <button
                      type="button"
                      className={`bigbtn loss ${result === "loss" ? "selected" : ""}`}
                      onClick={() => setResult("loss")}
                    >
                      L
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label>Win type</label>
                  <ChipRow
                    options={WIN_TYPES.map(([value]) => value)}
                    selected={[winType]}
                    onToggle={(t) => setWinType(t)}
                  />
                </div>

                <div className="field">
                  <label>
                    Loser's balls left{" "}
                    {result ? `(${result === "win" ? opponents.join("/") || "them" : "me"})` : ""}
                  </label>
                  <BallRow value={loserBalls} onChange={setLoserBalls} />
                </div>

                {winType !== "regulation" && (
                  <div className="field">
                    <label>Winner's balls left</label>
                    <BallRow value={winnerBalls} onChange={setWinnerBalls} />
                  </div>
                )}
              </>
            )}

            {gameType === "cutthroat" && opponents.length === 2 && (
              <>
                <div className="field">
                  <label>Who won?</label>
                  <ChipRow
                    options={cutthroatPeople}
                    selected={ctWinner ? [ctWinner] : []}
                    onToggle={(name) => setCtWinner((current) => (current === name ? null : name))}
                  />
                </div>
                <div className="field">
                  <label>Who was out first?</label>
                  <ChipRow
                    options={cutthroatPeople.filter((n) => n !== ctWinner)}
                    selected={ctFirstOut ? [ctFirstOut] : []}
                    onToggle={(name) => setCtFirstOut((current) => (current === name ? null : name))}
                  />
                </div>
              </>
            )}

            <div className="field">
              <label>Breaker (prefilled: last winner)</label>
              <ChipRow
                options={breakerOptions}
                selected={[activeBreaker]}
                onToggle={(name) => setBreaker(name)}
              />
            </div>

            <div className="field">
              <label>Note (optional)</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {error && <p className="error">{error}</p>}
            <button className="savebtn" onClick={save} disabled={!canSave}>
              {editingId ? `Update game` : "Save game"}
            </button>
            {editingId && (
              <p className="sub" style={{ marginTop: 8 }}>
                editing game {games.find((g) => g.id === editingId)?.seq} ·{" "}
                <a
                  href="#/record"
                  onClick={(e) => {
                    e.preventDefault();
                    resetGameForm();
                  }}
                >
                  cancel
                </a>
              </p>
            )}
          </div>

          <div className="card gamelist" style={{ marginTop: 14 }}>
            <h3>This session</h3>
            {!games.length && <p className="sub">No games yet.</p>}
            {[...games].reverse().map((g) => (
              <div className="gamerow" key={g.id}>
                <span className={g.result === "win" ? "wl-win" : "wl-loss"}>
                  {g.result === "win" ? "W" : "L"}
                </span>
                <span>
                  #{g.seq} vs {g.opponents.join(", ")}
                </span>
                <span className="meta">
                  {g.game_type === "cutthroat"
                    ? "cutthroat"
                    : `${(g.win_type || "").replace(/_/g, " ")} · loser had ${g.loser_balls_left ?? "?"} · ${g.breaker} broke`}
                </span>
                <span style={{ marginLeft: "auto" }}>
                  <button onClick={() => editGame(g)}>edit</button>
                  <button onClick={() => removeGame(g)}>delete</button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="footer">
        <a
          href="#/"
          onClick={async (e) => {
            e.preventDefault();
            await api.logout();
            setMode("observer");
          }}
        >
          Log out
        </a>
      </p>
    </div>
  );
}
