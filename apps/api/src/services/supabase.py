from supabase import Client, create_client

from ..config import Settings, get_settings


def _get_server_key(settings: Settings) -> str:
    if settings.supabase_server_key_source == "anon":
        return settings.supabase_anon_key.get_secret_value()
    return settings.supabase_service_role_key.get_secret_value()


def get_supabase_client() -> Client:
    """Create a fresh Supabase client per request.

    Not cached: caching a single client shares one HTTP/2 connection pool
    across all requests. After ~30 streams the server sends GOAWAY and the
    stale client raises httpx.RemoteProtocolError on every subsequent call.
    """
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        _get_server_key(settings),
    )
