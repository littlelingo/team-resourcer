from __future__ import annotations

"""SQLAlchemy model for the calibrations table."""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.calibration_cycle import CalibrationCycle
    from app.models.team_member import TeamMember


class Calibration(Base):
    __tablename__ = "calibrations"
    __table_args__ = (
        UniqueConstraint("member_uuid", "cycle_id", name="uq_calibrations_member_cycle"),
        CheckConstraint("box BETWEEN 0 AND 9", name="ck_calibrations_box_range"),
        Index("ix_calibrations_member_effective", "member_uuid", "effective_date"),
        Index("ix_calibrations_cycle_id", "cycle_id"),
        Index("ix_calibrations_box", "box"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    member_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("team_members.uuid", ondelete="CASCADE"),
        nullable=False,
    )
    cycle_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("calibration_cycles.id", ondelete="RESTRICT"),
        nullable=False,
    )
    box: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    reviewers: Mapped[str | None] = mapped_column(Text, nullable=True)
    high_growth_or_key_talent: Mapped[str | None] = mapped_column(Text, nullable=True)
    ready_for_promotion: Mapped[str | None] = mapped_column(Text, nullable=True)
    can_mentor_juniors: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_move_recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    member: Mapped[TeamMember] = relationship("TeamMember", back_populates="calibrations")
    cycle: Mapped[CalibrationCycle] = relationship(
        "CalibrationCycle", back_populates="calibrations"
    )
