from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.import_schemas import (
    CommitResult,
    MappedPreviewResult,
    MappingConfig,
    SheetRequest,
    UploadResponse,
)
from app.services.import_commit import commit_import
from app.services.import_mapper import apply_mapping
from app.services.import_parser import ImportParseError, parse_upload
from app.services.import_session import SessionNotFoundError, create_session
from app.services.import_sheets import ImportSheetsError, fetch_sheet

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
) -> UploadResponse:
    """Accept a multipart CSV or XLSX file and return headers and a preview."""
    MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
    file_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB limit.")
    filename = file.filename or ""
    try:
        result = parse_upload(file_bytes, filename)
    except ImportParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    session_id = create_session(result.raw_rows, result.headers)
    return UploadResponse(
        session_id=session_id,
        headers=result.headers,
        preview_rows=result.preview_rows,
        total_row_count=result.total_row_count,
    )


@router.post("/google-sheets", response_model=UploadResponse)
async def fetch_google_sheet(
    body: SheetRequest,
) -> UploadResponse:
    """Accept a Google Sheets URL or ID and return headers and a preview."""
    try:
        result = fetch_sheet(body.sheet_url_or_id)
    except ImportSheetsError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    session_id = create_session(result.raw_rows, result.headers)
    return UploadResponse(
        session_id=session_id,
        headers=result.headers,
        preview_rows=result.preview_rows,
        total_row_count=result.total_row_count,
    )


@router.post("/preview", response_model=MappedPreviewResult)
async def preview_mapping(
    body: MappingConfig,
) -> MappedPreviewResult:
    """Apply a column mapping to a session's rows and return a validated preview.

    Returns at most 50 rows in the response payload; full error/warning counts
    are always reported.
    """
    try:
        result = apply_mapping(body.session_id, body)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # Limit response payload to first 50 rows while preserving aggregate counts
    return MappedPreviewResult(
        rows=result.rows[:50],
        error_count=result.error_count,
        warning_count=result.warning_count,
    )


@router.post("/commit", response_model=CommitResult)
async def commit_import_route(
    body: MappingConfig,
    db: AsyncSession = Depends(get_db),
) -> CommitResult:
    """Commit validated rows to the database and return a summary."""
    try:
        return await commit_import(body.session_id, body, db)
    except SessionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
