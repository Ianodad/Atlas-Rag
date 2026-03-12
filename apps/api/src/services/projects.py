from typing import Any

from supabase import Client

from ..schemas.projects import ProjectCreate, ProjectSettingsUpdate
from .common import execute_data, fetch_project, first_or_none


class ProjectService:
    def __init__(self, client: Client):
        self.client = client

    def list_projects(self, user_id: str) -> list[dict[str, Any]]:
        return execute_data(
            self.client.table("projects")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=False)
        )

    def create_project(self, user_id: str, payload: ProjectCreate) -> dict[str, Any]:
        rows = execute_data(
            self.client.table("projects")
            .insert(
                {
                    "user_id": user_id,
                    "name": payload.name,
                    "description": payload.description,
                }
            )
            .select("*")
        )
        return rows[0]

    def get_project(self, project_id: str, user_id: str) -> dict[str, Any] | None:
        return fetch_project(self.client, project_id, user_id)

    def delete_project(self, project_id: str, user_id: str) -> bool:
        project = self.get_project(project_id, user_id)
        if project is None:
            return False
        self.client.table("projects").delete().eq("id", project_id).eq("user_id", user_id).execute()
        return True

    def get_project_settings(self, project_id: str, user_id: str) -> dict[str, Any] | None:
        project = self.get_project(project_id, user_id)
        if project is None:
            return None
        rows = execute_data(
            self.client.table("project_settings")
            .select("*")
            .eq("project_id", project_id)
            .limit(1)
        )
        return first_or_none(rows)

    def update_project_settings(
        self,
        project_id: str,
        user_id: str,
        payload: ProjectSettingsUpdate,
    ) -> dict[str, Any] | None:
        project = self.get_project(project_id, user_id)
        if project is None:
            return None

        update_values = payload.model_dump(exclude_none=True, by_alias=False)
        if not update_values:
            return self.get_project_settings(project_id, user_id)

        rows = execute_data(
            self.client.table("project_settings")
            .update(update_values)
            .eq("project_id", project_id)
            .select("*")
        )
        return first_or_none(rows)

    def list_project_documents(self, project_id: str, user_id: str) -> list[dict[str, Any]]:
        project = self.get_project(project_id, user_id)
        if project is None:
            return []
        return execute_data(
            self.client.table("project_documents")
            .select("*")
            .eq("project_id", project_id)
            .order("created_at", desc=False)
        )

    def get_project_document(
        self,
        project_id: str,
        file_id: str,
        user_id: str,
    ) -> dict[str, Any] | None:
        project = self.get_project(project_id, user_id)
        if project is None:
            return None
        rows = execute_data(
            self.client.table("project_documents")
            .select("*")
            .eq("project_id", project_id)
            .eq("id", file_id)
            .limit(1)
        )
        return first_or_none(rows)
