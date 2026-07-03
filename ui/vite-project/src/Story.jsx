import React, { useEffect, useState } from "react";
import { api, pct } from "./api.js";
import { Columns, GroupedColumns } from "./charts.jsx";

function ThenNow({ then, now, format }) {
  return (
    <div className="thennow">
      <div className="cell">
        <div className="when">then — April 2018</div>
        <div className="num">{format(then)}</div>
        <div className="ctx">{then.ctx}</div>
      </div>
      <div className="cell">
        <div className="when">now</div>
        <div className="num">{format(now)}</div>
        <div className="ctx">{now.ctx}</div>
      </div>
    </div>
  );
}

export default function Story() {
  const [story, setStory] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.story().then(setStory).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!story) return <p className="sub">Loading…</p>;

  const vsDad = story.vs_dad;
  const breakThen = story.break_at_report;
  const breakNow = story.break_now;

  return (
    <div className="story">
      <div className="card" style={{ marginTop: 10 }}>
        <h3>Where this started</h3>
        <p>
          Spring 2017, junior year of college. My dad worked on one side of where I lived and
          lived on the other, so when he passed through we'd meet at a bar with pool tables —
          a late lunch, a couple games. That's when I started playing regularly, and the
          data itch kicked in with one question: <em>everyone says breaking is an advantage
          in pool — but is it, in the games I play?</em> A logistic regression only needs two
          columns: who broke, and who won. So I started writing them down. It expanded from
          there — location, win type, balls left on the table — 610 games and counting.
        </p>
        <p>
          A year in, I compiled the first analysis: a Tableau breakdown of every game against
          my dad. It's early work and it shows — but it asked real questions and made real
          predictions, and eight more years of data can now grade them.
        </p>
        <a className="pdfbtn" href="/api/report.pdf" target="_blank" rel="noreferrer">
          Read the 2018 report (PDF)
        </a>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3>Vs dad</h3>
        <p className="sub">
          The report's headline: dad led the series. {vsDad.since_report.games} games later,
          the series flipped — since the report I'm{" "}
          {vsDad.since_report.wins}–{vsDad.since_report.losses} (
          {pct(vsDad.since_report.win_rate)}).
        </p>
        <ThenNow
          then={{ ...vsDad.at_report, ctx: `${vsDad.at_report.wins}–${vsDad.at_report.losses} over ${vsDad.at_report.games} games` }}
          now={{ ...vsDad.now, ctx: `${vsDad.now.wins}–${vsDad.now.losses} over ${vsDad.now.games} games` }}
          format={(r) => pct(r.win_rate)}
        />
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3>The genesis question: is breaking an advantage?</h3>
        <p className="sub">
          Verdict, {breakNow.me_breaking.games + breakNow.them_breaking.games} games in: yes.
        </p>
        <ThenNow
          then={{
            win_rate: breakThen.advantage,
            ctx: `breaking ${pct(breakThen.me_breaking.win_rate)} vs receiving ${pct(breakThen.them_breaking.win_rate)}`,
          }}
          now={{
            win_rate: breakNow.advantage,
            ctx: `breaking ${pct(breakNow.me_breaking.win_rate)} vs receiving ${pct(breakNow.them_breaking.win_rate)}`,
          }}
          format={(r) => `+${(r.win_rate * 100).toFixed(1)} pts`}
        />
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3>A prediction that came true</h3>
        <p className="sub">
          2018: "I would anticipate the share of games ending in regulation to increase as
          both players become more skilled." Share of 8-ball games ending in regulation, by year:
        </p>
        <Columns
          items={story.regulation_share.map((y) => ({
            label: String(y.year),
            value: y.share,
            games: y.games,
          }))}
          format={(v) => `${(v * 100).toFixed(0)}%`}
          detail={(d) => `${d.label}: ${(d.value * 100).toFixed(1)}% of ${d.games} games`}
        />
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3>An observation that flipped</h3>
        <p className="sub">
          2018: "the highest share of games end with 1 ball remaining as opposed to 0." True
          then — the fuller dataset says otherwise: dead-even games are now the most common ending.
        </p>
        <GroupedColumns
          buckets={[0, 1, 2, 3, 4, 5, 6, 7]}
          seriesA={story.loser_balls.now}
          seriesB={story.loser_balls.at_report}
          labelA="all games, now"
          labelB="as of the report"
          xTitle="loser's balls left"
        />
      </div>
    </div>
  );
}
