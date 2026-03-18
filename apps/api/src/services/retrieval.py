from __future__ import annotations

from typing import Any

from supabase import Client

from ..config import Settings


class RetrievalService:
    def __init__(self, client: Client, settings: Settings) -> None:
        self._client = client
        self._settings = settings

    # ── Public entry point ──────────────────────────────────────────────────

    def retrieve(
        self,
        project_id: str,
        query: str,
        project_settings: dict[str, Any],
    ) -> tuple[list[str], list[str], list[str], list[dict[str, Any]]]:
        """Return (texts, tables, images, citations) for the given query."""
        strategy = project_settings.get("retrieval_strategy", "vector")
        chunks_per_search = int(project_settings.get("chunks_per_search") or 8)
        final_context_size = int(project_settings.get("final_context_size") or 5)
        similarity_threshold = float(project_settings.get("similarity_threshold") or 0.3)
        query_variation_count = int(project_settings.get("query_variation_count") or 3)
        vector_weight = float(project_settings.get("vector_weight") or 0.7)
        keyword_weight = float(project_settings.get("keyword_weight") or 0.3)

        if strategy == "keyword":
            raw = self._keyword_search(project_id, query, chunks_per_search)
        elif strategy == "hybrid":
            raw = self._hybrid_search(
                project_id, query, chunks_per_search,
                similarity_threshold, vector_weight, keyword_weight,
            )
        elif strategy == "multi_query_vector":
            raw = self._multi_query(
                project_id, query, chunks_per_search, query_variation_count,
                similarity_threshold, mode="vector",
            )
        elif strategy == "multi_query_hybrid":
            raw = self._multi_query(
                project_id, query, chunks_per_search, query_variation_count,
                similarity_threshold, mode="hybrid",
                vector_weight=vector_weight, keyword_weight=keyword_weight,
            )
        else:
            raw = self._vector_search(project_id, query, chunks_per_search, similarity_threshold)

        top = raw[:final_context_size]
        return self._build_context(top)

    # ── Strategy implementations ────────────────────────────────────────────

    def _vector_search(
        self,
        project_id: str,
        query: str,
        match_count: int,
        similarity_threshold: float,
    ) -> list[dict[str, Any]]:
        embedding = self._embed(query)
        if embedding is None:
            return []
        rows = (
            self._client.rpc(
                "search_document_chunks_vector",
                {
                    "query_embedding": embedding,
                    "match_count": match_count,
                    "filter_project_id": project_id,
                },
            )
            .execute()
            .data
            or []
        )
        return [r for r in rows if float(r.get("similarity", 0)) >= similarity_threshold]

    def _keyword_search(
        self,
        project_id: str,
        query: str,
        match_count: int,
    ) -> list[dict[str, Any]]:
        rows = (
            self._client.rpc(
                "search_document_chunks_keyword",
                {
                    "query_text": query,
                    "match_count": match_count,
                    "filter_project_id": project_id,
                },
            )
            .execute()
            .data
            or []
        )
        return rows

    def _hybrid_search(
        self,
        project_id: str,
        query: str,
        match_count: int,
        similarity_threshold: float,
        vector_weight: float,
        keyword_weight: float,
    ) -> list[dict[str, Any]]:
        vector_results = self._vector_search(project_id, query, match_count, similarity_threshold)
        keyword_results = self._keyword_search(project_id, query, match_count)
        return _rrf_fuse(
            [vector_results, keyword_results],
            weights=[vector_weight, keyword_weight],
        )

    def _multi_query(
        self,
        project_id: str,
        query: str,
        match_count: int,
        num_variations: int,
        similarity_threshold: float,
        mode: str,
        vector_weight: float = 0.7,
        keyword_weight: float = 0.3,
    ) -> list[dict[str, Any]]:
        queries = self._generate_query_variations(query, num_variations)
        all_results: list[list[dict[str, Any]]] = []
        for q in queries:
            if mode == "hybrid":
                results = self._hybrid_search(
                    project_id, q, match_count, similarity_threshold,
                    vector_weight, keyword_weight,
                )
            else:
                results = self._vector_search(project_id, q, match_count, similarity_threshold)
            all_results.append(results)
        return _rrf_fuse(all_results)

    # ── Helpers ─────────────────────────────────────────────────────────────

    def _embed(self, text: str) -> list[float] | None:
        api_key = self._settings.openai_api_key
        if api_key is None:
            return None
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key.get_secret_value())
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=text,
                dimensions=1536,
            )
            return response.data[0].embedding
        except Exception:
            return None

    def _generate_query_variations(self, query: str, count: int) -> list[str]:
        api_key = self._settings.openai_api_key
        if api_key is None or count <= 0:
            return [query]
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key.get_secret_value())
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                temperature=0,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Generate alternative phrasings of the user's query for document retrieval. "
                            f"Return exactly {count} variations, one per line, no numbering, no extra text."
                        ),
                    },
                    {"role": "user", "content": query},
                ],
                max_tokens=300,
            )
            text = (response.choices[0].message.content or "").strip()
            variations = [line.strip() for line in text.splitlines() if line.strip()]
            return [query] + variations[:count]
        except Exception:
            return [query]

    def _build_context(
        self,
        chunks: list[dict[str, Any]],
    ) -> tuple[list[str], list[str], list[str], list[dict[str, Any]]]:
        texts: list[str] = []
        tables: list[str] = []
        images: list[str] = []
        citations: list[dict[str, Any]] = []

        # Batch-fetch document metadata (filename, source_type, source_url) for all chunks
        doc_ids = list({str(c["document_id"]) for c in chunks if c.get("document_id")})
        doc_meta: dict[str, dict[str, Any]] = {}
        if doc_ids:
            rows = (
                self._client.table("project_documents")
                .select("id, filename, source_type, source_url")
                .in_("id", doc_ids)
                .execute()
                .data
                or []
            )
            doc_meta = {str(r["id"]): r for r in rows}

        for chunk in chunks:
            texts.append(chunk.get("retrieval_text", ""))
            doc_id = str(chunk.get("document_id", ""))
            meta = doc_meta.get(doc_id, {})
            citations.append(
                {
                    "chunk_id": chunk.get("chunk_id"),
                    "document_id": doc_id or None,
                    "chunk_index": chunk.get("chunk_index"),
                    "page": chunk.get("page_number"),
                    "filename": meta.get("filename"),
                    "source_type": meta.get("source_type"),
                    "source_url": meta.get("source_url"),
                }
            )

        return texts, tables, images, citations


# ── RRF fusion ───────────────────────────────────────────────────────────────

def _rrf_fuse(
    result_lists: list[list[dict[str, Any]]],
    weights: list[float] | None = None,
    k: int = 60,
) -> list[dict[str, Any]]:
    if weights is None:
        weights = [1.0] * len(result_lists)

    scores: dict[str, float] = {}
    chunks_by_id: dict[str, dict[str, Any]] = {}

    for result_list, weight in zip(result_lists, weights):
        for rank, chunk in enumerate(result_list):
            chunk_id = str(chunk.get("chunk_id", ""))
            if not chunk_id:
                continue
            rrf_score = weight * (1.0 / (k + rank + 1))
            scores[chunk_id] = scores.get(chunk_id, 0.0) + rrf_score
            if chunk_id not in chunks_by_id:
                chunks_by_id[chunk_id] = chunk

    return sorted(chunks_by_id.values(), key=lambda c: scores.get(str(c.get("chunk_id", "")), 0.0), reverse=True)
