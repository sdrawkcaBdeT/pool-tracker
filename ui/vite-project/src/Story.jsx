import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import { Section } from "./components.jsx";
import { Columns } from "./charts.jsx";
import { pct, record, signedPts } from "./format.js";

function ThenNow({ thenLabel, thenValue, thenCtx, nowLabel, nowValue, nowCtx }) {
  return (
    <div className="thenNow">
      <div className="thenNowCell">
        <span>{thenLabel}</span>
        <strong>{thenValue}</strong>
        <small>{thenCtx}</small>
      </div>
      <div className="thenNowCell">
        <span>{nowLabel}</span>
        <strong>{nowValue}</strong>
        <small>{nowCtx}</small>
      </div>
    </div>
  );
}

function Claim({ verdict, quote, children }) {
  return (
    <div className="claimCard">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
        <blockquote>{quote}</blockquote>
        <span className={`verdict verdict-${verdict.toLowerCase()}`}>{verdict}</span>
      </div>
      {children}
    </div>
  );
}

export default function Story() {
  const [story, setStory] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.story().then(setStory).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="pageError">{error}</p>;
  if (!story) return <p className="muted">Loading…</p>;

  const vsDad = story.vs_dad;
  const bThen = story.break_at_report;
  const bNow = story.break_now;
  const lbThen = story.loser_balls.at_report;
  const lbNow = story.loser_balls.now;

  return (
    <div>
      <Section eyebrow="The origin" title="How this started">
        <div className="storyProse storyLetter">
          <p>
            I already knew I liked collecting data. I was a junior in college, and my dad worked
            on one side of where I lived and lived on the other. When he passed through we'd meet
            at a bar nearby that had some pool tables. Late lunch, a couple games. That's when I
            started playing regularly.
          </p>
          <p>
            The data itch showed up almost immediately. It's commonly accepted that breaking is
            an advantage in pool. But is it, in the games I play? I knew a simple logistic
            regression could answer that, and all it needed was two columns: who broke, and who
            won. So I started writing those down. Then location. Then how the game ended, and how
            many balls were left on the table. It never really stopped.
          </p>
          <p>
            Nine years later the spreadsheet hit 610 games, and it outgrew Excel. This site is
            the same notebook with better plumbing. Every game still gets written down. The math
            just runs itself now.
          </p>
        </div>
      </Section>

      <Section
        eyebrow="The artifact"
        title="The original report"
        lede="A year into tracking, I compiled the first analysis: a Tableau breakdown of every game against my dad, April 2018. It's early work and it reads like it. But it asked real questions and made real predictions, and eight more years of data can grade them now."
        action={
          <a className="buttonLink" href="/api/report.pdf" target="_blank" rel="noreferrer">
            Read the 2018 report
          </a>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <Claim
            verdict="Confirmed"
            quote="I would anticipate the share of games ending in regulation to increase as time goes on as both players become more skilled."
          >
            <p style={{ margin: 0 }}>
              Called it. Regulation endings jumped from{" "}
              <b>{pct(story.regulation_share[0].share, 1)}</b> in 2017 into the high 80s and
              they've stayed there since.
            </p>
            <Columns
              items={story.regulation_share.map((y) => ({
                label: String(y.year),
                value: y.share,
                games: y.games,
              }))}
              format={(v) => pct(v, 0)}
              detail={(d) => (
                <>
                  <strong>{d.label}</strong>: {pct(d.value, 1)} of {d.games} games
                </>
              )}
            />
          </Claim>

          <Claim verdict="Flipped" quote="Overall, Ted wins 42.2% of the 116 games played since tracking data.">
            <p style={{ margin: 0 }}>
              True at the time. Dad owned the early series. Since the report I'm{" "}
              <b>{record(vsDad.since_report)}</b> against him ({pct(vsDad.since_report.win_rate, 1)}),
              and the gap keeps closing.
            </p>
            <ThenNow
              thenLabel="vs dad, at the report"
              thenValue={pct(vsDad.at_report.win_rate, 1)}
              thenCtx={`${record(vsDad.at_report)} over ${vsDad.at_report.games} games`}
              nowLabel="vs dad, since the report"
              nowValue={pct(vsDad.since_report.win_rate, 1)}
              nowCtx={`${record(vsDad.since_report)} over ${vsDad.since_report.games} games`}
            />
          </Claim>

          <Claim
            verdict="Settled"
            quote="Ted's win-rate is 34.4% when Tim breaks, and 50.9% when he breaks, implying breaking is an advantage."
          >
            <p style={{ margin: 0 }}>
              The question that started all of this, answered for good. Across every 8-ball game
              I've recorded, breaking is worth <b>{signedPts(bNow.advantage)}</b> of win rate.
              The regression agreed years ago. The break is real.
            </p>
            <ThenNow
              thenLabel="all games, at the report"
              thenValue={signedPts(bThen.advantage)}
              thenCtx={`breaking ${pct(bThen.me_breaking.win_rate, 1)}, receiving ${pct(bThen.them_breaking.win_rate, 1)}`}
              nowLabel="all games, now"
              nowValue={signedPts(bNow.advantage)}
              nowCtx={`breaking ${pct(bNow.me_breaking.win_rate, 1)}, receiving ${pct(bNow.them_breaking.win_rate, 1)}`}
            />
          </Claim>

          <Claim
            verdict="Flipped"
            quote="It is also observed that the highest share of games end with 1 ball remaining as opposed to 0."
          >
            <p style={{ margin: 0 }}>
              Held up then, not anymore. With the full dataset, the dead-even ending took the
              lead: loser stuck on the 8 with nothing else left is now the single most common way
              a game ends.
            </p>
            <ThenNow
              thenLabel="at the report"
              thenValue={`1 ball led`}
              thenCtx={`${lbThen[1]} games at one left, ${lbThen[0]} at zero`}
              nowLabel="now"
              nowValue={`0 balls lead`}
              nowCtx={`${lbNow[0]} games at zero left, ${lbNow[1]} at one`}
            />
          </Claim>
        </div>
      </Section>
    </div>
  );
}
