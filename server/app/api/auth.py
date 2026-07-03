from typing import Literal

from fastapi import APIRouter, Cookie, HTTPException, Response, status
from pydantic import BaseModel

from app.config import get_settings
from app.security import (
    OWNER_COOKIE_NAME,
    create_owner_token,
    owner_credential_matches,
    valid_owner_token,
)

router = APIRouter(tags=["auth"])


class OwnerLoginRequest(BaseModel):
    pin: str | None = None
    password: str | None = None


class ModeResponse(BaseModel):
    mode: Literal["observer", "owner"]


@router.post("/auth/owner-login", response_model=ModeResponse)
async def owner_login(payload: OwnerLoginRequest, response: Response) -> ModeResponse:
    settings = get_settings()
    if not settings.auth_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Owner login is not configured",
        )

    credential = payload.pin or payload.password or ""
    if not credential or not owner_credential_matches(credential, settings):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid owner credential",
        )

    response.set_cookie(
        OWNER_COOKIE_NAME,
        create_owner_token(settings),
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.session_days * 24 * 60 * 60,
        path="/",
    )
    return ModeResponse(mode="owner")


@router.post("/auth/logout", response_model=ModeResponse)
async def logout(response: Response) -> ModeResponse:
    response.delete_cookie(OWNER_COOKIE_NAME, path="/")
    return ModeResponse(mode="observer")


@router.get("/me", response_model=ModeResponse)
async def me(pool_owner: str | None = Cookie(default=None)) -> ModeResponse:
    return ModeResponse(mode="owner" if valid_owner_token(pool_owner) else "observer")
