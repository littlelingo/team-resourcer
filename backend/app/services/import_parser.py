from __future__ import annotations

"""Parsing utilities for CSV and XLSX import files."""

import csv
import io
from typing import Any

from app.schemas.import_schemas import ParseResult


class ImportParseError(ValueError):
    """Raised when a file cannot be parsed for import."""


def parse_upload(file_bytes: bytes, filename: str) -> ParseResult:
    """Parse a CSV or XLSX file and return headers, preview rows, and all rows.

    Args:
        file_bytes: Raw file content.
        filename: Original filename, used to determine format by extension.

    Returns:
        ParseResult with headers, preview_rows (first 10), total_row_count, raw_rows.

    Raises:
        ImportParseError: For unsupported extensions or malformed files.
    """
    lower = filename.lower()
    if lower.endswith(".csv"):
        return _parse_csv(file_bytes)
    elif lower.endswith(".xlsx"):
        return _parse_xlsx(file_bytes)
    elif lower.endswith(".xls"):
        raise ImportParseError("Old Excel format (.xls) is not supported. Please save as .xlsx.")
    else:
        ext = filename.rsplit(".", 1)[-1] if "." in filename else "(none)"
        raise ImportParseError(
            f"Unsupported file format '.{ext}'. Please upload a .csv or .xlsx file."
        )


def _parse_csv(file_bytes: bytes) -> ParseResult:
    """Parse raw CSV bytes and return a ParseResult."""
    try:
        text = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = file_bytes.decode("latin-1")
        except UnicodeDecodeError as exc:
            raise ImportParseError(
                "CSV file could not be decoded. Ensure the file is UTF-8 encoded."
            ) from exc

    try:
        reader = csv.DictReader(io.StringIO(text))
        raw_rows: list[dict[str, Any]] = []
        for row in reader:
            raw_rows.append(dict(row))
        headers = list(reader.fieldnames or [])
    except csv.Error as exc:
        raise ImportParseError(f"Malformed CSV: {exc}") from exc

    return ParseResult(
        headers=headers,
        preview_rows=raw_rows[:10],
        total_row_count=len(raw_rows),
        raw_rows=raw_rows,
    )


def _parse_xlsx(file_bytes: bytes) -> ParseResult:
    """Parse raw XLSX bytes using pandas and return a ParseResult."""
    try:
        import pandas as pd
    except ImportError as exc:
        raise ImportParseError("pandas is required for Excel support.") from exc

    try:
        df = pd.read_excel(io.BytesIO(file_bytes), engine="openpyxl", dtype=str)
    except Exception as exc:
        raise ImportParseError(f"Could not read Excel file: {exc}") from exc

    df = df.fillna("")
    headers = list(df.columns)
    raw_rows: list[dict[str, Any]] = df.to_dict(orient="records")

    return ParseResult(
        headers=headers,
        preview_rows=raw_rows[:10],
        total_row_count=len(raw_rows),
        raw_rows=raw_rows,
    )
