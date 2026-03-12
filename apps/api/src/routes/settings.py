from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_current_user, get_project_service
from ..schemas.auth import CurrentUser
from ..schemas.projects import ProjectSettingsResponse, ProjectSettingsUpdate
from ..services.projects import ProjectService

router = APIRouter(prefix="/projects/{project_id}/settings", tags=["project-settings"])


@router.get("", response_model=ProjectSettingsResponse)
def get_project_settings(
    project_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> ProjectSettingsResponse:
    settings = service.get_project_settings(project_id, current_user.id)
    if settings is None:
        raise HTTPException(status_code=404, detail="Project settings not found")
    return settings


@router.put("", response_model=ProjectSettingsResponse)
def update_project_settings(
    project_id: str,
    payload: ProjectSettingsUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> ProjectSettingsResponse:
    settings = service.update_project_settings(project_id, current_user.id, payload)
    if settings is None:
        raise HTTPException(status_code=404, detail="Project settings not found")
    return settings
