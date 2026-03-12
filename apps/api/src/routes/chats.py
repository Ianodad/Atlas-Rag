from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import get_chat_service, get_current_user
from ..schemas.auth import CurrentUser
from ..schemas.chats import ChatCreate, ChatDetailResponse, ChatResponse, MessageCreate, MessageResponse
from ..services.chats import ChatService

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


@router.delete("/chats/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat(
    chat_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    service: ChatService = Depends(get_chat_service),
) -> None:
    deleted = service.delete_chat(chat_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat not found")


@router.post("/chats/{chat_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def create_chat_message(
    chat_id: str,
    payload: MessageCreate,
    current_user: CurrentUser = Depends(get_current_user),
    service: ChatService = Depends(get_chat_service),
) -> MessageResponse:
    message = service.create_message(chat_id, current_user.id, payload)
    if message is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    return message
