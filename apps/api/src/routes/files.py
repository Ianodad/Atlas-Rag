from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import get_current_user, get_project_service
from ..schemas.auth import CurrentUser
from ..schemas.projects import (
    ProjectDocumentResponse,
    ProjectFileConfirm,
    ProjectFileUploadUrlCreate,
    ProjectFileUploadUrlResponse,
)
from ..services.projects import DocumentEnqueueError, ProjectService

router = APIRouter(prefix="/projects/{project_id}/files", tags=["project-files"])


@router.get("", response_model=list[ProjectDocumentResponse])
def list_project_files(
    project_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> list[ProjectDocumentResponse]:
    return service.list_project_documents(project_id, current_user.id)


@router.get("/{file_id}", response_model=ProjectDocumentResponse)
def get_project_file(
    project_id: str,
    file_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> ProjectDocumentResponse:
    document = service.get_project_document(project_id, file_id, current_user.id)
    if document is None:
        raise HTTPException(status_code=404, detail="Project document not found")
    return document


@router.post("/upload-url", response_model=ProjectFileUploadUrlResponse, status_code=status.HTTP_201_CREATED)
def create_project_file_upload_url(
    project_id: str,
    payload: ProjectFileUploadUrlCreate,
    current_user: CurrentUser = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> ProjectFileUploadUrlResponse:
    try:
        upload = service.create_project_file_upload_url(project_id, current_user.id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=f"Storage upload URL generation failed: {exc}") from exc

    if upload is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return upload


@router.post("/confirm", response_model=ProjectDocumentResponse, status_code=status.HTTP_201_CREATED)
def confirm_project_file_upload(
    project_id: str,
    payload: ProjectFileConfirm,
    current_user: CurrentUser = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> ProjectDocumentResponse:
    try:
        document = service.confirm_project_file_upload(project_id, current_user.id, payload)
    except DocumentEnqueueError as exc:
        raise HTTPException(status_code=503, detail=f"Document job enqueue failed: {exc}") from exc
    if document is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return document


@router.post("/{file_id}/reprocess", response_model=ProjectDocumentResponse)
def reprocess_project_file(
    project_id: str,
    file_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> ProjectDocumentResponse:
    try:
        document = service.reprocess_document(project_id, file_id, current_user.id)
    except DocumentEnqueueError as exc:
        raise HTTPException(status_code=503, detail=f"Document job enqueue failed: {exc}") from exc
    if document is None:
        raise HTTPException(status_code=404, detail="Project document not found")
    return document


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_file(
    project_id: str,
    file_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> None:
    deleted = service.delete_project_document(project_id, file_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project document not found")
