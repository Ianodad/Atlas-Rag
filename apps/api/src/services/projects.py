from datetime import UTC, datetime
import re
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

from supabase import Client
from storage3.exceptions import StorageException

from ..config import Settings, get_settings
from ..schemas.projects import (
    ProjectCreate,
    ProjectFileConfirm,
    ProjectFileUploadUrlCreate,
    ProjectSettingsUpdate,
    ProjectUrlCreate,
)
from .common import execute_data, fetch_project, first_or_none
from .jobs import DocumentQueueError, DocumentQueueService


class DocumentEnqueueError(RuntimeError):
    pass


class ProjectService:
    def __init__(
        self,
        client: Client,
        settings: Settings | None = None,
        queue_service: DocumentQueueService | None = None,
    ):
        self.client = client
        self.settings = settings or get_settings()
        self.queue_service = queue_service or DocumentQueueService(self.settings)

    @staticmethod
    def _timestamp() -> str:
        return datetime.now(UTC).isoformat().replace("+00:00", "Z")

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", filename.strip()).strip(".-")
        return cleaned or "document"

    def _build_storage_path(self, project_id: str, filename: str) -> str:
        safe_filename = self._sanitize_filename(PurePosixPath(filename).name)
        return f"projects/{project_id}/{uuid4()}-{safe_filename}"

    def _queued_processing_details(
        self,
        source: str,
        size_bytes: int | None = None,
        extra: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        details: dict[str, Any] = {
            "phase": "queued",
            "queueStatus": "pending-enqueue",
            "source": source,
            "fakeProcessing": True,
        }
        if size_bytes is not None:
            details["sizeBytes"] = size_bytes
        if extra:
            details.update(extra)
        return details

    def _update_document(
        self,
        document_id: str,
        values: dict[str, Any],
    ) -> dict[str, Any]:
        rows = execute_data(
            self.client.table("project_documents")
            .update(values)
            .eq("id", document_id)
        )
        if not rows:
            raise RuntimeError(f"Document {document_id} disappeared during queue lifecycle")
        return rows[0]

    def _enqueue_document(self, document: dict[str, Any]) -> dict[str, Any]:
        current_details = dict(document.get("processing_details") or {})

        try:
            task_id = self.queue_service.enqueue_process_document(document["id"])
        except DocumentQueueError as exc:
            failed_details = {
                **current_details,
                "phase": "queue_failed",
                "queueStatus": "enqueue_failed",
                "failedAt": self._timestamp(),
                "error": str(exc),
            }
            self._update_document(
                document["id"],
                {
                    "processing_status": "failed",
                    "processing_details": failed_details,
                },
            )
            raise DocumentEnqueueError(str(exc)) from exc

        queued_details = {
            **current_details,
            "phase": "queued",
            "queueStatus": "queued",
            "taskId": task_id,
            "enqueuedAt": self._timestamp(),
        }
        return self._update_document(
            document["id"],
            {
                "task_id": task_id,
                "processing_status": "queued",
                "processing_details": queued_details,
            },
        )

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
        )
        project = rows[0]

        settings_rows = execute_data(
            self.client.table("project_settings")
            .select("*")
            .eq("project_id", project["id"])
            .limit(1)
        )
        if not settings_rows:
            raise RuntimeError("Project created but default settings row was not created")

        return project

    def get_project(self, project_id: str, user_id: str) -> dict[str, Any] | None:
        return fetch_project(self.client, project_id, user_id)

    def delete_project(self, project_id: str, user_id: str) -> bool:
        project = self.get_project(project_id, user_id)
        if project is None:
            return False

        # Clean up storage objects before removing the DB rows
        documents = execute_data(
            self.client.table("project_documents")
            .select("storage_bucket, storage_path")
            .eq("project_id", project_id)
        )
        paths_by_bucket: dict[str, list[str]] = {}
        for doc in documents:
            bucket = doc.get("storage_bucket")
            path = doc.get("storage_path")
            if bucket and path:
                paths_by_bucket.setdefault(bucket, []).append(path)
        for bucket, paths in paths_by_bucket.items():
            try:
                self.client.storage.from_(bucket).remove(paths)
            except StorageException:
                pass  # Keep deletion idempotent if objects are already gone

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

    def create_project_file_upload_url(
        self,
        project_id: str,
        user_id: str,
        payload: ProjectFileUploadUrlCreate,
    ) -> dict[str, Any] | None:
        project = self.get_project(project_id, user_id)
        if project is None:
            return None

        storage_bucket = self.settings.storage_bucket_documents
        storage_path = self._build_storage_path(project_id, payload.filename)

        try:
            signed_upload = self.client.storage.from_(storage_bucket).create_signed_upload_url(storage_path)
        except StorageException as exc:
            raise ValueError(str(exc)) from exc

        return {
            "upload_url": signed_upload["signedUrl"],
            "storage_bucket": storage_bucket,
            "storage_path": storage_path,
            "token": signed_upload["token"],
        }

    def confirm_project_file_upload(
        self,
        project_id: str,
        user_id: str,
        payload: ProjectFileConfirm,
    ) -> dict[str, Any] | None:
        project = self.get_project(project_id, user_id)
        if project is None:
            return None

        rows = execute_data(
            self.client.table("project_documents")
            .insert(
                {
                    "project_id": project_id,
                    "task_id": None,
                    "filename": payload.filename,
                    "mime_type": payload.mime_type,
                    "storage_bucket": payload.storage_bucket,
                    "storage_path": payload.storage_path,
                    "source_type": "file",
                    "processing_status": "queued",
                    "processing_details": self._queued_processing_details(
                        source="file",
                        size_bytes=payload.size_bytes,
                    ),
                    "metadata": payload.metadata,
                }
            )
        )
        return self._enqueue_document(rows[0])

    def delete_project_document(self, project_id: str, file_id: str, user_id: str) -> bool:
        document = self.get_project_document(project_id, file_id, user_id)
        if document is None:
            return False

        if document.get("storage_bucket") and document.get("storage_path"):
            try:
                self.client.storage.from_(document["storage_bucket"]).remove([document["storage_path"]])
            except StorageException:
                # Keep DB delete idempotent even if the object has already been removed.
                pass

        self.client.table("project_documents").delete().eq("project_id", project_id).eq("id", file_id).execute()
        return True

    def reprocess_document(self, project_id: str, file_id: str, user_id: str) -> dict[str, Any] | None:
        document = self.get_project_document(project_id, file_id, user_id)
        if document is None:
            return None
        # Reset status so the worker processes it fresh
        self.client.table("document_chunks").delete().eq("document_id", file_id).execute()
        reset = self._update_document(
            file_id,
            {
                "processing_status": "queued",
                "processing_details": self._queued_processing_details(
                    source=document.get("source_type", "file"),
                    extra={"reprocessedAt": self._timestamp()},
                ),
                "task_id": None,
            },
        )
        return self._enqueue_document(reset)

    def create_project_url_document(
        self,
        project_id: str,
        user_id: str,
        payload: ProjectUrlCreate,
    ) -> dict[str, Any] | None:
        project = self.get_project(project_id, user_id)
        if project is None:
            return None

        parsed_url = urlparse(str(payload.url))
        filename = payload.title or parsed_url.netloc or str(payload.url)

        rows = execute_data(
            self.client.table("project_documents")
            .insert(
                {
                    "project_id": project_id,
                    "task_id": None,
                    "filename": filename,
                    "source_type": "url",
                    "source_url": str(payload.url),
                    "processing_status": "queued",
                    "processing_details": self._queued_processing_details(
                        source="url",
                        extra={"fetcher": "httpx", "scrapingBeeConfigured": self.settings.scrapingbee_api_key is not None},
                    ),
                    "metadata": {},
                }
            )
        )
        return self._enqueue_document(rows[0])
