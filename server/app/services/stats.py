"""Aggregate builders for the public dashboard.

Everything computes from a single in-memory game log (610 historical games;
this stays trivial for years). Cutthroat games carry different semantics, so
8-ball-specific blocks (win types, margins, break splits) exclude them and
say so via the game_types block.
"""

from __future__ import annotations

import datetime as dt
import math
from collections import Counter
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import CENTRAL, Game, GamePlayer, PlaySession, User

REPORT_DATE = dt.date(2018, 4, 26)  # the 2018 "Pool vs Dad" PDF
TRAILING_DAYS = 365
ROLLING_WINDOW = 10


@dataclass
class LogRow:
    seq: int
    date: dt.date
    venue: str
    session_id: int
    game_type: str
    win: bool
    win_type: str | None
    breaker: str | None
    breaker_is_me: bool
    loser_balls_left: int | None
    winner_balls_left: int | None
    opponents: list[str]
    teammates: list[str]
    my_finish_place: int | None
    notes: str


async def load_log(db: AsyncSession, username: str) -> tuple[User | None, list[LogRow]]:
    user = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
    if user is None:
        return None, []

    games = (
        (
            await db.execute(
                select(Game)
                .where(Game.user_id == user.id)
                .options(
                    selectinload(Game.session).selectinload(PlaySession.venue),
                    selectinload(Game.breaker),
                    selectinload(Game.participants).selectinload(GamePlayer.player),
                )
                .order_by(Game.seq)
            )
        )
        .scalars()
        .all()
    )

    rows: list[LogRow] = []
    for game in games:
        opponents, teammates, my_place = [], [], None
        for part in game.participants:
            if part.side == "opponent":
                opponents.append(part.player.name)
            elif part.side == "teammate":
                teammates.append(part.player.name)
            else:
                my_place = part.finish_place
        breaker = game.breaker.name if game.breaker else None
        rows.append(
            LogRow(
                seq=game.seq,
                date=game.session.date,
                venue=game.session.venue.name,
                session_id=game.session_id,
                game_type=game.game_type,
                win=game.result == "win",
                win_type=game.win_type,
                breaker=breaker,
                breaker_is_me=breaker == username,
                loser_balls_left=game.loser_balls_left,
                winner_balls_left=game.winner_balls_left,
                opponents=opponents,
                teammates=teammates,
                my_finish_place=my_place,
                notes=game.notes,
            )
        )
    return user, rows


def filter_scope(rows: list[LogRow], scope_type: str, key: str | None) -> list[LogRow]:
    if scope_type == "overall":
        return rows
    if scope_type == "opponent":
        return [r for r in rows if key in r.opponents]
    if scope_type == "venue":
        return [r for r in rows if r.venue == key]
    if scope_type == "year":
        return [r for r in rows if str(r.date.year) == key]
    raise ValueError(f"Unknown scope type {scope_type!r}")


def _record(rows: list[LogRow]) -> dict:
    wins = sum(r.win for r in rows)
    return {
        "games": len(rows),
        "wins": wins,
        "losses": len(rows) - wins,
        "win_rate": wins / len(rows) if rows else None,
        "first_date": rows[0].date.isoformat() if rows else None,
        "last_date": rows[-1].date.isoformat() if rows else None,
        "sessions": len({r.session_id for r in rows}),
    }


def _trailing(rows: list[LogRow], today: dt.date) -> dict:
    since = today - dt.timedelta(days=TRAILING_DAYS)
    recent = [r for r in rows if r.date >= since]
    wins = sum(r.win for r in recent)
    return {
        "days": TRAILING_DAYS,
        "since": since.isoformat(),
        "games": len(recent),
        "wins": wins,
        "losses": len(recent) - wins,
        "win_rate": wins / len(recent) if recent else None,
    }


def _rolling(rows: list[LogRow]) -> list[dict]:
    series = []
    for i in range(ROLLING_WINDOW - 1, len(rows)):
        window = rows[i - ROLLING_WINDOW + 1 : i + 1]
        series.append(
            {
                "seq": rows[i].seq,
                "date": rows[i].date.isoformat(),
                "win_rate": sum(r.win for r in window) / ROLLING_WINDOW,
            }
        )
    return series


