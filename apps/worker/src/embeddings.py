from __future__ import annotations

import time
from typing import Any

from .chunking import ChunkRecord
from .config import Settings, get_settings

_BATCH_SIZE = 10
_MAX_RETRIES = 3
_RETRY_DELAY_BASE = 2.0
_DEFAULT_MODEL = "text-embedding-3-small"
_DIMENSIONS = 1536


class EmbeddingDiagnostics(dict[str, Any]):
    pass


def generate_embeddings(
    chunks: list[ChunkRecord],
    project_settings: dict[str, Any] | None,
    settings: Settings | None = None,
) -> tuple[list[list[float] | None], dict[str, Any]]:
    """Return a list of embedding vectors (or None on skip) aligned with chunks."""
    cfg = settings or get_settings()
    if cfg.openai_api_key is None:
        return [None] * len(chunks), {"skipped": True, "reason": "no_api_key"}

    try:
        from openai import OpenAI
    except ImportError:
        return [None] * len(chunks), {"skipped": True, "reason": "openai_not_installed"}

    model = _resolve_model(project_settings)
    client = OpenAI(api_key=cfg.openai_api_key.get_secret_value())

    texts = [chunk["retrieval_text"] for chunk in chunks]
    embeddings: list[list[float] | None] = []
    total_tokens = 0

    for batch_start in range(0, len(texts), _BATCH_SIZE):
        batch = texts[batch_start : batch_start + _BATCH_SIZE]
        result, tokens = _embed_batch_with_retry(client, batch, model)
        embeddings.extend(result)
        total_tokens += tokens

    diagnostics: dict[str, Any] = {
        "model": model,
        "chunk_count": len(chunks),
        "embedded_count": sum(1 for e in embeddings if e is not None),
        "total_tokens": total_tokens,
    }
    return embeddings, diagnostics


def _resolve_model(project_settings: dict[str, Any] | None) -> str:
    if not project_settings:
        return _DEFAULT_MODEL
    model = str(project_settings.get("embedding_model") or _DEFAULT_MODEL)
    return model


def _embed_batch_with_retry(
    client: Any,
    texts: list[str],
    model: str,
) -> tuple[list[list[float] | None], int]:
    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            response = client.embeddings.create(
                model=model,
                input=texts,
                dimensions=_DIMENSIONS,
            )
            vectors = [item.embedding for item in response.data]
            tokens = response.usage.total_tokens if response.usage else 0
            return vectors, tokens
        except Exception as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES - 1:
                time.sleep(_RETRY_DELAY_BASE * (attempt + 1))

    # On complete failure return Nones so worker can still complete
    return [None] * len(texts), 0
