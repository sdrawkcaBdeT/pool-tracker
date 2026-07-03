from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import get_db
from app.models import Game, PlaySession, User
from app.services.importer import OWNER_USERNAME
from app.services.stats import (
    build_dashboard,
    build_scopes,
    build_sessions_log,
    build_story,
    load_log,
)

router = APIRouter(tags=["public"])

SCOPE_TYPES = {"overall", "opponent", "venue", "year"}


@router.get("/dashboard")
async def dashboard(
    scope: str = Query("overall"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    scope_type, _, key = scope.partition(":")
    if scope_type not in SCOPE_TYPES or (scope_type != "overall" and not key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scope must be overall, opponent:<name>, venue:<name>, or year:<yyyy>",
        )
    _, rows = await load_log(db, OWNER_USERNAME)
    return build_dashboard(rows, scope_type, key or None)


@router.get("/scopes")
async def scopes(db: AsyncSession = Depends(get_db)) -> dict:
    user, rows = await load_log(db, OWNER_USERNAME)
    payload = build_scopes(rows)
    payload["owner"] = user.display_name if user else None
    return payload


@router.get("/sessions")
async def sessions_log(db: AsyncSession = Depends(get_db)) -> dict:
    _, rows = await load_log(db, OWNER_USERNAME)
    return {"sessions": build_sessions_log(rows)}


@router.get("/sessions/{session_id}")
async def session_detail(session_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    """Game-level detail for one session. Public and read-only."""
    from app.api.record import _GAME_OPTIONS, _game_dict

    user = (
        await db.execute(select(User).where(User.username == OWNER_USERNAME))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    session = (
        await db.execute(
            select(PlaySession)
            .where(PlaySession.id == session_id, PlaySession.user_id == user.id)
            .options(selectinload(PlaySession.venue))
        )
    ).scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
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


@router.get("/story")
async def story(db: AsyncSession = Depends(get_db)) -> dict:
    _, rows = await load_log(db, OWNER_USERNAME)
    return build_story(rows)


@router.get("/report.pdf", include_in_schema=False)
async def report_pdf() -> FileResponse:
    path = get_settings().report_path
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return FileResponse(path, media_type="application/pdf", filename=path.name)
