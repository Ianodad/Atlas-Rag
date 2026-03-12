from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_current_user, get_project_service
from ..schemas.auth import CurrentUser
from ..schemas.projects import ProjectDocumentResponse
from ..services.projects import ProjectService

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
