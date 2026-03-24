from datetime import UTC, datetime, timedelta

import pytest

import app.services.import_session as sess_mod
from app.services.import_session import (
    SessionNotFoundError,
    create_session,
    delete_session,
    get_session,
)


def setup_function(fn):
    sess_mod._sessions.clear()


def teardown_function(fn):
    sess_mod._sessions.clear()


def test_create_session_returns_string_uuid():
    sid = create_session([{"a": "1"}], ["a"])
    assert isinstance(sid, str)
    assert len(sid) == 36


def test_get_session_returns_correct_data():
    sid = create_session([{"employee_id": "E1"}], ["employee_id"])
    session = get_session(sid)
    assert session.session_id == sid
    assert session.raw_rows == [{"employee_id": "E1"}]
    assert session.headers == ["employee_id"]


def test_get_session_unknown_raises():
    with pytest.raises(SessionNotFoundError):
        get_session("nonexistent-id")


def test_get_session_expired_raises():
    sid = create_session([], [])
    sess_mod._sessions[sid].created_at = datetime.now(UTC) - timedelta(minutes=31)
    with pytest.raises(SessionNotFoundError):
        get_session(sid)
    assert sid not in sess_mod._sessions


def test_delete_session_removes_it():
    sid = create_session([], [])
    delete_session(sid)
    with pytest.raises(SessionNotFoundError):
        get_session(sid)


def test_delete_session_noop_if_missing():
    delete_session("ghost-id")  # must not raise
