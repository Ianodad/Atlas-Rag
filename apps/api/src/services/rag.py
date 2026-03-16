from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from typing import Any

from supabase import Client

from ..config import Settings
from .retrieval import RetrievalService


class RagService:
    def __init__(self, client: Client, settings: Settings) -> None:
        self._client = client
        self._settings = settings
        self._retrieval = RetrievalService(client, settings)

    async def stream_answer(
        self,
        chat_id: str,
        user_content: str,
        project_id: str,
        project_settings: dict[str, Any],
        chat_history: list[dict[str, str]],
    ) -> AsyncGenerator[str, None]:
        """Yield SSE-formatted strings: event lines followed by \\n\\n."""
        api_key = self._settings.openai_api_key
        if api_key is None:
            yield _sse("error", {"message": "No OpenAI API key configured."})
            return

        try:
            from openai import AsyncOpenAI
        except ImportError:
            yield _sse("error", {"message": "openai package not installed."})
            return

        client = AsyncOpenAI(api_key=api_key.get_secret_value())

        # ── 1. Guardrail ────────────────────────────────────────────────────
        yield _sse("status", {"status": "Checking query..."})
        rejection = await _run_guardrail(client, user_content)
        if rejection:
            yield _sse("status", {"status": "Query rejected by guardrail."})
            yield _sse("done", {"answer": rejection, "citations": []})
            return

        # ── 2. Retrieval ────────────────────────────────────────────────────
        yield _sse("status", {"status": "Searching documents..."})
        try:
            texts, tables, images, citations = self._retrieval.retrieve(
                project_id, user_content, project_settings
            )
        except Exception as exc:
            yield _sse("error", {"message": f"Retrieval failed: {exc}"})
            return

        if not texts:
            # Distinguish: no documents indexed vs. no relevant match
            chunk_count = self._count_project_chunks(project_id)
            if chunk_count == 0:
                answer = (
                    "No documents have been indexed for this project yet. "
                    "Please upload a document and wait for processing to complete, "
                    "or use the ↺ button to reprocess a failed document."
                )
            else:
                answer = "I couldn't find relevant information in your documents for that question."
            yield _sse("status", {"status": "No relevant chunks found."})
            yield _sse("done", {"answer": answer, "citations": []})
            return

        # ── 3. Build messages ───────────────────────────────────────────────
        yield _sse("status", {"status": "Generating response..."})
        system_prompt = project_settings.get("system_prompt") or _DEFAULT_SYSTEM_PROMPT
        context_block = _build_context_block(texts, tables)
        messages = _build_messages(system_prompt, context_block, chat_history, user_content, images)

        llm_model = str(project_settings.get("llm_model") or "gpt-4o-mini")

        # ── 4. Stream ───────────────────────────────────────────────────────
        full_answer = ""
        try:
            stream = await client.chat.completions.create(
                model=llm_model,
                messages=messages,
                stream=True,
                temperature=0,
                max_tokens=1024,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    full_answer += delta.content
                    yield _sse("token", {"content": delta.content})
        except Exception as exc:
            yield _sse("error", {"message": f"Generation failed: {exc}"})
            return

        yield _sse("done", {"answer": full_answer, "citations": citations})

    def _count_project_chunks(self, project_id: str) -> int:
        rows = (
            self._client.table("document_chunks")
            .select("id", count="exact")
            .eq("project_id", project_id)
            .limit(1)
            .execute()
        )
        return rows.count or 0

    def get_project_settings(self, project_id: str) -> dict[str, Any] | None:
        rows = (
            self._client.table("project_settings")
            .select("*")
            .eq("project_id", project_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        return rows[0] if rows else None

    def get_chat_project_id(self, chat_id: str, user_id: str) -> str | None:
        rows = (
            self._client.table("chats")
            .select("project_id, projects!inner(user_id)")
            .eq("id", chat_id)
            .eq("projects.user_id", user_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not rows:
            return None
        return str(rows[0]["project_id"])

    def get_chat_history(self, chat_id: str, exclude_message_id: str | None = None) -> list[dict[str, str]]:
        rows = (
            self._client.table("messages")
            .select("role, content, id")
            .eq("chat_id", chat_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
            .data
            or []
        )
        rows.reverse()
        history = []
        for row in rows:
            if exclude_message_id and row.get("id") == exclude_message_id:
                continue
            history.append({"role": row["role"], "content": row["content"]})
        return history[-10:]

    def save_message(self, chat_id: str, role: str, content: str, citations: list[dict[str, Any]]) -> dict[str, Any] | None:
        response = (
            self._client.table("messages")
            .insert({
                "chat_id": chat_id,
                "role": role,
                "content": content,
                "citations": citations,
                "metadata": {},
            })
            .execute()
        )
        rows = response.data or []
        return rows[0] if rows else None


# ── Helpers ──────────────────────────────────────────────────────────────────

_DEFAULT_SYSTEM_PROMPT = (
    "You are a helpful assistant that answers questions strictly based on the provided context. "
    "If the answer is not present in the context, say so clearly. "
    "Do not make up information. Preserve factual accuracy."
)


async def _run_guardrail(client: Any, query: str) -> str | None:
    """Return a rejection message if the query is unsafe/off-topic, else None."""
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            max_tokens=60,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a safety filter. Determine if the user message is safe and appropriate "
                        "for a document Q&A system. Reply with exactly: PASS or REJECT: <reason>"
                    ),
                },
                {"role": "user", "content": query},
            ],
        )
        text = (response.choices[0].message.content or "").strip()
        if text.upper().startswith("REJECT"):
            reason = text[len("REJECT:"):].strip() if ":" in text else "Query not allowed."
            return reason
    except Exception:
        pass
    return None


def _build_context_block(texts: list[str], tables: list[str]) -> str:
    parts = []
    for i, text in enumerate(texts):
        parts.append(f"[Chunk {i + 1}]\n{text}")
    for i, table in enumerate(tables):
        parts.append(f"[Table {i + 1}]\n{table}")
    return "\n\n---\n\n".join(parts)


def _build_messages(
    system_prompt: str,
    context_block: str,
    chat_history: list[dict[str, str]],
    user_content: str,
    images: list[str],
) -> list[dict[str, Any]]:
    full_system = f"{system_prompt}\n\nContext:\n{context_block}"
    messages: list[dict[str, Any]] = [{"role": "system", "content": full_system}]

    for turn in chat_history:
        if turn["role"] in {"user", "assistant"}:
            messages.append({"role": turn["role"], "content": turn["content"]})

    if images:
        content: list[dict[str, Any]] = [{"type": "text", "text": user_content}]
        for b64 in images:
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
            })
        messages.append({"role": "user", "content": content})
    else:
        messages.append({"role": "user", "content": user_content})

    return messages


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
