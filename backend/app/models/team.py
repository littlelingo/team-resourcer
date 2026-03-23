from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.functional_area import FunctionalArea
    from app.models.team_member import TeamMember


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    functional_area_id: Mapped[int] = mapped_column(
        ForeignKey("functional_areas.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("team_members.uuid", use_alter=True, name="fk_teams_lead_id"),
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
    functional_area: Mapped[FunctionalArea] = relationship("FunctionalArea", back_populates="teams")
    lead: Mapped[TeamMember | None] = relationship(
        "TeamMember",
        foreign_keys=[lead_id],
        back_populates="led_team",
    )
    members: Mapped[list[TeamMember]] = relationship(
        "TeamMember",
        back_populates="team",
        foreign_keys="TeamMember.team_id",
    )

    __table_args__ = (Index("ix_teams_functional_area_id", "functional_area_id"),)
