from fastapi import APIRouter, Depends

from ..config import Settings
from ..dependencies import get_app_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health(
    settings: Settings = Depends(get_app_settings),
) -> dict[str, object]:
    return {
        "status": "ok",
        "environment": settings.app_env,
        "services": {
            "supabase": {
                "configured": True,
                "url": settings.supabase_url,
                "mode": "python-client",
                "serverKeySource": settings.supabase_server_key_source,
                "dbUrlConfigured": settings.supabase_db_url is not None,
            },
            "redis": {
                "host": settings.redis_host,
                "port": settings.redis_port,
            },
        },
        "auth": {"mode": "fake-auth"},
    }
