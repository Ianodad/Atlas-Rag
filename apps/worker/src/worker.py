from . import tasks  # noqa: F401
from .celery_app import celery_app
from .config import get_settings


def main() -> None:
    settings = get_settings()
    celery_app.worker_main(
        [
            "worker",
            "--loglevel=INFO",
            "--queues",
            settings.worker_document_queue,
        ]
    )


if __name__ == "__main__":
    main()
