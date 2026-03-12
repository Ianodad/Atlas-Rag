from typing import Any

from fastapi import HTTPException
from supabase import Client


def execute_data(query: Any) -> list[dict[str, Any]]:
    response = query.execute()
    return response.data or []


def first_or_none(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    return rows[0] if rows else None


def ensure_owner(project: dict[str, Any] | None, user_id: str) -> dict[str, Any] | None:
    if project is None:
        return None
    if project["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def fetch_project(client: Client, project_id: str, user_id: str) -> dict[str, Any] | None:
    rows = execute_data(
        client.table("projects")
        .select("*")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .limit(1)
    )
    return first_or_none(rows)
