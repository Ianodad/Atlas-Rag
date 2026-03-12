from typing import Any

from pydantic import Field
from typing import Literal

from .base import ApiModel


class ProjectCreate(ApiModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class ProjectResponse(ApiModel):
    id: str
    user_id: str
    name: str
    description: str | None
    created_at: str
    updated_at: str


class ProjectSettingsResponse(ApiModel):
    id: str
    project_id: str
    embedding_model: str
    llm_provider: Literal["openai", "google_gemini"]
    llm_model: str
    retrieval_strategy: Literal["vector", "keyword", "hybrid", "multi_query_vector", "multi_query_hybrid"]
    chunks_per_search: int
    final_context_size: int
    similarity_threshold: float
    query_variation_count: int
    vector_weight: float
    keyword_weight: float
    system_prompt: str | None
    created_at: str
    updated_at: str


class ProjectSettingsUpdate(ApiModel):
    embedding_model: str | None = None
    llm_provider: Literal["openai", "google_gemini"] | None = None
    llm_model: str | None = None
    retrieval_strategy: Literal["vector", "keyword", "hybrid", "multi_query_vector", "multi_query_hybrid"] | None = None
    chunks_per_search: int | None = None
    final_context_size: int | None = None
    similarity_threshold: float | None = None
    query_variation_count: int | None = None
    vector_weight: float | None = None
    keyword_weight: float | None = None
    system_prompt: str | None = None


class ProjectDocumentResponse(ApiModel):
    id: str
    project_id: str
    filename: str
    mime_type: str | None
    storage_bucket: str | None
    storage_path: str | None
    source_type: str
    source_url: str | None
    processing_status: str
    processing_details: dict[str, Any]
    page_count: int | None
    metadata: dict[str, Any]
    created_at: str
    updated_at: str
