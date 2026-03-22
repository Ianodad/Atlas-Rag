from typing import Any
from typing import Literal

from .base import ApiModel


class MessageFeedbackCreate(ApiModel):
    rating: Literal["thumbs_up", "thumbs_down"]
    comment: str | None = None


class MessageFeedbackResponse(ApiModel):
    id: str
    message_id: str
    rating: Literal["thumbs_up", "thumbs_down"]
    comment: str | None
    created_at: str
    updated_at: str


class ChatCreate(ApiModel):
    title: str | None = None


class ChatRename(ApiModel):
    title: str


class MessageCreate(ApiModel):
    role: Literal["system", "user", "assistant"]
    content: str
    citations: list[dict[str, Any]] = []
    metadata: dict[str, Any] = {}


class ChatResponse(ApiModel):
    id: str
    project_id: str
    title: str
    created_at: str
    updated_at: str


class MessageResponse(ApiModel):
    id: str
    chat_id: str
    role: Literal["system", "user", "assistant"]
    content: str
    citations: list[dict[str, Any]]
    metadata: dict[str, Any]
    created_at: str
    feedback: "MessageFeedbackResponse | None" = None


class ChatDetailResponse(ChatResponse):
    messages: list[MessageResponse]