def _streaks(rows: list[LogRow]) -> dict:
    longest_win = longest_loss = run = 0
    prev: bool | None = None
    for r in rows:
        run = run + 1 if r.win == prev else 1
        prev = r.win
        if r.win:
            longest_win = max(longest_win, run)
        else:
            longest_loss = max(longest_loss, run)
    current = {"type": "win" if prev else "loss", "length": run} if rows else None
    return {"longest_win": longest_win, "longest_loss": longest_loss, "current": current}


def _win_types(eight_ball: list[LogRow]) -> dict:
    wins = Counter(r.win_type for r in eight_ball if r.win)
    losses = Counter(r.win_type for r in eight_ball if not r.win)
    return {"wins": dict(wins), "losses": dict(losses)}


def _margins(eight_ball: list[LogRow]) -> dict:
    def histogram(rows: list[LogRow]) -> list[int]:
        counts = Counter(
            r.loser_balls_left for r in rows if isinstance(r.loser_balls_left, int)
        )
        return [counts.get(i, 0) for i in range(8)]

    on_the_8 = [
        r for r in eight_ball if r.win_type == "regulation" and r.loser_balls_left == 0
    ]
    wins_on_8 = sum(r.win for r in on_the_8)
    return {
        "when_winning": histogram([r for r in eight_ball if r.win]),
        "when_losing": histogram([r for r in eight_ball if not r.win]),
        "on_the_8": {
            "games": len(on_the_8),
            "wins": wins_on_8,
            "losses": len(on_the_8) - wins_on_8,
            "win_rate": wins_on_8 / len(on_the_8) if on_the_8 else None,
        },
    }


def _break_stats(eight_ball: list[LogRow]) -> dict:
    def split(rows: list[LogRow]) -> dict:
        wins = sum(r.win for r in rows)
        return {
            "games": len(rows),
            "wins": wins,
            "win_rate": wins / len(rows) if rows else None,
        }

    mine = split([r for r in eight_ball if r.breaker_is_me])
    theirs = split([r for r in eight_ball if not r.breaker_is_me])
    advantage = (
        mine["win_rate"] - theirs["win_rate"]
        if mine["win_rate"] is not None and theirs["win_rate"] is not None
        else None
    )

    # Two-proportion z-test (two-sided). With one binary predictor this is the
    # same inference a logistic regression's Wald test gives, so "compare the
    # percentages" and "run the regression" agree; this adds the p-value.
    p_value = None
    if mine["games"] and theirs["games"]:
        pooled = (mine["wins"] + theirs["wins"]) / (mine["games"] + theirs["games"])
        variance = pooled * (1 - pooled) * (1 / mine["games"] + 1 / theirs["games"])
        if variance > 0:
            z = (mine["win_rate"] - theirs["win_rate"]) / math.sqrt(variance)
            p_value = math.erfc(abs(z) / math.sqrt(2))

    return {
        "me_breaking": mine,
        "them_breaking": theirs,
        "advantage": advantage,
        "p_value": p_value,
    }


def _by_year(rows: list[LogRow]) -> list[dict]:
    years: dict[int, list[LogRow]] = {}
    for r in rows:
        years.setdefault(r.date.year, []).append(r)
    return [
        {
            "year": year,
            "games": len(group),
            "wins": sum(r.win for r in group),
            "win_rate": sum(r.win for r in group) / len(group),
        }
        for year, group in sorted(years.items())
    ]


def _sessions(rows: list[LogRow]) -> list[dict]:
    grouped: dict[int, list[LogRow]] = {}
    for r in rows:
        grouped.setdefault(r.session_id, []).append(r)
    sessions = []
    for session_id, group in grouped.items():
        wins = sum(r.win for r in group)
        opponents = sorted({name for r in group for name in r.opponents})
        sessions.append(
            {
                "session_id": session_id,
                "date": group[0].date.isoformat(),
                "venue": group[0].venue,
                "games": len(group),
                "wins": wins,
                "losses": len(group) - wins,
                "opponents": opponents,
            }
        )
    sessions.sort(key=lambda s: (s["date"], s["session_id"]), reverse=True)
    return sessions


def _cutthroat(rows: list[LogRow]) -> dict | None:
    cutthroat = [r for r in rows if r.game_type == "cutthroat"]
    if not cutthroat:
        return None
    wins = sum(r.win for r in cutthroat)
    places = Counter(r.my_finish_place for r in cutthroat if r.my_finish_place)
    return {
        "games": len(cutthroat),
        "wins": wins,
        "losses": len(cutthroat) - wins,
        "finish_places": {str(place): count for place, count in sorted(places.items())},
    }


