import React, { useEffect, useState } from "react";
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

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (hash) => {
    window.location.hash = hash;
  };

  const navLink = (hash, label, active) => (
    <a
      href={hash}
      className={active ? "active" : ""}
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
      <div className="topbar">
        <a href="#/" className="wordmark" onClick={(e) => { e.preventDefault(); navigate("#/"); }}>
          Pool Tracker<span>every game since 2017</span>
        </a>
        <nav className="nav">
          {navLink("#/", "Dashboard", route.page === "dashboard")}
          {navLink("#/sessions", "Sessions", route.page === "sessions")}
          {navLink("#/story", "Story", route.page === "story")}
          {navLink("#/record", "Record", route.page === "record")}
        </nav>
      </div>

      {route.page === "dashboard" && <Dashboard scope={route.scope} navigate={navigate} />}
      {route.page === "sessions" && <Sessions navigate={navigate} />}
      {route.page === "story" && <Story />}
      {route.page === "record" && <Record />}

      <p className="footer">
        Recorded by hand since April 2017 · imported from the original spreadsheet ·{" "}
        <a href="#/story" onClick={(e) => { e.preventDefault(); navigate("#/story"); }}>
          the story
        </a>
      </p>
    </div>
  );
}
