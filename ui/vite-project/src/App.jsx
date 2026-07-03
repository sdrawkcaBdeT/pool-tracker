import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import { StatCard } from "./components.jsx";
import { pct, signedPts } from "./format.js";
import Dashboard from "./Dashboard.jsx";
import Record from "./Record.jsx";
import Sessions from "./Sessions.jsx";
import Story from "./Story.jsx";

function parseHash(hash) {
  const clean = decodeURIComponent(hash.replace(/^#\/?/, ""));
  if (clean.startsWith("vs/")) return { page: "dashboard", scope: { type: "opponent", key: clean.slice(3) } };
  if (clean.startsWith("at/")) return { page: "dashboard", scope: { type: "venue", key: clean.slice(3) } };
  if (clean.startsWith("year/")) return { page: "dashboard", scope: { type: "year", key: clean.slice(5) } };
  if (clean === "sessions") return { page: "sessions" };
  if (clean === "story") return { page: "story" };
  if (clean === "record") return { page: "record" };
  return { page: "dashboard", scope: { type: "overall", key: null } };
}

export default function App() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  const [overall, setOverall] = useState(null);

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    api.dashboard("overall").then(setOverall).catch(() => {});
  }, []);

  const navigate = (hash) => {
    window.location.hash = hash;
  };

  const tab = (hash, label, active) => (
    <a
      href={hash}
      className={active ? "tabActive" : ""}
      onClick={(e) => {
        e.preventDefault();
        navigate(hash);
      }}
    >
      {label}
    </a>
  );

  return (
    <div className="shell">
      <header className="masthead">
        <p className="mastheadEyebrow">Selected games since April 2017</p>
        <h1>
          Pool <span className="chalkWord">Tracker</span>
        </h1>
        <p className="mastheadSub">
          I started writing games down at a bar in 2017 because I wanted to know: is breaking
          actually an advantage?
        </p>
      </header>

      {overall && (
        <div className="statGrid">
          <StatCard
            label="The record"
            value={`${overall.record.wins}–${overall.record.losses}`}
            detail={`${overall.record.games} games, ${overall.record.first_date.slice(0, 4)} to ${overall.record.last_date.slice(0, 4)}`}
          />
          <StatCard label="Win rate" value={pct(overall.record.win_rate)} detail="every game in the book" />
          <StatCard
            label="Break advantage"
            value={signedPts(overall.break.advantage)}
            detail={`${pct(overall.break.me_breaking.win_rate)} breaking, ${pct(overall.break.them_breaking.win_rate)} not`}
          />
          <StatCard
            label="Sessions"
            value={overall.record.sessions}
            detail="a session is one day at one table"
          />
        </div>
      )}

      <nav className="tabBar">
        {tab("#/", "The Ledger", route.page === "dashboard")}
        {tab("#/sessions", "Sessions", route.page === "sessions")}
        {tab("#/story", "The Story", route.page === "story")}
        {tab("#/record", "Record", route.page === "record")}
      </nav>

      {route.page === "dashboard" && <Dashboard scope={route.scope} navigate={navigate} />}
      {route.page === "sessions" && <Sessions navigate={navigate} />}
      {route.page === "story" && <Story />}
      {route.page === "record" && <Record />}

      <footer className="siteFooter">
        Kept by hand since April 2017. Nine years of bar tables, basements, lake houses, and pool
        halls. <a href="#/story" onClick={(e) => { e.preventDefault(); navigate("#/story"); }}>Read how it started</a>.
      </footer>
    </div>
  );
}
