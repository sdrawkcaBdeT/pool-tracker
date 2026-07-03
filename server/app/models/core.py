"""Normalized schema for the pool game log.

Single-tenant in V1: every table carries user_id so another player could
record their own data later, but everything defaults to the owner user.
"""

from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

CENTRAL = ZoneInfo("America/Chicago")

GAME_TYPES = ("singles", "doubles", "cutthroat")
RESULTS = ("win", "loss")
WIN_TYPES = ("regulation", "early_8", "scratch_on_8", "wrong_pocket", "win_on_break")
SIDES = ("me", "teammate", "opponent")
ENTRY_MODES = ("live", "post_game", "import")


def central_now() -> datetime:
    return datetime.now(CENTRAL)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=central_now)


class Player(Base):
    __tablename__ = "players"
    __table_args__ = (UniqueConstraint("user_id", "name", name="players_user_name_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=central_now)


class Venue(Base):
    __tablename__ = "venues"
    __table_args__ = (UniqueConstraint("user_id", "name", name="venues_user_name_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=central_now)


class PlaySession(Base):
    __tablename__ = "play_sessions"
    __table_args__ = (
        UniqueConstraint("user_id", "date", "venue_id", name="play_sessions_user_date_venue_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    venue_id: Mapped[int] = mapped_column(ForeignKey("venues.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=central_now)

    venue: Mapped[Venue] = relationship()
    games: Mapped[list[Game]] = relationship(back_populates="session")


class Game(Base):
    __tablename__ = "games"
    __table_args__ = (
        UniqueConstraint("user_id", "seq", name="games_user_seq_key"),
        CheckConstraint(f"game_type in {GAME_TYPES!r}", name="games_game_type_check"),
        CheckConstraint(f"result in {RESULTS!r}", name="games_result_check"),
        CheckConstraint(
            f"win_type is null or win_type in {WIN_TYPES!r}", name="games_win_type_check"
        ),
        CheckConstraint(f"entry_mode in {ENTRY_MODES!r}", name="games_entry_mode_check"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("play_sessions.id"), nullable=False, index=True
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    game_type: Mapped[str] = mapped_column(String(16), nullable=False, default="singles")
    result: Mapped[str] = mapped_column(String(8), nullable=False)
    win_type: Mapped[str | None] = mapped_column(String(16), nullable=True)
    breaker_player_id: Mapped[int | None] = mapped_column(ForeignKey("players.id"), nullable=True)
    loser_balls_left: Mapped[int | None] = mapped_column(Integer, nullable=True)
    winner_balls_left: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    entry_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="live")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=central_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=central_now, onupdate=central_now
    )

    session: Mapped[PlaySession] = relationship(back_populates="games")
    breaker: Mapped[Player | None] = relationship()
    participants: Mapped[list[GamePlayer]] = relationship(
        back_populates="game", cascade="all, delete-orphan"
    )


class GamePlayer(Base):
    __tablename__ = "game_players"
    __table_args__ = (
        UniqueConstraint("game_id", "player_id", name="game_players_game_player_key"),
        CheckConstraint(f"side in {SIDES!r}", name="game_players_side_check"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), nullable=False, index=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"), nullable=False, index=True)
    side: Mapped[str] = mapped_column(String(12), nullable=False)
    finish_place: Mapped[int | None] = mapped_column(Integer, nullable=True)

    game: Mapped[Game] = relationship(back_populates="participants")
    player: Mapped[Player] = relationship()
