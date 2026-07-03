from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.public import router as public_router
from app.api.record import router as record_router
from app.config import get_settings
from app.database import create_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    if get_settings().auto_import:
        from app.services.importer import import_if_empty

        await import_if_empty()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    if settings.cors_origin_list:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origin_list,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.include_router(health_router, prefix="/api")
    app.include_router(auth_router, prefix="/api")
    app.include_router(public_router, prefix="/api")
    app.include_router(record_router, prefix="/api")
    mount_frontend(app, settings.static_dir)
    return app


def mount_frontend(app: FastAPI, configured_static_dir: str | None) -> None:
    static_dir = (
        Path(configured_static_dir)
        if configured_static_dir
        else Path(__file__).resolve().parent / "static"
    )
    index_path = static_dir / "index.html"
    assets_dir = static_dir / "assets"

    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    if index_path.exists():

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_frontend(full_path: str) -> FileResponse:
            if full_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="Not found")
            return FileResponse(index_path)


app = create_app()
