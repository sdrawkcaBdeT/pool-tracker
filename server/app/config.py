from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "Pool Tracker"
    database_url: str = f"sqlite+aiosqlite:///{REPO_ROOT / 'data' / 'pool.db'}"
    cors_origins: str = "http://localhost:5173,http://localhost:8000"
    static_dir: str | None = None
    data_dir: str = str(REPO_ROOT / "data" / "raw")
    report_filename: str = "Pool vs Dad Breakdown Document 4.26.2018.pdf"
    app_git_sha: str | None = None
    auto_import: bool = False
    owner_pin: str | None = None
    owner_password: str | None = None
    jwt_secret: str | None = None
    session_days: int = 90
    cookie_secure: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def report_path(self) -> Path:
        return Path(self.data_dir) / self.report_filename

    @property
    def owner_credentials_configured(self) -> bool:
        return bool(self.owner_pin or self.owner_password)

    @property
    def auth_configured(self) -> bool:
        return bool(self.jwt_secret and self.owner_credentials_configured)


@lru_cache
def get_settings() -> Settings:
    return Settings()
