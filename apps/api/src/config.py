from functools import lru_cache
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AtlasRAG API"
    app_version: str = "0.1.0"
    app_env: str = "development"
    dev_user_id: str = "00000000-0000-0000-0000-000000000001"
    dev_user_email: str = "demo@atlasrag.local"
    dev_user_display_name: str = "Demo User"

    supabase_url: str
    supabase_anon_key: SecretStr
    supabase_service_role_key: SecretStr
    supabase_db_url: SecretStr | None = None
    supabase_server_key_source: Literal["service_role", "anon"] = "service_role"

    redis_host: str = "127.0.0.1"
    redis_port: int = 6379

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
