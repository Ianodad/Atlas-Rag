from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import HTTPException

logger = logging.getLogger("atlasrag.api")


def check_chat_rate_limit(user_id: str, redis_client: Any, max_per_minute: int) -> None:
    """Raise 429 if the user has exceeded max_per_minute chat messages in the current minute window."""
    window = int(time.time()) // 60
    key = f"rl:chat:{user_id}:{window}"
    try:
        count = redis_client.incr(key)
        redis_client.expire(key, 120)  # expire after two windows
    except Exception as exc:
        # Redis unavailable — fail open so users aren't blocked by infrastructure issues
        logger.warning("Rate limit check failed (Redis unavailable): %s", exc)
        return

    if count > max_per_minute:
        logger.warning(
            "Chat rate limit exceeded",
            extra={"user_id": user_id, "count": count, "limit": max_per_minute},
        )
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait a moment before sending another message.",
        )