def build_dashboard(rows: list[LogRow], scope_type: str, key: str | None) -> dict:
    scoped = filter_scope(rows, scope_type, key)
    eight_ball = [r for r in scoped if r.game_type != "cutthroat"]
    today = dt.datetime.now(CENTRAL).date()
    return {
        "scope": {"type": scope_type, "key": key},
        "record": _record(scoped),
        "trailing": _trailing(scoped, today),
        "rolling": {"window": ROLLING_WINDOW, "series": _rolling(scoped)},
        "streaks": _streaks(scoped),
        "game_types": dict(Counter(r.game_type for r in scoped)),
        "win_types": _win_types(eight_ball),
        "margins": _margins(eight_ball),
        "break": _break_stats(eight_ball),
        "by_year": _by_year(scoped),
        "recent_sessions": _sessions(scoped)[:5],
        "cutthroat": _cutthroat(scoped),
    }


def build_scopes(rows: list[LogRow]) -> dict:
    """Per-slice records for the browse boards, not just counts."""

    def slice_record(group: list[LogRow]) -> dict:
        wins = sum(r.win for r in group)
        return {
            "games": len(group),
            "wins": wins,
            "losses": len(group) - wins,
            "win_rate": wins / len(group) if group else None,
            "first_date": min(r.date for r in group).isoformat(),
            "last_date": max(r.date for r in group).isoformat(),
        }

    opponents: dict[str, list[LogRow]] = {}
    venues: dict[str, list[LogRow]] = {}
    years: dict[str, list[LogRow]] = {}
    for r in rows:
        for name in r.opponents:
            opponents.setdefault(name, []).append(r)
        venues.setdefault(r.venue, []).append(r)
        years.setdefault(str(r.date.year), []).append(r)

    return {
        "opponents": [
            {"name": name, **slice_record(group)}
            for name, group in sorted(opponents.items(), key=lambda kv: -len(kv[1]))
        ],
        "venues": [
            {"name": name, **slice_record(group)}
            for name, group in sorted(venues.items(), key=lambda kv: -len(kv[1]))
        ],
        "years": [
            {"year": year, **slice_record(group)} for year, group in sorted(years.items())
        ],
    }


def build_sessions_log(rows: list[LogRow]) -> list[dict]:
    return _sessions(rows)


def build_story(rows: list[LogRow]) -> dict:
    """Then-vs-now numbers for the 2018 report showcase page."""
    # Singles only: the 2018 report's pivot filtered opponent == 'dad', which
    # excluded doubles/cutthroat rows, so the then-vs-now must match.
    vs_dad = [r for r in rows if r.opponents == ["dad"] and r.game_type == "singles"]
    at_report = [r for r in vs_dad if r.date <= REPORT_DATE]
    since_report = [r for r in vs_dad if r.date > REPORT_DATE]
    eight_ball = [r for r in rows if r.game_type != "cutthroat"]

    def record(group: list[LogRow]) -> dict:
        wins = sum(r.win for r in group)
        return {
            "games": len(group),
            "wins": wins,
            "losses": len(group) - wins,
            "win_rate": wins / len(group) if group else None,
        }

    regulation_share = [
        {
            "year": year,
            "share": sum(1 for r in group if r.win_type == "regulation") / len(group),
            "games": len(group),
        }
        for year, group in sorted(
            {
                year: [r for r in eight_ball if r.date.year == year]
                for year in {r.date.year for r in eight_ball}
            }.items()
        )
        if group
    ]

    def loser_histogram(group: list[LogRow]) -> list[int]:
        counts = Counter(
            r.loser_balls_left for r in group if isinstance(r.loser_balls_left, int)
        )
        return [counts.get(i, 0) for i in range(8)]

    return {
        "report_date": REPORT_DATE.isoformat(),
        "report_url": "/api/report.pdf",
        "vs_dad": {
            "at_report": record(at_report),
            "since_report": record(since_report),
            "now": record(vs_dad),
        },
        "break_now": _break_stats(eight_ball),
        "break_at_report": _break_stats([r for r in eight_ball if r.date <= REPORT_DATE]),
        "regulation_share": regulation_share,
        "loser_balls": {
            "at_report": loser_histogram([r for r in eight_ball if r.date <= REPORT_DATE]),
            "now": loser_histogram(eight_ball),
        },
    }
