from __future__ import annotations

"""SQLAlchemy model for the team_members table."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.functional_area import FunctionalArea
    from app.models.member_history import MemberHistory
    from app.models.program_assignment import ProgramAssignment
    from app.models.team import Team


class TeamMember(Base):
    __tablename__ = "team_members"

    uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    employee_id: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hire_date: Mapped[date | None] = mapped_column(Date(), nullable=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    slack_handle: Mapped[str | None] = mapped_column(String(100), nullable=True)
    salary: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    bonus: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    pto_used: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    functional_area_id: Mapped[int] = mapped_column(
        ForeignKey("functional_areas.id"), nullable=False, index=True
    )
    team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True, index=True)
    supervisor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("team_members.uuid"),
        nullable=True,
    )
    functional_manager_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("team_members.uuid"),
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

    @property
    def name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def supervisor_name(self) -> str | None:
        if self.supervisor is not None:
            return self.supervisor.name
        return None

    @property
    def functional_manager_name(self) -> str | None:
        if self.functional_manager is not None:
            return self.functional_manager.name
        return None

    # Relationships
    functional_area: Mapped[FunctionalArea] = relationship(
        "FunctionalArea", back_populates="members"
    )
    team: Mapped[Team | None] = relationship(
        "Team",
        back_populates="members",
        foreign_keys=[team_id],
    )
    led_team: Mapped[Team | None] = relationship(
        "Team",
        back_populates="lead",
        foreign_keys="Team.lead_id",
    )
    supervisor: Mapped[TeamMember | None] = relationship(
        "TeamMember",
        back_populates="direct_reports",
        foreign_keys=[supervisor_id],
        remote_side="TeamMember.uuid",
    )
    direct_reports: Mapped[list[TeamMember]] = relationship(
        "TeamMember",
        back_populates="supervisor",
        foreign_keys="TeamMember.supervisor_id",
    )
    functional_manager: Mapped[TeamMember | None] = relationship(
        "TeamMember",
        back_populates="functional_reports",
        foreign_keys=[functional_manager_id],
        remote_side="TeamMember.uuid",
    )
    functional_reports: Mapped[list[TeamMember]] = relationship(
        "TeamMember",
        back_populates="functional_manager",
        foreign_keys="TeamMember.functional_manager_id",
    )
    history: Mapped[list[MemberHistory]] = relationship("MemberHistory", back_populates="member")
    program_assignments: Mapped[list[ProgramAssignment]] = relationship(
        "ProgramAssignment", back_populates="member"
    )
