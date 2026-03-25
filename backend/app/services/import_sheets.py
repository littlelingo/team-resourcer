from __future__ import annotations

import base64
import json
import logging
import os
import re
from typing import Any

from app.schemas.import_schemas import ParseResult

logger = logging.getLogger(__name__)

_SHEET_ID_PATTERN = re.compile(r"/spreadsheets/d/([a-zA-Z0-9_-]+)")
_SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]


class ImportSheetsError(Exception):
    """Raised when Google Sheets fetch fails."""


def _load_credentials() -> Any:
    """Load Google service account credentials from env vars.

    Checks GOOGLE_SERVICE_ACCOUNT_FILE first, then GOOGLE_SERVICE_ACCOUNT_JSON.

    Returns:
        google.oauth2.service_account.Credentials

    Raises:
        ImportSheetsError: When no credentials are configured or credentials are invalid.
    """
    try:
        from google.oauth2 import service_account
    except ImportError as exc:
        raise ImportSheetsError(
            "google-auth is not installed. Add google-auth to requirements.txt."
        ) from exc

    file_path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "")
    json_b64 = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")

    if file_path and os.path.exists(file_path) and os.path.getsize(file_path) > 0:
        try:
            return service_account.Credentials.from_service_account_file(file_path, scopes=_SCOPES)
        except Exception as exc:
            logger.warning("Failed to load credentials from file '%s': %s", file_path, exc)
            raise ImportSheetsError(
                "Google credentials are misconfigured. "
                "Check GOOGLE_SERVICE_ACCOUNT_FILE or "
                "GOOGLE_SERVICE_ACCOUNT_JSON environment variables."
            ) from exc

    if json_b64 and json_b64.strip():
        try:
            decoded = base64.b64decode(json_b64.encode())
            info = json.loads(decoded)
            return service_account.Credentials.from_service_account_info(info, scopes=_SCOPES)
        except Exception as exc:
            logger.warning("Failed to load credentials from GOOGLE_SERVICE_ACCOUNT_JSON: %s", exc)
            raise ImportSheetsError(
                "Google credentials are misconfigured. "
                "Check that GOOGLE_SERVICE_ACCOUNT_JSON is valid base64-encoded JSON."
            ) from exc

    raise ImportSheetsError(
        "Google credentials not configured. "
        "Set GOOGLE_SERVICE_ACCOUNT_FILE to the path of your service account JSON file "
        "OR set GOOGLE_SERVICE_ACCOUNT_JSON to the base64-encoded JSON content."
    )


def _extract_sheet_id(sheet_url_or_id: str) -> str:
    """Extract the spreadsheet ID from a URL or return it unchanged if bare ID."""
    match = _SHEET_ID_PATTERN.search(sheet_url_or_id)
    if match:
        return match.group(1)
    return sheet_url_or_id.strip()


def fetch_sheet(sheet_url_or_id: str) -> ParseResult:
    """Fetch a Google Sheet and return the same ParseResult shape as parse_upload.

    Args:
        sheet_url_or_id: Full Google Sheets URL or bare spreadsheet ID.

    Returns:
        ParseResult with headers, preview_rows (first 10), total_row_count, raw_rows.

    Raises:
        ImportSheetsError: For auth failures, missing credentials, or sheet not found.
    """
    try:
        from googleapiclient.discovery import build
        from googleapiclient.errors import HttpError
    except ImportError as exc:
        raise ImportSheetsError(
            "google-api-python-client is not installed. "
            "Add google-api-python-client to requirements.txt."
        ) from exc

    credentials = _load_credentials()
    sheet_id = _extract_sheet_id(sheet_url_or_id)

    if not sheet_id:
        raise ImportSheetsError("Could not extract a sheet ID from the provided URL or value.")

    try:
        service = build("sheets", "v4", credentials=credentials)
        sheets_api = service.spreadsheets()

        # Get sheet metadata to find the used range
        meta = sheets_api.get(spreadsheetId=sheet_id).execute()
        first_sheet = meta["sheets"][0]["properties"]["title"]

        # Fetch the data range
        result = (
            sheets_api.values()
            .get(
                spreadsheetId=sheet_id,
                range=f"'{first_sheet}'!A1:ZZ",
            )
            .execute()
        )
    except HttpError as exc:
        status = exc.resp.status if hasattr(exc, "resp") else "unknown"
        if status == 404:
            raise ImportSheetsError(
                f"Spreadsheet not found (ID: {sheet_id}). "
                "Verify the sheet ID and that the service account has been granted access."
            ) from exc
        raise ImportSheetsError(f"Google Sheets API error (HTTP {status}): {exc}") from exc
    except Exception as exc:
        raise ImportSheetsError(f"Unexpected error fetching sheet: {exc}") from exc

    values: list[list[str]] = result.get("values", [])
    if not values:
        return ParseResult(headers=[], preview_rows=[], total_row_count=0, raw_rows=[])

    headers = [str(h) for h in values[0]]
    raw_rows: list[dict[str, Any]] = []
    for row in values[1:]:
        # Pad short rows so all keys are present
        padded = row + [""] * (len(headers) - len(row))
        raw_rows.append(dict(zip(headers, padded)))

    return ParseResult(
        headers=headers,
        preview_rows=raw_rows[:10],
        total_row_count=len(raw_rows),
        raw_rows=raw_rows,
    )
