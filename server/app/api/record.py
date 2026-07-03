"""Owner-only recording endpoints: sessions, games, roster for the pickers."""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Game, GamePlayer, Player, PlaySession, User, Venue
from app.security import require_owner
from app.services.importer import OWNER_DISPLAY_NAME, OWNER_USERNAME, norm

router = APIRouter(tags=["record"], dependencies=[Depends(require_owner)])

GAME_TYPES = {"singles", "doubles", "cutthroat"}
WIN_TYPES = {"regulation", "early_8", "scratch_on_8", "wrong_pocket", "win_on_break"}
OPPONENT_COUNT = {"singles": 1, "doubles": 2, "cutthroat": 2}


class SessionCreate(BaseModel):
    date: dt.date
    venue: str = Field(min_length=1, max_length=128)


class GamePayload(BaseModel):
    session_id: int
    game_type: str = "singles"
    result: str
    win_type: str | None = None
    breaker: str | None = None
    loser_balls_left: int | None = Field(default=None, ge=0, le=7)
    winner_balls_left: int | None = Field(default=None, ge=0, le=7)
    opponents: list[str] = Field(min_length=1, max_length=4)
    teammates: list[str] = Field(default_factory=list, max_length=3)
    finish_places: dict[str, int] = Field(default_factory=dict)
    notes: str = ""
    entry_mode: str = "live"

    @field_validator("result")
    @classmethod
    def _result(cls, value: str) -> str:
        if value not in ("win", "loss"):
            raise ValueError("result must be win or loss")
        return value

    @field_validator("entry_mode")
    @classmethod
    def _entry_mode(cls, value: str) -> str:
        if value not in ("live", "post_game"):
            raise ValueError("entry_mode must be live or post_game")
        return value

    def validate_shape(self) -> None:
        if self.game_type not in GAME_TYPES:
            raise HTTPException(400, f"game_type must be one of {sorted(GAME_TYPES)}")
        if self.game_type == "cutthroat":
            if self.win_type is not None:
                raise HTTPException(400, "cutthroat games have no win_type")
        elif self.win_type not in WIN_TYPES:
            raise HTTPException(400, f"win_type must be one of {sorted(WIN_TYPES)}")
        expected = OPPONENT_COUNT[self.game_type]
        if len(self.opponents) != expected:
            raise HTTPException(400, f"{self.game_type} needs exactly {expected} opponents")
        if self.game_type != "doubles" and self.teammates:
            raise HTTPException(400, "teammates only apply to doubles")


async def _owner(db: AsyncSession) -> User:
    user = (
        await db.execute(select(User).where(User.username == OWNER_USERNAME))
    ).scalar_one_or_none()
    if user is None:
        user = User(username=OWNER_USERNAME, display_name=OWNER_DISPLAY_NAME)
        db.add(user)
        await db.flush()
    return user


async def _get_or_create_player(db: AsyncSession, user: User, name: str) -> Player:
    clean = norm(name)
    if not clean:
        raise HTTPException(400, "player name cannot be empty")
    player = (
        await db.execute(
            select(Player).where(Player.user_id == user.id, Player.name == clean)
        )
    ).scalar_one_or_none()
    if player is None:
        player = Player(user_id=user.id, name=clean)
        db.add(player)
        await db.flush()
    return player


def _game_dict(game: Game) -> dict:
    opponents = [p.player.name for p in game.participants if p.side == "opponent"]
    teammates = [p.player.name for p in game.participants if p.side == "teammate"]
    finish_places = {
        p.player.name: p.finish_place for p in game.participants if p.finish_place
    }
    return {
        "id": game.id,
        "seq": game.seq,
        "session_id": game.session_id,
        "game_type": game.game_type,
        "result": game.result,
        "win_type": game.win_type,
        "breaker": game.breaker.name if game.breaker else None,
        "loser_balls_left": game.loser_balls_left,
        "winner_balls_left": game.winner_balls_left,
        "opponents": opponents,
        "teammates": teammates,
        "finish_places": finish_places,
        "notes": game.notes,
        "entry_mode": game.entry_mode,
    }


_GAME_OPTIONS = (
    selectinload(Game.participants).selectinload(GamePlayer.player),
    selectinload(Game.breaker),
)


