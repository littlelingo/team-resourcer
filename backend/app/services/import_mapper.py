from __future__ import annotations

"""Apply a column mapping to raw session rows and validate each row."""

import re
from decimal import Decimal, InvalidOperation
from typing import Any

from app.schemas.import_schemas import MappedPreviewResult, MappedRow, MappingConfig
from app.services.import_session import get_session

TARGET_FIELDS: set[str] = {
    # TeamMember scalar fields
    "employee_id",
    "name",
    "title",
    "location",
    "email",
    "phone",
    "slack_handle",
    "salary",
    "bonus",
    "pto_used",
    # FK-via-name fields (resolved to IDs at commit time)
    "functional_area_name",
    "team_name",
    "program_name",
    "supervisor_employee_id",
    # Optional: program assignment role
    "program_role",
}

REQUIRED_FIELDS: set[str] = {"employee_id", "name"}

_NUMERIC_FIELDS: set[str] = {"salary", "bonus", "pto_used"}
_EMAIL_RE = re.compile(r"\S+@\S+\.\S+")


def apply_mapping(
    session_id: str,
    mapping_config: MappingConfig,
) -> MappedPreviewResult:
    """Apply column_map to raw session rows and validate each row.

    Args:
        session_id: Token identifying the upload session.
        mapping_config: MappingConfig with session_id and column_map.

    Returns:
        MappedPreviewResult with mapped rows, error_count, warning_count.

    Raises:
        ValueError: If column_map references unknown target fields.
        SessionNotFoundError: If the session is missing or expired.
    """
    # Validate mapping config — unknown target fields are an error at config level
    unknown = [
        v for v in mapping_config.column_map.values() if v is not None and v not in TARGET_FIELDS
    ]
    if unknown:
        raise ValueError(
            f"Unknown target field(s) in column_map: {', '.join(sorted(unknown))}. "
            f"Valid fields: {', '.join(sorted(TARGET_FIELDS))}"
        )

    session = get_session(session_id)
    raw_rows = session.raw_rows

    seen_employee_ids: dict[str, int] = {}  # employee_id → first 1-based row index
    mapped_rows: list[MappedRow] = []

    for idx, raw_row in enumerate(raw_rows, start=1):
        data: dict[str, Any] = {}
        errors: list[str] = []
        warnings: list[str] = []

        # Apply column_map: source header → target field
        for src_col, tgt_field in mapping_config.column_map.items():
            if tgt_field is None:
                continue  # explicitly skipped
            value = raw_row.get(src_col, "")
            if isinstance(value, str):
                value = value.strip()
            data[tgt_field] = value

        # --- Validation ---

        # Required: employee_id
        emp_id = data.get("employee_id", "")
        if not emp_id:
            errors.append("employee_id is missing or blank.")
        else:
            emp_id_str = str(emp_id)
            if emp_id_str in seen_employee_ids:
                warnings.append(
                    f"Duplicate employee_id '{emp_id_str}' "
                    f"(first seen at row {seen_employee_ids[emp_id_str]}). "
                    "This row will be skipped during commit."
                )
            else:
                seen_employee_ids[emp_id_str] = idx

        # Required: name
        name_val = data.get("name", "")
        if not name_val:
            errors.append("name is missing or blank.")

        # Email format validation
        email_val = data.get("email")
        if email_val and not _EMAIL_RE.fullmatch(str(email_val)):
            errors.append(f"Invalid email format: '{email_val}'.")

        # Numeric field validation
        for num_field in _NUMERIC_FIELDS:
            val = data.get(num_field)
            if val is not None and val != "":
                try:
                    Decimal(str(val))
                except InvalidOperation:
                    errors.append(f"'{num_field}' must be numeric, got '{val}'.")

        mapped_rows.append(MappedRow(index=idx, data=data, errors=errors, warnings=warnings))

    error_count = sum(1 for r in mapped_rows if r.errors)
    warning_count = sum(1 for r in mapped_rows if r.warnings)

    return MappedPreviewResult(
        rows=mapped_rows,
        error_count=error_count,
        warning_count=warning_count,
    )
