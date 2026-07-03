from fastapi import APIRouter

from app.database import check_database_connection

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    await check_database_connection()
    return {"status": "ok"}
