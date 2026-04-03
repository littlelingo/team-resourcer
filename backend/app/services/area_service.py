from __future__ import annotations

"""CRUD operations for functional areas."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.functional_area import FunctionalArea
from app.schemas.functional_area import FunctionalAreaCreate, FunctionalAreaUpdate


async def list_areas(db: AsyncSession) -> list[FunctionalArea]:
    """Return all functional areas ordered by name."""
    result = await db.execute(
        select(FunctionalArea)
        .options(selectinload(FunctionalArea.members))
        .order_by(FunctionalArea.name)
    )
    areas = list(result.scalars().all())
    for a in areas:
        a.member_count = len(a.members)  # type: ignore[attr-defined]
    return areas


async def get_area(db: AsyncSession, area_id: int) -> FunctionalArea | None:
    """Fetch a single functional area by ID."""
    result = await db.execute(
        select(FunctionalArea)
        .options(selectinload(FunctionalArea.members))
        .where(FunctionalArea.id == area_id)
    )
    area = result.scalar_one_or_none()
    if area is not None:
        area.member_count = len(area.members)  # type: ignore[attr-defined]
    return area


async def create_area(db: AsyncSession, data: FunctionalAreaCreate) -> FunctionalArea:
    """Create a new functional area."""
    area = FunctionalArea(**data.model_dump())
    db.add(area)
    await db.commit()
    await db.refresh(area)
    result = await db.execute(
        select(FunctionalArea)
        .options(selectinload(FunctionalArea.members))
        .where(FunctionalArea.id == area.id)
    )
    area = result.scalar_one()
    area.member_count = len(area.members)  # type: ignore[attr-defined]
    return area


async def update_area(
    db: AsyncSession, area_id: int, data: FunctionalAreaUpdate
) -> FunctionalArea | None:
    """Update an existing functional area. Returns None if not found."""
    area = await get_area(db, area_id)
    if area is None:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(area, field, value)
    await db.commit()
    await db.refresh(area)
    result = await db.execute(
        select(FunctionalArea)
        .options(selectinload(FunctionalArea.members))
        .where(FunctionalArea.id == area.id)
    )
    area = result.scalar_one()
    area.member_count = len(area.members)  # type: ignore[attr-defined]
    return area


async def delete_area(db: AsyncSession, area_id: int) -> bool:
    """Delete a functional area. Returns True if found and deleted, False otherwise."""
    area = await get_area(db, area_id)
    if area is None:
        return False
    await db.delete(area)
    await db.commit()
    return True
