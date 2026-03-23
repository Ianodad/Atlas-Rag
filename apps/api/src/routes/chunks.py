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
