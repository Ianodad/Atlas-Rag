from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import get_current_user, get_project_service
from ..schemas.auth import CurrentUser
from ..schemas.projects import ProjectCreate, ProjectResponse
from ..services.projects import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    current_user: CurrentUser = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> list[ProjectResponse]:
    return service.list_projects(current_user.id)


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    current_user: CurrentUser = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> ProjectResponse:
    return service.create_project(current_user.id, payload)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> ProjectResponse:
    project = service.get_project(project_id, current_user.id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> None:
    deleted = service.delete_project(project_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
