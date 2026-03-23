from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, PrimaryKeyConstraint, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.program import Program
    from app.models.team_member import TeamMember


class ProgramAssignment(Base):
    __tablename__ = "program_assignments"

    member_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("team_members.uuid"),
        nullable=False,
    )
    program_id: Mapped[int] = mapped_column(
        ForeignKey("programs.id"),
        nullable=False,
    )
    role: Mapped[str | None] = mapped_column(String(100), nullable=True)

    __table_args__ = (PrimaryKeyConstraint("member_uuid", "program_id"),)

    # Relationships
    member: Mapped[TeamMember] = relationship("TeamMember", back_populates="program_assignments")
    program: Mapped[Program] = relationship("Program", back_populates="assignments")
