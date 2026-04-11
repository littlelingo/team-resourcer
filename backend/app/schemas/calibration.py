"""Pydantic schemas for calibrations."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, computed_field

from app.schemas.calibration_cycle import CalibrationCycleResponse

# Single source of truth for box labels and axes.
# Box layout (performance=col, potential=row):
#   pot\perf  High(3)      Mid(2)       Low(1)
#   High(3)    1            2            3
#   Mid(2)     4            5            6
#   Low(1)     7            8            9
BOX_LABELS: dict[int, str] = {
    # Canonical labels from the source 9-Box Matrix taxonomy.
    # The CSV's "9-Box Matrix" column produces values like "5 - Key Performer" —
    # these labels MUST match that vocabulary so users see the same names in the
    # imported source data and the rendered UI.
    0: "Too New to Evaluate",
    1: "Consistent Star",
    2: "Future Star",
    3: "Emerging Performer",
    4: "High Professional Plus",
    5: "Key Performer",
    6: "Inconsistent Performer",
    7: "High Professional",
    8: "Solid Performer",
    9: "Lower Performer",
}

# (performance, potential) for each box number
BOX_TO_AXES: dict[int, tuple[int, int]] = {
    0: (0, 0),
    1: (3, 3),
    2: (2, 3),
    3: (1, 3),
    4: (3, 2),
    5: (2, 2),
    6: (1, 2),
    7: (3, 1),
    8: (2, 1),
    9: (1, 1),
}


class CalibrationCreate(BaseModel):
    cycle_id: int
    box: int
    effective_date: date
    reviewers: str | None = None
    high_growth_or_key_talent: str | None = None
    ready_for_promotion: str | None = None
    can_mentor_juniors: str | None = None
    next_move_recommendation: str | None = None
    rationale: str | None = None


class CalibrationUpdate(BaseModel):
    box: int | None = None
    effective_date: date | None = None
    reviewers: str | None = None
    high_growth_or_key_talent: str | None = None
    ready_for_promotion: str | None = None
    can_mentor_juniors: str | None = None
    next_move_recommendation: str | None = None
    rationale: str | None = None


class CalibrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    member_uuid: UUID
    cycle_id: int
    box: int
    reviewers: str | None
    high_growth_or_key_talent: str | None
    ready_for_promotion: str | None
    can_mentor_juniors: str | None
    next_move_recommendation: str | None
    rationale: str | None
    effective_date: date
    created_at: datetime
    updated_at: datetime
    cycle: CalibrationCycleResponse

    @computed_field  # type: ignore[prop-decorator]
    @property
    def label(self) -> str:
        return BOX_LABELS[self.box]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def performance(self) -> int:
        return BOX_TO_AXES[self.box][0]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def potential(self) -> int:
        return BOX_TO_AXES[self.box][1]