async def _load_game(db: AsyncSession, game_id: int, user: User) -> Game:
    game = (
        await db.execute(
            select(Game)
            .where(Game.id == game_id, Game.user_id == user.id)
            .options(*_GAME_OPTIONS)
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
    if game is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Game not found")
    return game


async def _set_participants(db: AsyncSession, game: Game, user: User, payload: GamePayload) -> None:
    await db.execute(delete(GamePlayer).where(GamePlayer.game_id == game.id))
    me = await _get_or_create_player(db, user, OWNER_USERNAME)
    places = {norm(name): place for name, place in payload.finish_places.items()}
    db.add(GamePlayer(game_id=game.id, player_id=me.id, side="me", finish_place=places.get(OWNER_USERNAME)))
    for side, names in (("opponent", payload.opponents), ("teammate", payload.teammates)):
        for name in names:
            player = await _get_or_create_player(db, user, name)
            db.add(
                GamePlayer(
                    game_id=game.id,
                    player_id=player.id,
                    side=side,
                    finish_place=places.get(player.name),
                )
            )


@router.get("/record/roster")
async def roster(db: AsyncSession = Depends(get_db)) -> dict:
    user = await _owner(db)
    games = (
        (
            await db.execute(
                select(Game)
                .where(Game.user_id == user.id)
                .options(
                    *_GAME_OPTIONS,
                    selectinload(Game.session).selectinload(PlaySession.venue),
                )
                .order_by(Game.seq)
            )
        )
        .scalars()
        .all()
    )
    player_games: dict[str, int] = {}
    player_last: dict[str, str] = {}
    venue_games: dict[str, int] = {}
    for game in games:
        venue_games[game.session.venue.name] = venue_games.get(game.session.venue.name, 0) + 1
        for part in game.participants:
            if part.side == "me":
                continue
            name = part.player.name
            player_games[name] = player_games.get(name, 0) + 1
            player_last[name] = game.session.date.isoformat()

    last_session = None
    if games:
        last = games[-1].session
        session_games = [g for g in games if g.session_id == last.id]
        last_session = {
            "id": last.id,
            "date": last.date.isoformat(),
            "venue": last.venue.name,
            "games": [_game_dict(g) for g in session_games],
        }

    players = [
        {"name": name, "games": count, "last_played": player_last[name]}
        for name, count in sorted(player_games.items(), key=lambda kv: -kv[1])
    ]
    venues = [
        {"name": name, "games": count}
        for name, count in sorted(venue_games.items(), key=lambda kv: -kv[1])
    ]
    return {
        "me": OWNER_USERNAME,
        "players": players,
        "venues": venues,
        "last_session": last_session,
    }


@router.post("/record/sessions")
async def create_session(payload: SessionCreate, db: AsyncSession = Depends(get_db)) -> dict:
    user = await _owner(db)
    venue_name = norm(payload.venue)
    if not venue_name:
        raise HTTPException(400, "venue cannot be empty")
    venue = (
        await db.execute(
            select(Venue).where(Venue.user_id == user.id, Venue.name == venue_name)
        )
    ).scalar_one_or_none()
    if venue is None:
        venue = Venue(user_id=user.id, name=venue_name)
        db.add(venue)
        await db.flush()
    session = (
        await db.execute(
            select(PlaySession).where(
                PlaySession.user_id == user.id,
                PlaySession.date == payload.date,
                PlaySession.venue_id == venue.id,
            )
        )
    ).scalar_one_or_none()
    if session is None:
        session = PlaySession(user_id=user.id, date=payload.date, venue_id=venue.id)
        db.add(session)
        await db.flush()
    await db.commit()
    return {"id": session.id, "date": session.date.isoformat(), "venue": venue.name}


@router.get("/record/sessions/{session_id}")
async def session_games(session_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    user = await _owner(db)
    session = (
        await db.execute(
            select(PlaySession)
            .where(PlaySession.id == session_id, PlaySession.user_id == user.id)
            .options(selectinload(PlaySession.venue))
        )
    ).scalar_one_or_none()
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    games = (
        (
            await db.execute(
                select(Game)
                .where(Game.session_id == session.id)
                .options(*_GAME_OPTIONS)
                .order_by(Game.seq)
            )
        )
        .scalars()
        .all()
    )
    return {
        "id": session.id,
        "date": session.date.isoformat(),
        "venue": session.venue.name,
        "games": [_game_dict(g) for g in games],
    }


@router.post("/record/games")
async def create_game(payload: GamePayload, db: AsyncSession = Depends(get_db)) -> dict:
    payload.validate_shape()
    user = await _owner(db)
    session = (
        await db.execute(
            select(PlaySession).where(
                PlaySession.id == payload.session_id, PlaySession.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")

    next_seq = (
        await db.execute(select(func.coalesce(func.max(Game.seq), 0)).where(Game.user_id == user.id))
    ).scalar_one() + 1

    game = Game(
        user_id=user.id,
        session_id=session.id,
        seq=next_seq,
        game_type=payload.game_type,
        result=payload.result,
        win_type=payload.win_type,
        breaker_player_id=(
            (await _get_or_create_player(db, user, payload.breaker)).id
            if payload.breaker
            else None
        ),
        loser_balls_left=payload.loser_balls_left,
        winner_balls_left=payload.winner_balls_left,
        notes=payload.notes.strip(),
        entry_mode=payload.entry_mode,
    )
    db.add(game)
    await db.flush()
    await _set_participants(db, game, user, payload)
    await db.commit()
    return _game_dict(await _load_game(db, game.id, user))


@router.put("/record/games/{game_id}")
async def update_game(game_id: int, payload: GamePayload, db: AsyncSession = Depends(get_db)) -> dict:
    payload.validate_shape()
    user = await _owner(db)
    game = await _load_game(db, game_id, user)
    if payload.session_id != game.session_id:
        raise HTTPException(400, "session_id cannot change on update")
    game.game_type = payload.game_type
    game.result = payload.result
    game.win_type = payload.win_type
    game.breaker_player_id = (
        (await _get_or_create_player(db, user, payload.breaker)).id if payload.breaker else None
    )
    game.loser_balls_left = payload.loser_balls_left
    game.winner_balls_left = payload.winner_balls_left
    game.notes = payload.notes.strip()
    await _set_participants(db, game, user, payload)
    await db.commit()
    return _game_dict(await _load_game(db, game.id, user))


@router.delete("/record/games/{game_id}")
async def delete_game(game_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    user = await _owner(db)
    game = await _load_game(db, game_id, user)
    await db.delete(game)
    await db.commit()
    return {"deleted": game_id}
