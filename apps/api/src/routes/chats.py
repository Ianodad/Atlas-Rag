from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from ..dependencies import get_chat_service, get_current_user, get_rag_service
from ..schemas.auth import CurrentUser
from ..schemas.chats import ChatCreate, ChatDetailResponse, ChatRename, ChatResponse, MessageCreate, MessageResponse
from ..services.chats import ChatService
from ..services.rag import RagService

# Routing decision (Phase 5):
# Messages live at /chats/{chat_id}/messages, not /projects/{id}/chats/{id}/messages.
# chat_id is globally unique and already encodes project ownership, so repeating
# project_id in the path is redundant.
#
# Phase 13: POST /chats/{chat_id}/messages returns SSE (text/event-stream).
# Events: status | token | error | done
router = APIRouter(tags=["chats"])


@router.get("/projects/{project_id}/chats", response_model=list[ChatResponse])
def list_project_chats(
    project_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    service: ChatService = Depends(get_chat_service),
) -> list[ChatResponse]:
    return service.list_chats(project_id, current_user.id)


@router.post("/projects/{project_id}/chats", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
def create_project_chat(
    project_id: str,
    payload: ChatCreate,
    current_user: CurrentUser = Depends(get_current_user),
    service: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    chat = service.create_chat(project_id, current_user.id, payload)
    if chat is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return chat


@router.get("/chats/{chat_id}", response_model=ChatDetailResponse)
def get_chat(
    chat_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    service: ChatService = Depends(get_chat_service),
) -> ChatDetailResponse:
    chat = service.get_chat(chat_id, current_user.id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


@router.patch("/chats/{chat_id}", response_model=ChatResponse)
def rename_chat(
    chat_id: str,
    payload: ChatRename,
    current_user: CurrentUser = Depends(get_current_user),
    service: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    chat = service.rename_chat(chat_id, current_user.id, payload)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


@router.delete("/chats/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat(
    chat_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    service: ChatService = Depends(get_chat_service),
) -> None:
    deleted = service.delete_chat(chat_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat not found")


@router.post("/chats/{chat_id}/messages")
async def create_chat_message(
    chat_id: str,
    payload: MessageCreate,
    current_user: CurrentUser = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service),
    rag_service: RagService = Depends(get_rag_service),
) -> StreamingResponse:
    """
    Stream a RAG answer as Server-Sent Events.

    Events:
    - status  {"status": "..."}          — phase announcements
    - token   {"content": "..."}         — streamed answer tokens
    - error   {"message": "..."}         — non-fatal error description
    - done    {"answer": "...", "citations": [...]}  — completion
    """
    # Verify chat ownership
    chat = chat_service.get_chat(chat_id, current_user.id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")

    project_id = str(chat["project_id"])
    project_settings = rag_service.get_project_settings(project_id) or {}

    # Persist user message first
    user_msg = rag_service.save_message(chat_id, "user", payload.content, [])

    history = rag_service.get_chat_history(
        chat_id, exclude_message_id=user_msg["id"] if user_msg else None
    )

    async def event_stream():
        full_answer = ""
        citations = []
        async for chunk in rag_service.stream_answer(
            chat_id, payload.content, project_id, project_settings, history
        ):
            yield chunk
            # Track done payload so we can persist the assistant message
            if chunk.startswith("event: done"):
                import json as _json
                data_line = [l for l in chunk.splitlines() if l.startswith("data:")]
                if data_line:
                    try:
                        payload_data = _json.loads(data_line[0][len("data:"):].strip())
                        full_answer = payload_data.get("answer", "")
                        citations = payload_data.get("citations", [])
                    except Exception:
                        pass

        if full_answer:
            rag_service.save_message(chat_id, "assistant", full_answer, citations)

    return StreamingResponse(event_stream(), media_type="text/event-stream")
