from supabase import Client

from .config import Settings, get_settings
from .services.supabase import get_supabase_client


def get_app_settings() -> Settings:
    return get_settings()


def get_server_supabase_client() -> Client:
    return get_supabase_client()
