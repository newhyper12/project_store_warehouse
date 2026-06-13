"""Application configuration loaded from environment / .env."""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # DB
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "store_db"
    db_user: str = "store_app"
    db_password: str = "store_app_pass"

    # JWT
    secret_key: str = Field(default="change-me")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # CORS
    cors_origins: List[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    # App
    env: str = "development"
    log_level: str = "INFO"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
