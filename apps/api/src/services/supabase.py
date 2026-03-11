from functools import lru_cache

from supabase import Client, create_client

from ..config import Settings, get_settings


def _get_server_key(settings: Settings) -> str:
    if settings.supabase_server_key_source == "anon":
        return settings.supabase_anon_key.get_secret_value()
    return settings.supabase_service_role_key.get_secret_value()


@lru_cache
def get_supabase_client() -> Client:
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        _get_server_key(settings),
    )
