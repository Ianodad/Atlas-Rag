from celery import Celery

from .config import get_settings

settings = get_settings()
redis_url = f"redis://{settings.redis_host}:{settings.redis_port}/0"

celery_app = Celery("atlas-rag-worker", broker=redis_url, backend=redis_url)
celery_app.conf.update(
    broker_connection_retry_on_startup=True,
    result_expires=3600,
    task_default_queue=settings.worker_document_queue,
    task_track_started=True,
)
