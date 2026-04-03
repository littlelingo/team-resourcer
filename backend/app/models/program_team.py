from __future__ import annotations

"""SQLAlchemy model for the program_teams table."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.program import Program
    from app.models.program_assignment import ProgramAssignment
    from app.models.team_member import TeamMember


class ProgramTeam(Base):
    __tablename__ = "program_teams"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    program_id: Mapped[int] = mapped_column(
        ForeignKey("programs.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("team_members.uuid", use_alter=True, name="fk_program_teams_lead_id"),
        nullable=True,
    )
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
    program: Mapped[Program] = relationship("Program", back_populates="teams")
    lead: Mapped[TeamMember | None] = relationship(
        "TeamMember",
        foreign_keys=[lead_id],
    )
    assignments: Mapped[list[ProgramAssignment]] = relationship(
        "ProgramAssignment",
        back_populates="program_team",
        foreign_keys="ProgramAssignment.program_team_id",
    )

    __table_args__ = (Index("ix_program_teams_program_id", "program_id"),)
