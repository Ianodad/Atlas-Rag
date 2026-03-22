from __future__ import annotations

import time
from collections import Counter
from typing import Any, TypedDict

from .chunking import ChunkRecord
from .config import Settings, get_settings


class SummarizationDiagnostics(TypedDict):
    chunk_count: int
    summarized_chunk_count: int
    strategy_counts: dict[str, int]


class ChunkSummarizer:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    def summarize_chunks(
        self,
        chunks: list[ChunkRecord],
        project_settings: dict[str, Any] | None,
    ) -> tuple[list[ChunkRecord], SummarizationDiagnostics]:
        summarized: list[ChunkRecord] = []
        strategy_counts: Counter[str] = Counter()

        for chunk in chunks:
            updated = self._summarize_chunk(chunk, project_settings)
            strategy = str(updated["metadata"].get("summary_strategy") or "none")
            strategy_counts[strategy] += 1
            summarized.append(updated)

        diagnostics: SummarizationDiagnostics = {
            "chunk_count": len(chunks),
            "summarized_chunk_count": sum(
                1 for chunk in summarized if chunk["metadata"].get("summary_applied") is True
            ),
            "strategy_counts": dict(strategy_counts),
        }
        return summarized, diagnostics

    def _summarize_chunk(
        self,
        chunk: ChunkRecord,
        project_settings: dict[str, Any] | None,
    ) -> ChunkRecord:
        flags = set(chunk["modality_flags"])
        if not {"table", "image"} & flags:
            metadata = {
                **chunk["metadata"],
                "char_count": len(chunk["retrieval_text"]),
                "summary_applied": False,
                "summary_strategy": "direct_text",
            }
            return {
                **chunk,
                "token_count": len(chunk["retrieval_text"].split()),
                "metadata": metadata,
            }

        llm_summary = self._try_llm_summary(chunk, project_settings)
        if llm_summary is not None:
            retrieval_text = llm_summary
            strategy = "llm"
        else:
            retrieval_text = self._fallback_summary(chunk)
            strategy = "heuristic"

        metadata = {
            **chunk["metadata"],
            "char_count": len(retrieval_text),
            "summary_applied": True,
            "summary_strategy": strategy,
            "original_retrieval_text": chunk["retrieval_text"],
        }
        return {
            **chunk,
            "retrieval_text": retrieval_text,
            "token_count": len(retrieval_text.split()),
            "metadata": metadata,
        }

    def _try_llm_summary(
        self,
        chunk: ChunkRecord,
        project_settings: dict[str, Any] | None,
    ) -> str | None:
        provider = str((project_settings or {}).get("llm_provider") or "openai")
        model = str((project_settings or {}).get("llm_model") or "gpt-4.1-mini")
        if provider != "openai" or self.settings.openai_api_key is None:
            return None

        try:
            from openai import OpenAI
        except ImportError:
            return None

        prompt = self._build_summary_prompt(chunk)
        client = OpenAI(api_key=self.settings.openai_api_key.get_secret_value())

        _max_retries = 2
        for attempt in range(_max_retries + 1):
            try:
                response = client.responses.create(
                    model=model,
                    input=prompt,
                    max_output_tokens=220,
                )
                text = getattr(response, "output_text", "").strip()
                return text or None
            except Exception:
                if attempt < _max_retries:
                    time.sleep(1.0 * (attempt + 1))

        return None

    def _build_summary_prompt(self, chunk: ChunkRecord) -> str:
        elements = chunk["original_content"].get("elements", [])
        text_parts = [str(element.get("text") or "").strip() for element in elements if str(element.get("text") or "").strip()]
        table_parts = [str(element.get("table_html") or "").strip() for element in elements if element.get("table_html")]
        image_parts = [str(element.get("image_base64") or "").strip() for element in elements if element.get("image_base64")]
        text_block = "\n".join(text_parts) or "(none)"
        table_block = "\n\n".join(table_parts) or "(none)"
        image_block = "\n\n".join(image_parts) or "(none)"
        return "\n\n".join(
            [
                "Write concise retrieval text for a RAG system.",
                "Focus on facts users may search for. Mention the key entities, values, and relationships.",
                "Do not mention that this is a summary. Keep it grounded in the provided content.",
                f"Document section: {chunk['metadata'].get('section_title') or 'none'}",
                f"Text:\n{text_block}",
                f"Tables:\n{table_block}",
                f"Images:\n{image_block}",
            ]
        )

    def _fallback_summary(self, chunk: ChunkRecord) -> str:
        elements = chunk["original_content"].get("elements", [])
        section_title = chunk["metadata"].get("section_title")
        text_fragments = [
            str(element.get("text") or "").strip()
            for element in elements
            if str(element.get("text") or "").strip()
        ]
        table_count = sum(1 for element in elements if element.get("type") == "table")
        image_count = sum(1 for element in elements if element.get("type") == "image")

        parts: list[str] = []
        if section_title:
            parts.append(f"Section: {section_title}.")
        if text_fragments:
            parts.append(" ".join(text_fragments[:3]))
        if table_count:
            parts.append(
                f"This chunk includes {table_count} table{'s' if table_count != 1 else ''} with structured values relevant to the surrounding text."
            )
        if image_count:
            parts.append(
                f"This chunk includes {image_count} image{'s' if image_count != 1 else ''} that should be interpreted with the surrounding text."
            )
        return " ".join(part.strip() for part in parts if part.strip())[:2800]
