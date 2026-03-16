from __future__ import annotations

from collections import Counter
from typing import Any, TypedDict

from .partitioning import PartitionElement

SOFT_LIMIT = 2400
HARD_LIMIT = 2800
MIN_CHUNK_CHARS = 350
OVERLAP_CHARS = 200


class ChunkRecord(TypedDict):
    chunk_index: int
    retrieval_text: str
    original_content: dict[str, Any]
    modality_flags: list[str]
    page_number: int | None
    token_count: int
    metadata: dict[str, Any]
    element_type: dict[str, Any]


class ChunkDiagnostics(TypedDict):
    chunk_count: int
    chunks_by_modality: dict[str, int]
    average_chunk_chars: int
    max_chunk_chars: int


def _is_textual(element_type: str) -> bool:
    return element_type in {"title", "paragraph"}


def _split_large_text(text: str, limit: int) -> list[str]:
    stripped = text.strip()
    if len(stripped) <= limit:
        return [stripped] if stripped else []

    segments: list[str] = []
    remaining = stripped
    while len(remaining) > limit:
        split_at = remaining.rfind("\n", 0, limit)
        if split_at < max(limit // 2, 1):
            split_at = remaining.rfind(". ", 0, limit)
        if split_at < max(limit // 2, 1):
            split_at = remaining.rfind(" ", 0, limit)
        if split_at < max(limit // 2, 1):
            split_at = limit

        part = remaining[:split_at].strip()
        if part:
            segments.append(part)
        remaining = remaining[split_at:].strip()

    if remaining:
        segments.append(remaining)
    return segments


def _materialize_element_parts(element: PartitionElement) -> list[PartitionElement]:
    text = element["text"].strip()
    if not text:
        fallback_text = element["type"]
        if element["type"] == "table":
            fallback_text = "Table content"
        elif element["type"] == "image":
            fallback_text = "Image content"
        text = fallback_text

    if len(text) <= HARD_LIMIT:
        return [{**element, "text": text}]

    parts = _split_large_text(text, HARD_LIMIT)
    materialized: list[PartitionElement] = []
    for idx, part in enumerate(parts):
        metadata = dict(element.get("metadata") or {})
        metadata["part_index"] = idx
        metadata["part_count"] = len(parts)
        materialized.append(
            {
                **element,
                "text": part,
                "metadata": metadata,
            }
        )
    return materialized


def _chunk_page_number(elements: list[PartitionElement]) -> int | None:
    for element in elements:
        page_number = element.get("page_number")
        if page_number is not None:
            return page_number
    return None


def _modality_flags(elements: list[PartitionElement]) -> list[str]:
    flags = []
    if any(_is_textual(element["type"]) for element in elements):
        flags.append("text")
    if any(element["type"] == "table" for element in elements):
        flags.append("table")
    if any(element["type"] == "image" for element in elements):
        flags.append("image")
    return flags or ["text"]


def _retrieval_text(elements: list[PartitionElement]) -> str:
    parts = [element["text"].strip() for element in elements if element["text"].strip()]
    text = "\n\n".join(parts).strip()
    if text:
        return text
    flags = _modality_flags(elements)
    return " ".join(flag.title() for flag in flags) + " content"


def _original_content(section_title: str | None, elements: list[PartitionElement]) -> dict[str, Any]:
    return {
        "section_title": section_title,
        "elements": [
            {
                "type": element["type"],
                "text": element["text"],
                "table_html": element["table_html"],
                "image_base64": element["image_base64"],
                "page_number": element["page_number"],
                "source_element_id": element["source_element_id"],
                "element_type": element["element_type"],
                "metadata": element["metadata"],
            }
            for element in elements
        ],
    }


def _element_type(elements: list[PartitionElement]) -> dict[str, Any]:
    raw = [dict(element["element_type"]) for element in elements]
    categories = []
    for item in raw:
        category = item.get("category")
        if category and category not in categories:
            categories.append(category)
    return {
        "primary": categories[0] if categories else "Unknown",
        "categories": categories,
        "elements": raw,
    }


def _chunk_metadata(section_title: str | None, elements: list[PartitionElement], retrieval_text: str) -> dict[str, Any]:
    return {
        "section_title": section_title,
        "source_element_ids": [element["source_element_id"] for element in elements if element.get("source_element_id")],
        "element_count": len(elements),
        "char_count": len(retrieval_text),
    }


def _append_chunk(
    chunks: list[ChunkRecord],
    elements: list[PartitionElement],
    section_title: str | None,
) -> None:
    if not elements:
        return
    retrieval_text = _retrieval_text(elements)
    chunks.append(
        {
            "chunk_index": len(chunks),
            "retrieval_text": retrieval_text,
            "original_content": _original_content(section_title, elements),
            "modality_flags": _modality_flags(elements),
            "page_number": _chunk_page_number(elements),
            "token_count": len(retrieval_text.split()),
            "metadata": _chunk_metadata(section_title, elements, retrieval_text),
            "element_type": _element_type(elements),
        }
    )


def _should_flush(current: list[PartitionElement], candidate: PartitionElement) -> bool:
    if not current:
        return False
    current_text = _retrieval_text(current)
    candidate_text = candidate["text"].strip()
    next_length = len(current_text) + 2 + len(candidate_text)
    if next_length > HARD_LIMIT:
        return True
    if next_length > SOFT_LIMIT and candidate["type"] == "title":
        return True
    if next_length > SOFT_LIMIT and not _is_textual(candidate["type"]):
        return True
    return False


def _chunk_body(chunk: ChunkRecord) -> str:
    """Raw element text with no prefix — used as overlap source."""
    elements = chunk["original_content"]["elements"]
    parts = [str(e.get("text") or "").strip() for e in elements if str(e.get("text") or "").strip()]
    return "\n\n".join(parts) or chunk["retrieval_text"]


def _overlap_tail(body: str) -> str:
    """Last OVERLAP_CHARS of body, trimmed to a clean word boundary."""
    if len(body) <= OVERLAP_CHARS:
        return ""
    tail = body[-OVERLAP_CHARS:]
    space = tail.find(" ")
    if 0 < space < len(tail) // 2:
        tail = tail[space + 1:]
    return tail.strip()


def _apply_context_enrichment(chunks: list[ChunkRecord]) -> list[ChunkRecord]:
    """
    Post-processing pass that applies two improvements to retrieval_text:
      1. Prepend section title so the embedding captures where in the document
         this chunk lives (e.g. "Introduction\n\n<body>").
      2. Prepend a short tail from the previous chunk to bridge content that
         spans a chunk boundary (overlap window = OVERLAP_CHARS chars).
    original_content is left untouched — it always holds the raw source elements.
    """
    enriched: list[ChunkRecord] = []
    for i, chunk in enumerate(chunks):
        section_title = chunk["metadata"].get("section_title")
        body = _chunk_body(chunk)

        overlap = ""
        if i > 0:
            prev_body = _chunk_body(chunks[i - 1])
            overlap = _overlap_tail(prev_body)

        parts: list[str] = []
        if section_title:
            parts.append(section_title)
        if overlap:
            parts.append(f"[…] {overlap}")
        parts.append(body)
        retrieval_text = "\n\n".join(parts)

        enriched.append({
            **chunk,
            "retrieval_text": retrieval_text,
            "token_count": len(retrieval_text.split()),
            "metadata": {
                **chunk["metadata"],
                "char_count": len(retrieval_text),
                "has_overlap": bool(overlap),
            },
        })
    return enriched


def build_chunks(elements: list[PartitionElement]) -> tuple[list[ChunkRecord], ChunkDiagnostics]:
    chunks: list[ChunkRecord] = []
    current_elements: list[PartitionElement] = []
    current_section_title: str | None = None

    materialized: list[PartitionElement] = []
    for element in elements:
        materialized.extend(_materialize_element_parts(element))

    for element in materialized:
        if element["type"] == "title":
            if current_elements:
                _append_chunk(chunks, current_elements, current_section_title)
                current_elements = []
            current_section_title = element["text"].strip() or current_section_title

        if _should_flush(current_elements, element):
            _append_chunk(chunks, current_elements, current_section_title)
            current_elements = []

        current_elements.append(element)

    if current_elements:
        _append_chunk(chunks, current_elements, current_section_title)

    merged_chunks: list[ChunkRecord] = []
    pending: ChunkRecord | None = None
    for chunk in chunks:
        if pending is None:
            pending = chunk
            continue

        if (
            len(pending["retrieval_text"]) < MIN_CHUNK_CHARS
            and pending["metadata"].get("section_title") == chunk["metadata"].get("section_title")
            and len(pending["retrieval_text"]) + len(chunk["retrieval_text"]) <= HARD_LIMIT
        ):
            combined_elements = pending["original_content"]["elements"] + chunk["original_content"]["elements"]
            section_title = pending["metadata"].get("section_title")
            combined_retrieval_text = _retrieval_text(combined_elements)
            pending = {
                "chunk_index": pending["chunk_index"],
                "retrieval_text": combined_retrieval_text,
                "original_content": _original_content(section_title, combined_elements),
                "modality_flags": _modality_flags(combined_elements),
                "page_number": pending["page_number"] or chunk["page_number"],
                "token_count": len(combined_retrieval_text.split()),
                "metadata": _chunk_metadata(section_title, combined_elements, combined_retrieval_text),
                "element_type": _element_type(combined_elements),
            }
            continue

        merged_chunks.append(pending)
        pending = chunk

    if pending is not None:
        merged_chunks.append(pending)

    finalized: list[ChunkRecord] = []
    for idx, chunk in enumerate(merged_chunks):
        finalized.append({**chunk, "chunk_index": idx})

    finalized = _apply_context_enrichment(finalized)

    counts = Counter()
    for chunk in finalized:
        for flag in chunk["modality_flags"]:
            counts[flag] += 1

    char_lengths = [len(chunk["retrieval_text"]) for chunk in finalized]
    diagnostics: ChunkDiagnostics = {
        "chunk_count": len(finalized),
        "chunks_by_modality": dict(counts),
        "average_chunk_chars": int(sum(char_lengths) / len(char_lengths)) if char_lengths else 0,
        "max_chunk_chars": max(char_lengths, default=0),
    }
    return finalized, diagnostics
