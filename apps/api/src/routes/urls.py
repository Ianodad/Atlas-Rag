from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import get_current_user, get_project_service
from ..schemas.auth import CurrentUser
from ..schemas.projects import ProjectDocumentResponse, ProjectUrlCreate
from ..services.projects import DocumentEnqueueError, ProjectService

router = APIRouter(prefix="/projects/{project_id}/urls", tags=["project-urls"])


@router.post("", response_model=ProjectDocumentResponse, status_code=status.HTTP_201_CREATED)
def create_project_url_document(
    project_id: str,
    payload: ProjectUrlCreate,
    current_user: CurrentUser = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> ProjectDocumentResponse:
    try:
        document = service.create_project_url_document(project_id, current_user.id, payload)
    except DocumentEnqueueError as exc:
        raise HTTPException(status_code=503, detail=f"Document job enqueue failed: {exc}") from exc
    if document is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return document
