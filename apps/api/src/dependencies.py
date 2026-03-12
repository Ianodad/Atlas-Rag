from fastapi import Depends, Header, HTTPException
from supabase import Client

from .config import Settings, get_settings
from .schemas.auth import CurrentUser
from .services.chats import ChatService
from .services.common import execute_data, first_or_none
from .services.projects import ProjectService
from .services.supabase import get_supabase_client


def get_app_settings() -> Settings:
    return get_settings()


def get_server_supabase_client() -> Client:
    return get_supabase_client()


def get_current_user(
    x_dev_user_id: str | None = Header(default=None),
    client: Client = Depends(get_server_supabase_client),
    settings: Settings = Depends(get_app_settings),
) -> CurrentUser:
    user_id = x_dev_user_id or settings.dev_user_id

    rows = execute_data(
        client.table("users")
        .select("*")
        .eq("id", user_id)
        .limit(1)
    )
    user = first_or_none(rows)

    if user is None and user_id != settings.dev_user_id:
        raise HTTPException(status_code=401, detail="Unknown development user")

    if user is None:
        user = execute_data(
            client.table("users")
            .upsert(
                {
                    "id": settings.dev_user_id,
                    "email": settings.dev_user_email,
                    "display_name": settings.dev_user_display_name,
                    "external_auth_id": "dev-demo-user",
                }
            )
            .select("*")
        )[0]

    return CurrentUser.model_validate(user)


def get_project_service(
    client: Client = Depends(get_server_supabase_client),
) -> ProjectService:
    return ProjectService(client)


def get_chat_service(
    client: Client = Depends(get_server_supabase_client),
) -> ChatService:
    return ChatService(client)
