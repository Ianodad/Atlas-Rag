from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from supabase import Client

from .config import Settings, get_settings
from .dependencies import get_app_settings, get_server_supabase_client
from .services.supabase import get_supabase_client


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Fail fast during startup when required server env vars are missing.
    get_settings()
    get_supabase_client()
    yield


app = FastAPI(
    title="AtlasRAG API",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
def health(
    settings: Settings = Depends(get_app_settings),
    _: Client = Depends(get_server_supabase_client),
) -> dict[str, object]:
    return {
        "status": "ok",
        "environment": settings.app_env,
        "services": {
            "supabase": {
                "configured": True,
                "url": settings.supabase_url,
                "mode": "python-client",
                "server_key_source": settings.supabase_server_key_source,
                "db_url_configured": settings.supabase_db_url is not None,
            },
            "redis": {
                "host": settings.redis_host,
                "port": settings.redis_port,
            },
        },
    }
