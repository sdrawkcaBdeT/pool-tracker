from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Cookie, HTTPException, status

from app.config import Settings, get_settings

OWNER_COOKIE_NAME = "pool_owner"


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _signature(message: str, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), message.encode("ascii"), hashlib.sha256).digest()
    return _b64encode(digest)


def create_owner_token(settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    if not settings.jwt_secret:
        raise ValueError("JWT_SECRET is required for owner tokens")

    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.session_days)
    payload = {
        "sub": "owner",
        "exp": int(expires_at.timestamp()),
    }
    encoded_payload = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    return f"{encoded_payload}.{_signature(encoded_payload, settings.jwt_secret)}"


def valid_owner_token(token: str | None, settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    if not token or not settings.jwt_secret:
        return False

    try:
        encoded_payload, token_signature = token.split(".", maxsplit=1)
    except ValueError:
        return False

    expected_signature = _signature(encoded_payload, settings.jwt_secret)
    if not hmac.compare_digest(token_signature, expected_signature):
        return False

    try:
        payload: dict[str, Any] = json.loads(_b64decode(encoded_payload))
    except (json.JSONDecodeError, ValueError):
        return False

    if payload.get("sub") != "owner":
        return False

    expires_at = payload.get("exp")
    if not isinstance(expires_at, int):
        return False

    return expires_at > int(datetime.now(timezone.utc).timestamp())


def owner_credential_matches(credential: str, settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    candidates = [value for value in (settings.owner_pin, settings.owner_password) if value]
    return any(hmac.compare_digest(credential, candidate) for candidate in candidates)


async def require_owner(pool_owner: str | None = Cookie(default=None)) -> None:
    if not valid_owner_token(pool_owner):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Owner authentication required",
        )
