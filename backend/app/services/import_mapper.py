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


def _split_semicolon_list(value: Any, *, keep_blanks: bool = False) -> list[str]:
    """Split a cell value on ';' and strip tokens.

    By default drops empty/whitespace-only tokens (used for program_names).
    With keep_blanks=True, preserves blank positions so callers can align
    parallel lists positionally (used for program_team_names where a blank
    token at position N means "no team for the program at position N").

    A cell with no ';' returns a single-element list (backward compat).
    E.g. "; Alpha;;Beta;" -> ["Alpha", "Beta"]   (default)
         ";Team2"         -> ["", "Team2"]       (keep_blanks=True)
    """
    raw = str(value) if value is not None else ""
    if not raw:
        return []
    tokens = [token.strip() for token in raw.split(";")]
    if keep_blanks:
        # Trim a single trailing empty token caused by a trailing ';' so
        # "Team1;Team2;" doesn't read as length 3.
        if tokens and tokens[-1] == "":
            tokens = tokens[:-1]
        return tokens
    return [t for t in tokens if t]


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


def _validate_program_lists(data: dict[str, Any], errors: list[str]) -> None:
    """Validate that program_team_names aligns positionally with program_names.

    Both lists must have the same length when both are present and non-empty.
    Blank tokens within program_team_names are allowed at any index.
    """
    program_names = data.get("program_names")
    program_team_names = data.get("program_team_names")
    if program_names and program_team_names:
        if len(program_names) != len(program_team_names):
            errors.append(
                "program_team_names must align positionally with program_names "
                f"(got {len(program_names)} program(s) but {len(program_team_names)} team(s))."
            )


def _validate_effective_date(data: dict[str, Any], errors: list[str]) -> None:
    val = data.get("effective_date")
    if val and val != "":
        parsed = parse_date(str(val))
        if parsed is None:
            errors.append(f"'effective_date' could not be parsed as a date, got '{val}'.")
        else:
            data["effective_date"] = str(parsed)


def validate_box_value(raw: Any) -> int | None:
    """Parse a box value from a CSV cell.

    Accepts "5", "5 - Key Performer", "5-Key Performer", "0 - Too New to Evaluate", etc.
    Returns the integer 0-9 or None if invalid.
    """
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    # Extract leading integer (handles "5 - Key Performer" or "5-Performer")
    import re as _re

    m = _re.match(r"^(\d+)", s)
    if not m:
        return None
    value = int(m.group(1))
    if 0 <= value <= 9:
        return value
    return None


def _validate_box(data: dict[str, Any], errors: list[str]) -> None:
    """Validate and normalize the 'box' field for calibration rows."""
    val = data.get("box")
    if val is None or val == "":
        # Required-field check already covers this
        return
    parsed = validate_box_value(val)
    if parsed is None:
        errors.append(f"'box' must be an integer 0-9, got '{val}'.")
    else:
        data["box"] = str(parsed)


def _validate_calibration_effective_date(data: dict[str, Any], errors: list[str]) -> None:
    """Validate effective_date for calibration; allow missing (will default later)."""
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
            "program_names",
            "program_team_names",
            "supervisor_employee_id",
            "program_role",
        },
        required_fields={"employee_id", "first_name", "last_name"},
        numeric_fields={"salary", "bonus", "pto_used"},  # Keep in sync with _FINANCIAL_FIELDS in import_commit.py
        dedup_field="employee_id",
        validators=[_validate_email, _validate_hire_date, _validate_program_lists],
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
    "calibration": EntityConfig(
        target_fields={
            "first_name",
            "last_name",
            "cycle_label",
            "box",
            "reviewers",
            "high_growth_or_key_talent",
            "ready_for_promotion",
            "can_mentor_juniors",
            "next_move_recommendation",
            "rationale",
            "effective_date",
        },
        required_fields={"first_name", "last_name", "cycle_label", "box"},
        numeric_fields=set(),
        dedup_field=None,
        validators=[_validate_box, _validate_calibration_effective_date],
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

    # Build constant value lookup from constant_mappings
    constant_values: dict[str, str] = {
        cm.field: cm.constant for cm in (mapping_config.constant_mappings or [])
    }

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

        # Apply constant mappings: set field to constant value for every row
        for tgt_field, constant_value in constant_values.items():
            data[tgt_field] = constant_value

        # Normalize program list fields from raw strings to list[str]
        if "program_names" in data:
            data["program_names"] = _split_semicolon_list(data["program_names"])
        if "program_team_names" in data:
            data["program_team_names"] = _split_semicolon_list(
                data["program_team_names"], keep_blanks=True
            )

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
