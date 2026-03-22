from functools import lru_cache
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_UNSTRUCTURED_API_URL = "https://api.unstructuredapp.io/general/v0/general"


class Settings(BaseSettings):
    app_env: str = "development"
    redis_host: str = "127.0.0.1"
    redis_port: int = 6379
    worker_document_queue: str = "documents"
    worker_process_document_task: str = "atlas_rag.process_document"
    worker_fake_processing_seconds: int = 3

    supabase_url: str
    supabase_anon_key: SecretStr
    supabase_service_role_key: SecretStr
    supabase_server_key_source: Literal["service_role", "anon"] = "service_role"
    openai_api_key: SecretStr | None = None
    google_gemini_api_key: SecretStr | None = None
    unstructured_api_key: SecretStr | None = None
    unstructured_api_url: str = DEFAULT_UNSTRUCTURED_API_URL
    unstructured_ssl_verify: bool = True
    unstructured_ca_bundle: str | None = None
    url_fetch_timeout: int = 30
    document_task_soft_time_limit: int = 540  # 9 minutes
    document_task_time_limit: int = 600        # 10 minutes
    document_task_max_retries: int = 2

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
