from __future__ import annotations

"""SQLAlchemy model for the calibration_cycles table."""

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, Integer, SmallInteger, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.calibration import Calibration


class CalibrationCycle(Base):
    __tablename__ = "calibration_cycles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    label: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    sequence_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    calibrations: Mapped[list[Calibration]] = relationship(
        "Calibration",
        back_populates="cycle",
        cascade="all, delete-orphan",
    )
