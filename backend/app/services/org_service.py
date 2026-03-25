from __future__ import annotations

"""Org-tree building and supervisor management."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.team_member import TeamMember
from app.schemas.org import OrgTreeNode
from app.services.member_service import get_member


def _build_tree(member: TeamMember, member_map: dict[uuid.UUID, TeamMember]) -> OrgTreeNode:
    """Recursively build an OrgTreeNode from a TeamMember using the member_map."""
    direct_reports = [
        _build_tree(member_map[report.uuid], member_map)
        for report in member.direct_reports
        if report.uuid in member_map
    ]
    return OrgTreeNode(
        uuid=member.uuid,
        name=member.name,
        title=member.title,
        image_path=member.image_path,
        direct_reports=direct_reports,
    )


async def get_org_tree(db: AsyncSession) -> list[OrgTreeNode]:
    """Load all members and build a supervisor/direct-report tree in Python."""
    # Load all members with their direct_reports relationship (one level)
    # Python-side tree building handles arbitrary depth without recursive SQL
    stmt = select(TeamMember).options(selectinload(TeamMember.direct_reports))
    result = await db.execute(stmt)
    members = result.scalars().all()

    member_map: dict[uuid.UUID, TeamMember] = {m.uuid: m for m in members}

    # Root nodes are those with no supervisor
    roots = [m for m in members if m.supervisor_id is None]
    return [_build_tree(m, member_map) for m in sorted(roots, key=lambda m: m.name)]


async def set_supervisor(
    db: AsyncSession,
    member_uuid: uuid.UUID,
    supervisor_id: uuid.UUID | None,
) -> TeamMember | None:
    """Set a member's supervisor, guarding against circular references."""
    result = await db.execute(select(TeamMember).where(TeamMember.uuid == member_uuid))
    member = result.scalar_one_or_none()
    if member is None:
        return None

    if supervisor_id is not None:
        # Guard: a member cannot supervise themselves
        if supervisor_id == member_uuid:
            raise ValueError("A member cannot be their own supervisor.")

        # Guard: the proposed supervisor must not be a descendant of the member
        # Walk up the supervisor chain from supervisor_id to check for member_uuid
        await _check_no_cycle(db, member_uuid, supervisor_id)

    member.supervisor_id = supervisor_id
    await db.commit()
    return await get_member(db, member_uuid)


async def _check_no_cycle(
    db: AsyncSession,
    member_uuid: uuid.UUID,
    supervisor_id: uuid.UUID,
) -> None:
    """
    Walk up the supervisor chain starting from supervisor_id.
    Raise ValueError if member_uuid is found, indicating a cycle.
    """
    visited: set[uuid.UUID] = set()
    current_id: uuid.UUID | None = supervisor_id

    while current_id is not None:
        if current_id in visited:
            # Already-existing cycle in the data; stop
            break
        visited.add(current_id)

        if current_id == member_uuid:
            raise ValueError(
                "Setting this supervisor would create a circular reference in the org hierarchy."
            )

        result = await db.execute(
            select(TeamMember.supervisor_id).where(TeamMember.uuid == current_id)
        )
        row = result.one_or_none()
        if row is None:
            break
        current_id = row[0]
