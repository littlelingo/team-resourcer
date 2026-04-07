from __future__ import annotations

"""Pydantic schemas for the data import pipeline."""

from typing import Any, Literal

from pydantic import BaseModel

EntityType = Literal[
    "member", "program", "area", "team", "agency", "salary_history", "bonus_history", "pto_history"
]


class ParseResult(BaseModel):
    headers: list[str]
    preview_rows: list[dict[str, Any]]
    total_row_count: int
    raw_rows: list[dict[str, Any]]


class UploadResponse(BaseModel):
    session_id: str
    headers: list[str]
    preview_rows: list[dict[str, Any]]
    total_row_count: int


class SheetRequest(BaseModel):
    sheet_url_or_id: str


class MappingConfig(BaseModel):
    session_id: str
    column_map: dict[str, str | None]
    entity_type: EntityType = "member"
    compute_unassignments: bool = False


class MappedRow(BaseModel):
    index: int
    data: dict[str, Any]
    errors: list[str]
    warnings: list[str]
    unassignments: list[str] = []


class MappedPreviewResult(BaseModel):
    rows: list[MappedRow]
    error_count: int
    warning_count: int


class CommitResult(BaseModel):
    created_count: int
    updated_count: int
    skipped_count: int
    error_rows: list[MappedRow]
