from contextlib import asynccontextmanager

from fastapi import FastAPI

from .config import get_settings
from .middleware import register_middleware
from .routes import register_routes
from .services.supabase import get_supabase_client


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_settings()
    get_supabase_client()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
    )
    register_middleware(app)
    register_routes(app)
    return app
