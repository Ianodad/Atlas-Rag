from celery import Celery

from ..config import Settings, get_settings


class DocumentQueueError(RuntimeError):
    pass


class DocumentQueueService:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        redis_url = f"redis://{self.settings.redis_host}:{self.settings.redis_port}/0"
        self._celery = Celery("atlas-rag-api", broker=redis_url, backend=redis_url)

    def enqueue_process_document(self, document_id: str) -> str:
        try:
            result = self._celery.send_task(
                self.settings.worker_process_document_task,
                args=[document_id],
                queue=self.settings.worker_document_queue,
            )
        except Exception as exc:
            raise DocumentQueueError(f"Failed to enqueue document {document_id}: {exc}") from exc
        return result.id
