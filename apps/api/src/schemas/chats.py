from typing import Any
from typing import Literal

from .base import ApiModel


class ChatCreate(ApiModel):
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


class ChatDetailResponse(ChatResponse):
    messages: list[MessageResponse]
