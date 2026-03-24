from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

_SESSION_TTL_MINUTES = 30
_CLEANUP_INTERVAL_SECONDS = 300  # 5 minutes

_sessions: dict[str, ImportSession] = {}


class SessionNotFoundError(KeyError):
    """Raised when a session_id is not found or has expired."""


@dataclass
class ImportSession:
    session_id: str
    raw_rows: list[dict[str, Any]]
    headers: list[str]
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


def create_session(raw_rows: list[dict[str, Any]], headers: list[str]) -> str:
    """Store raw rows under a new UUID session token and return the session_id."""
    session_id = str(uuid.uuid4())
    _sessions[session_id] = ImportSession(
        session_id=session_id,
        raw_rows=raw_rows,
        headers=headers,
    )
    return session_id


def get_session(session_id: str) -> ImportSession:
    """Retrieve a session by ID.

    Raises:
        SessionNotFoundError: If the session does not exist or has expired.
    """
    session = _sessions.get(session_id)
    if session is None:
        raise SessionNotFoundError(f"Session '{session_id}' not found.")
    cutoff = datetime.now(UTC) - timedelta(minutes=_SESSION_TTL_MINUTES)
    if session.created_at < cutoff:
        del _sessions[session_id]
        raise SessionNotFoundError(
            f"Session '{session_id}' has expired. Please re-upload the file."
        )
    return session


def delete_session(session_id: str) -> None:
    """Remove a session. No-op if already gone."""
    _sessions.pop(session_id, None)


async def _cleanup_expired_sessions() -> None:
    """Periodic background task that removes expired sessions every 5 minutes."""
    while True:
        await asyncio.sleep(_CLEANUP_INTERVAL_SECONDS)
        cutoff = datetime.now(UTC) - timedelta(minutes=_SESSION_TTL_MINUTES)
        expired = [sid for sid, s in list(_sessions.items()) if s.created_at < cutoff]
        for sid in expired:
            _sessions.pop(sid, None)


def start_cleanup_task() -> asyncio.Task:  # type: ignore[type-arg]
    """Schedule the session cleanup coroutine and return the Task."""
    return asyncio.create_task(_cleanup_expired_sessions())
