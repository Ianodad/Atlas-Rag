import logging
from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from .celery_app import celery_app
from .chunking import build_chunks
from .config import get_settings
from .embeddings import generate_embeddings
from .partitioning import build_partition_diagnostics, parse_file, parse_url
from .summarization import ChunkSummarizer
from .supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


def _timestamp() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _fetch_document(document_id: str) -> dict[str, Any] | None:
    response = (
        get_supabase_client()
        .table("project_documents")
        .select("*")
        .eq("id", document_id)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


def _update_document(document_id: str, values: dict[str, Any]) -> dict[str, Any]:
    response = get_supabase_client().table("project_documents").update(values).eq("id", document_id).execute()
    rows = response.data or []
    if not rows:
        raise RuntimeError(f"Document {document_id} not found during worker update")
    return rows[0]


def _fetch_project_settings(project_id: str) -> dict[str, Any] | None:
    response = (
        get_supabase_client()
        .table("project_settings")
        .select("*")
        .eq("project_id", project_id)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


def _download_file(document: dict[str, Any], destination: Path) -> Path:
    storage_bucket = document.get("storage_bucket")
    storage_path = document.get("storage_path")
    if not storage_bucket or not storage_path:
        raise RuntimeError("Document is missing storage bucket or storage path")

    file_bytes = get_supabase_client().storage.from_(storage_bucket).download(storage_path)
    local_path = destination / Path(storage_path).name
    local_path.write_bytes(file_bytes)
    return local_path


def _fetch_url_html(source_url: str) -> str:
    try:
        import httpx
    except ImportError:
        from urllib.request import urlopen

        with urlopen(source_url, timeout=30) as response:
            return response.read().decode("utf-8", errors="ignore")

    with httpx.Client(follow_redirects=True, timeout=30.0) as client:
        response = client.get(source_url)
        response.raise_for_status()
        return response.text


def _partition_document(document: dict[str, Any]) -> tuple[str, list[dict[str, Any]], dict[str, Any]]:
    settings = get_settings()
    source_type = document.get("source_type")
    if source_type == "file":
        with TemporaryDirectory(prefix="atlas-rag-partition-") as temp_dir:
            local_path = _download_file(document, Path(temp_dir))
            parser_name, elements = parse_file(str(local_path), document.get("mime_type"), settings)
    elif source_type == "url":
        source_url = document.get("source_url")
        if not source_url:
            raise RuntimeError("URL document is missing source_url")
        html = _fetch_url_html(source_url)
        parser_name, elements = parse_url(html, source_url, settings)
    else:
        raise RuntimeError(f"Unsupported source type: {source_type}")

    diagnostics = build_partition_diagnostics(parser_name, elements)
    preview = [
        {
            "type": element["type"],
            "pageNumber": element["page_number"],
            "textPreview": element["text"][:200],
            "sourceElementId": element["source_element_id"],
        }
        for element in elements[:10]
    ]
    return parser_name, elements, {**diagnostics, "preview": preview}


def _replace_document_chunks(
    document: dict[str, Any],
    chunks: list[dict[str, Any]],
    embeddings: list[list[float] | None],
) -> None:
    client = get_supabase_client()
    client.table("document_chunks").delete().eq("document_id", document["id"]).execute()

    if not chunks:
        return

    rows = [
        {
            "project_id": document["project_id"],
            "document_id": document["id"],
            "chunk_index": chunk["chunk_index"],
            "retrieval_text": chunk["retrieval_text"],
            "original_content": chunk["original_content"],
            "modality_flags": chunk["modality_flags"],
            "page_number": chunk["page_number"],
            "token_count": chunk["token_count"],
            "metadata": chunk["metadata"],
            "element_type": chunk["element_type"],
            **({"embedding": embeddings[i]} if embeddings[i] is not None else {}),
        }
        for i, chunk in enumerate(chunks)
    ]
    client.table("document_chunks").insert(rows).execute()


@celery_app.task(bind=True, name=get_settings().worker_process_document_task)
def process_document(self, document_id: str) -> dict[str, str]:
    document = _fetch_document(document_id)
    if document is None:
        logger.warning("Skipping missing document %s", document_id)
        return {"document_id": document_id, "status": "missing"}
    project_settings = _fetch_project_settings(document["project_id"])

    task_id = self.request.id
    current_details = dict(document.get("processing_details") or {})
    processing_details = {
        **current_details,
        "phase": "processing",
        "queueStatus": "processing",
        "taskId": task_id,
        "startedAt": _timestamp(),
        "attempt": self.request.retries + 1,
        "worker": "celery",
    }
    _update_document(
        document_id,
        {
            "task_id": task_id,
            "processing_status": "processing",
            "processing_details": processing_details,
        },
    )

    failure_context = processing_details
    try:
        partitioning_details = {
            **processing_details,
            "phase": "partitioning",
            "queueStatus": "processing",
            "partitioningStartedAt": _timestamp(),
        }
        failure_context = partitioning_details
        _update_document(
            document_id,
            {
                "task_id": task_id,
                "processing_status": "partitioning",
                "processing_details": partitioning_details,
            },
        )

        parser_name, elements, diagnostics = _partition_document(document)
        chunking_details = {
            **partitioning_details,
            "phase": "chunking",
            "queueStatus": "processing",
            "partitioning": {
                **diagnostics,
                "parser": parser_name,
                "elements": elements,
            },
            "chunkingStartedAt": _timestamp(),
        }
        failure_context = chunking_details
        _update_document(
            document_id,
            {
                "task_id": task_id,
                "processing_status": "chunking",
                "processing_details": chunking_details,
            },
        )

        chunks, chunk_diagnostics = build_chunks(elements)
        summarising_details = {
            **chunking_details,
            "phase": "summarising",
            "queueStatus": "processing",
            "chunking": {
                **chunk_diagnostics,
                "chunks": [
                    {
                        "chunkIndex": chunk["chunk_index"],
                        "pageNumber": chunk["page_number"],
                        "modalityFlags": chunk["modality_flags"],
                        "charCount": len(chunk["retrieval_text"]),
                        "sectionTitle": chunk["metadata"].get("section_title"),
                    }
                    for chunk in chunks[:10]
                ],
            },
            "summarisingStartedAt": _timestamp(),
        }
        failure_context = summarising_details
        _update_document(
            document_id,
            {
                "task_id": task_id,
                "processing_status": "summarising",
                "processing_details": summarising_details,
            },
        )

        summarized_chunks, summarization_diagnostics = ChunkSummarizer().summarize_chunks(chunks, project_settings)

        embedding_details = {
            **summarising_details,
            "phase": "embedding",
            "queueStatus": "processing",
            "summarisingCompletedAt": _timestamp(),
            "summarising": {
                **summarization_diagnostics,
                "chunks": [
                    {
                        "chunkIndex": chunk["chunk_index"],
                        "summaryApplied": chunk["metadata"].get("summary_applied"),
                        "summaryStrategy": chunk["metadata"].get("summary_strategy"),
                        "modalityFlags": chunk["modality_flags"],
                        "retrievalPreview": chunk["retrieval_text"][:240],
                    }
                    for chunk in summarized_chunks[:10]
                ],
            },
            "embeddingStartedAt": _timestamp(),
        }
        failure_context = embedding_details
        _update_document(
            document_id,
            {
                "task_id": task_id,
                "processing_status": "embedding",
                "processing_details": embedding_details,
            },
        )

        embeddings, embedding_diagnostics = generate_embeddings(summarized_chunks, project_settings)
        _replace_document_chunks(document, summarized_chunks, embeddings)
        completed_details = {
            **embedding_details,
            "phase": "completed",
            "queueStatus": "completed",
            "completedAt": _timestamp(),
            "processingMode": "phase-11-embedding",
            "embedding": embedding_diagnostics,
        }
        _update_document(
            document_id,
            {
                "task_id": task_id,
                "processing_status": "completed",
                "processing_details": completed_details,
                "page_count": diagnostics.get("page_count"),
            },
        )
    except Exception as exc:
        failed_details = {
            **failure_context,
            "phase": "failed",
            "queueStatus": "failed",
            "failedAt": _timestamp(),
            "error": str(exc),
        }
        _update_document(
            document_id,
            {
                "task_id": task_id,
                "processing_status": "failed",
                "processing_details": failed_details,
            },
        )
        raise

    return {"document_id": document_id, "status": "completed"}
