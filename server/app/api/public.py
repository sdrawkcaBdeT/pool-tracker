from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
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
