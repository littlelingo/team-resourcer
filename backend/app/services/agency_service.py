from __future__ import annotations

"""CRUD operations for agencies."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agency import Agency
from app.schemas.agency import AgencyCreate, AgencyUpdate


async def list_agencies(db: AsyncSession) -> list[Agency]:
    """Return all agencies ordered by name."""
    result = await db.execute(select(Agency).order_by(Agency.name))
    return list(result.scalars().all())


async def get_agency(db: AsyncSession, agency_id: int) -> Agency | None:
    """Fetch a single agency by ID."""
    result = await db.execute(select(Agency).where(Agency.id == agency_id))
    return result.scalar_one_or_none()


async def create_agency(db: AsyncSession, data: AgencyCreate) -> Agency:
    """Create a new agency."""
    agency = Agency(**data.model_dump())
    db.add(agency)
    await db.commit()
    await db.refresh(agency)
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
    return agency


async def delete_agency(db: AsyncSession, agency_id: int) -> bool:
    """Delete an agency. Returns True if found and deleted, False otherwise."""
    agency = await get_agency(db, agency_id)
    if agency is None:
        return False
    await db.delete(agency)
    await db.commit()
    return True
