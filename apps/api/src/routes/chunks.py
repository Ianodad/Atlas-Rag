from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..dependencies import get_current_user, get_server_supabase_client
from ..schemas.auth import CurrentUser
from supabase import Client

router = APIRouter(prefix="/chunks", tags=["chunks"])


class ChunkImage(BaseModel):
    index: int
    page_number: int | None
    image_base64: str


class ChunkImagesResponse(BaseModel):
    chunk_id: str
    images: list[ChunkImage]


class DocumentImage(BaseModel):
    chunk_index: int
    page_number: int | None
    image_base64: str


class DocumentImagesResponse(BaseModel):
    document_id: str
    images: list[DocumentImage]


@router.get("/{chunk_id}/images", response_model=ChunkImagesResponse)
def get_chunk_images(
    chunk_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    client: Client = Depends(get_server_supabase_client),
) -> ChunkImagesResponse:
    """Return all images stored in a chunk's original_content, verified by project ownership."""
    rows = (
        client.table("document_chunks")
        .select("id, project_id, original_content, page_number, projects!inner(user_id)")
        .eq("id", chunk_id)
        .eq("projects.user_id", current_user.id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Chunk not found")

    row = rows[0]
    original = row.get("original_content") or {}
    elements = original.get("elements") or []
    chunk_images: list[ChunkImage] = []
    for el in elements:
        if el.get("type") == "image":
            b64 = el.get("image_base64", "")
            if not b64:
                continue
            if b64.startswith("data:image"):
                b64 = b64.split(",", 1)[1]
            chunk_images.append(
                ChunkImage(
                    index=len(chunk_images),
                    page_number=el.get("page_number") or row.get("page_number"),
                    image_base64=b64,
                )
            )

    return ChunkImagesResponse(chunk_id=chunk_id, images=chunk_images)


@router.get(
    "/by-document/{document_id}/images",
    response_model=DocumentImagesResponse,
)
def get_document_images(
    document_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    client: Client = Depends(get_server_supabase_client),
) -> DocumentImagesResponse:
    """Return all images across every chunk of a document (capped at 20)."""
    # Verify ownership: document → project → user
    doc_rows = (
        client.table("project_documents")
        .select("id, projects!inner(user_id)")
        .eq("id", document_id)
        .eq("projects.user_id", current_user.id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not doc_rows:
        raise HTTPException(status_code=404, detail="Document not found")

    # Fetch all chunks for this document (no JSONB filter — filter in Python)
    rows = (
        client.table("document_chunks")
        .select("chunk_index, page_number, original_content, modality_flags")
        .eq("document_id", document_id)
        .order("chunk_index")
        .execute()
        .data
        or []
    )

    images: list[DocumentImage] = []
    for row in rows:
        flags = row.get("modality_flags") or []
        if "image" not in flags:
            continue
        original = row.get("original_content") or {}
        for el in original.get("elements") or []:
            if el.get("type") != "image":
                continue
            b64 = el.get("image_base64", "")
            if not b64:
                continue
            if b64.startswith("data:image"):
                b64 = b64.split(",", 1)[1]
            images.append(
                DocumentImage(
                    chunk_index=row.get("chunk_index", 0),
                    page_number=el.get("page_number") or row.get("page_number"),
                    image_base64=b64,
                )
            )
            if len(images) >= 20:
                break
        if len(images) >= 20:
            break

    return DocumentImagesResponse(document_id=document_id, images=images)
