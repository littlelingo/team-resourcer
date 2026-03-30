from __future__ import annotations

"""Apply a column mapping to raw session rows and validate each row."""

import re
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Callable

from app.schemas.import_schemas import EntityType, MappedPreviewResult, MappedRow, MappingConfig
from app.services.import_amount_utils import parse_amount
from app.services.import_date_utils import parse_date
from app.services.import_session import get_session

_EMAIL_RE = re.compile(r"\S+@\S+\.\S+")


@dataclass
class EntityConfig:
    target_fields: set[str]
    required_fields: set[str]
    numeric_fields: set[str] = field(default_factory=set)
    dedup_field: str | None = None
    validators: list[Callable[[dict[str, Any], list[str]], None]] = field(default_factory=list)


def _validate_hire_date(data: dict[str, Any], errors: list[str]) -> None:
    val = data.get("hire_date")
    if val and val != "":
        parsed = parse_date(str(val))
        if parsed is None:
            errors.append(f"'hire_date' could not be parsed as a date, got '{val}'.")
        else:
            data["hire_date"] = str(parsed)


def _validate_email(data: dict[str, Any], errors: list[str]) -> None:
    email_val = data.get("email")
    if email_val and not _EMAIL_RE.fullmatch(str(email_val)):
        errors.append(f"Invalid email format: '{email_val}'.")


def _validate_effective_date(data: dict[str, Any], errors: list[str]) -> None:
    val = data.get("effective_date")
    if val and val != "":
        parsed = parse_date(str(val))
        if parsed is None:
            errors.append(f"'effective_date' could not be parsed as a date, got '{val}'.")
        else:
            data["effective_date"] = str(parsed)


ENTITY_CONFIGS: dict[EntityType, EntityConfig] = {
    "member": EntityConfig(
        target_fields={
            "employee_id",
            "first_name",
            "last_name",
            "hire_date",
            "title",
            "city",
            "state",
            "email",
            "phone",
            "slack_handle",
            "salary",
            "bonus",
            "pto_used",
            "functional_area_name",
            "team_name",
            "program_name",
            "supervisor_employee_id",
            "program_role",
        },
        required_fields={"employee_id", "first_name", "last_name"},
        numeric_fields={"salary", "bonus", "pto_used"},  # Keep in sync with _FINANCIAL_FIELDS in import_commit.py
        dedup_field="employee_id",
        validators=[_validate_email, _validate_hire_date],
    ),
    "program": EntityConfig(
        target_fields={"name", "description", "agency_name"},
        required_fields={"name"},
        dedup_field="name",
    ),
    "area": EntityConfig(
        target_fields={"name", "description"},
        required_fields={"name"},
        dedup_field="name",
    ),
    "team": EntityConfig(
        target_fields={"name", "functional_area_name", "description"},
        required_fields={"name"},
        dedup_field="name",
    ),
    "agency": EntityConfig(
        target_fields={"name", "description"},
        required_fields={"name"},
        dedup_field="name",
    ),
    "salary_history": EntityConfig(
        target_fields={"employee_id", "effective_date", "amount", "notes"},
        required_fields={"employee_id", "effective_date", "amount"},
        numeric_fields={"amount"},
        dedup_field=None,
        validators=[_validate_effective_date],
    ),
    "bonus_history": EntityConfig(
        target_fields={"employee_id", "effective_date", "amount", "notes"},
        required_fields={"employee_id", "effective_date", "amount"},
        numeric_fields={"amount"},
        dedup_field=None,
        validators=[_validate_effective_date],
    ),
    "pto_history": EntityConfig(
        target_fields={"employee_id", "effective_date", "amount", "notes"},
        required_fields={"employee_id", "effective_date", "amount"},
        numeric_fields={"amount"},
        dedup_field=None,
        validators=[_validate_effective_date],
    ),
}


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
    config = ENTITY_CONFIGS[mapping_config.entity_type]

    # Validate mapping config — unknown target fields are an error at config level
    unknown = [
        v
        for v in mapping_config.column_map.values()
        if v is not None and v not in config.target_fields
    ]
    if unknown:
        raise ValueError(
            f"Unknown target field(s) in column_map: {', '.join(sorted(unknown))}. "
            f"Valid fields: {', '.join(sorted(config.target_fields))}"
        )

    session = get_session(session_id)
    raw_rows = session.raw_rows

    seen_dedup: dict[str, int] = {}  # dedup_field value → first 1-based row index
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

        # Required fields
        for req_field in config.required_fields:
            val = data.get(req_field, "")
            if not val:
                errors.append(f"{req_field} is missing or blank.")

        # Deduplication
        if config.dedup_field is not None:
            dedup_val = data.get(config.dedup_field, "")
            if dedup_val:
                dedup_str = str(dedup_val)
                if dedup_str in seen_dedup:
                    warnings.append(
                        f"Duplicate {config.dedup_field} '{dedup_str}' "
                        f"(first seen at row {seen_dedup[dedup_str]}). "
                        "This row will be skipped during commit."
                    )
                else:
                    seen_dedup[dedup_str] = idx

        # Numeric field validation
        for num_field in config.numeric_fields:
            val = data.get(num_field)
            if val is not None and val != "":
                result = parse_amount(str(val))
                if result is None:
                    errors.append(f"'{num_field}' must be numeric, got '{val}'.")
                else:
                    data[num_field] = str(result)

        # Entity-specific validators
        for validator in config.validators:
            validator(data, errors)

        mapped_rows.append(MappedRow(index=idx, data=data, errors=errors, warnings=warnings))

    error_count = sum(1 for r in mapped_rows if r.errors)
    warning_count = sum(1 for r in mapped_rows if r.warnings)

    return MappedPreviewResult(
        rows=mapped_rows,
        error_count=error_count,
        warning_count=warning_count,
    )
