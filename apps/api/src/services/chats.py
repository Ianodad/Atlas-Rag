from typing import Any

from supabase import Client

from ..schemas.chats import ChatCreate, ChatRename, MessageCreate, MessageFeedbackCreate
from .common import execute_data, fetch_project, first_or_none


DEFAULT_CHAT_TITLE = "New conversation"


class ChatService:
    def __init__(self, client: Client):
        self.client = client

    def list_chats(self, project_id: str, user_id: str) -> list[dict[str, Any]]:
        project = fetch_project(self.client, project_id, user_id)
        if project is None:
            return []
        return execute_data(
            self.client.table("chats")
            .select("*")
            .eq("project_id", project_id)
            .order("created_at", desc=False)
        )

    def create_chat(
        self,
        project_id: str,
        user_id: str,
        payload: ChatCreate,
    ) -> dict[str, Any] | None:
        project = fetch_project(self.client, project_id, user_id)
        if project is None:
            return None
        rows = execute_data(
            self.client.table("chats")
            .insert(
                {
                    "project_id": project_id,
                    "title": (payload.title or "").strip() or DEFAULT_CHAT_TITLE,
                }
            )
        )
        return first_or_none(rows)

    def get_chat(self, chat_id: str, user_id: str) -> dict[str, Any] | None:
        rows = execute_data(
            self.client.table("chats")
            .select("*, projects!inner(user_id), messages(*, message_feedback(*))")
            .eq("id", chat_id)
            .eq("projects.user_id", user_id)
            .limit(1)
        )
        chat = first_or_none(rows)
        if chat is None:
            return None
        chat["messages"] = sorted(chat.get("messages", []), key=lambda message: message["created_at"])
        for msg in chat.get("messages", []):
            feedback_list = msg.pop("message_feedback", [])
            msg["feedback"] = feedback_list[0] if feedback_list else None
        chat.pop("projects", None)
        return chat

    def rename_chat(self, chat_id: str, user_id: str, payload: ChatRename) -> dict[str, Any] | None:
        chat = self.get_chat(chat_id, user_id)
        if chat is None:
            return None
        rows = execute_data(
            self.client.table("chats").update({"title": payload.title}).eq("id", chat_id)
        )
        return first_or_none(rows) or chat

    def delete_chat(self, chat_id: str, user_id: str) -> bool:
        chat = self.get_chat(chat_id, user_id)
        if chat is None:
            return False
        self.client.table("chats").delete().eq("id", chat_id).execute()
        return True

    def create_message(
        self,
        chat_id: str,
        user_id: str,
        payload: MessageCreate,
    ) -> dict[str, Any] | None:
        chat = self.get_chat(chat_id, user_id)
        if chat is None:
            return None
        rows = execute_data(
            self.client.table("messages")
            .insert(
                {
                    "chat_id": chat_id,
                    "role": payload.role,
                    "content": payload.content,
                    "citations": payload.citations,
                    "metadata": payload.metadata,
                }
            )
        )
        return first_or_none(rows)

    def upsert_feedback(self, chat_id: str, message_id: str, user_id: str, payload: MessageFeedbackCreate) -> dict[str, Any] | None:
        chat = self.get_chat(chat_id, user_id)
        if chat is None:
            return None
        if not any(m["id"] == message_id for m in chat.get("messages", [])):
            return None
        rows = execute_data(
            self.client.table("message_feedback").upsert(
                {"message_id": message_id, "rating": payload.rating, "comment": payload.comment},
                on_conflict="message_id",
            )
        )
        return first_or_none(rows)

    def delete_feedback(self, chat_id: str, message_id: str, user_id: str) -> bool:
        chat = self.get_chat(chat_id, user_id)
        if chat is None:
            return False
        if not any(m["id"] == message_id for m in chat.get("messages", [])):
            return False
        self.client.table("message_feedback").delete().eq("message_id", message_id).execute()
        return True
