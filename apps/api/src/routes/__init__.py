from fastapi import APIRouter, FastAPI

from .chats import router as chats_router
from .files import router as files_router
from .health import router as health_router
from .projects import router as projects_router
from .settings import router as settings_router
from .urls import router as urls_router


def register_routes(app: FastAPI) -> None:
    api_router = APIRouter()
    api_router.include_router(health_router)
    api_router.include_router(projects_router)
    api_router.include_router(settings_router)
    api_router.include_router(files_router)
    api_router.include_router(urls_router)
    api_router.include_router(chats_router)
    app.include_router(api_router)
