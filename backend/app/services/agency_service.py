from __future__ import annotations

"""CRUD operations for agencies."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.agency import Agency
from app.models.program import Program
from app.schemas.agency import AgencyCreate, AgencyUpdate


def _set_member_count(agency: Agency) -> None:
    """Compute deduplicated member count from agency's programs' assignments."""
    agency.member_count = len(  # type: ignore[attr-defined]
        {a.member_uuid for p in agency.programs for a in p.assignments}
    )


async def list_agencies(db: AsyncSession) -> list[Agency]:
    """Return all agencies ordered by name."""
    result = await db.execute(
        select(Agency)
        .options(selectinload(Agency.programs).selectinload(Program.assignments))
        .order_by(Agency.name)
    )
    agencies = list(result.scalars().all())
    for a in agencies:
        _set_member_count(a)
    return agencies


async def get_agency(db: AsyncSession, agency_id: int) -> Agency | None:
    """Fetch a single agency by ID."""
    result = await db.execute(
        select(Agency)
        .options(selectinload(Agency.programs).selectinload(Program.assignments))
        .where(Agency.id == agency_id)
    )
    agency = result.scalar_one_or_none()
    if agency is not None:
        _set_member_count(agency)
    return agency


async def create_agency(db: AsyncSession, data: AgencyCreate) -> Agency:
    """Create a new agency."""
    agency = Agency(**data.model_dump())
    db.add(agency)
    await db.commit()
    await db.refresh(agency)
    result = await db.execute(
        select(Agency)
        .options(selectinload(Agency.programs).selectinload(Program.assignments))
        .where(Agency.id == agency.id)
    )
    agency = result.scalar_one()
    _set_member_count(agency)
    return agency


async def update_agency(db: AsyncSession, agency_id: int, data: AgencyUpdate) -> Agency | None:
    """Update an existing agency. Returns None if not found."""
    agency = await get_agency(db, agency_id)
    if agency is None:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(agency, field, value)
    await db.commit()
    await db.refresh(agency)
    result = await db.execute(
        select(Agency)
        .options(selectinload(Agency.programs).selectinload(Program.assignments))
        .where(Agency.id == agency.id)
    )
    agency = result.scalar_one()
    _set_member_count(agency)
    return agency


async def delete_agency(db: AsyncSession, agency_id: int) -> bool:
    """Delete an agency. Returns True if found and deleted, False otherwise."""
    agency = await get_agency(db, agency_id)
    if agency is None:
        return False
    await db.delete(agency)
    await db.commit()
    return True
