from __future__ import annotations

"""Build flat node/edge tree structures for org, program, and area views."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.functional_area import FunctionalArea
from app.models.program import Program
from app.models.program_assignment import ProgramAssignment
from app.models.team import Team
from app.models.team_member import TeamMember
from app.schemas.tree import TreeEdge, TreeNode, TreeResponse


async def build_org_tree(db: AsyncSession) -> TreeResponse:
    """Build a flat node/edge tree of the full supervisor hierarchy."""
    stmt = select(TeamMember).order_by(TeamMember.last_name, TeamMember.first_name)
    result = await db.execute(stmt)
    members = result.scalars().all()

    nodes: list[TreeNode] = []
    edges: list[TreeEdge] = []

    for member in members:
        nodes.append(
            TreeNode(
                id=f"member-{member.uuid}",
                type="member",
                data={
                    "uuid": str(member.uuid),
                    "name": member.name,
                    "title": member.title,
                    "image_path": member.image_path,
                },
            )
        )
        if member.supervisor_id is not None:
            edges.append(
                TreeEdge(
                    id=f"edge-{member.supervisor_id}-{member.uuid}",
                    source=f"member-{member.supervisor_id}",
                    target=f"member-{member.uuid}",
                )
            )

    return TreeResponse(nodes=nodes, edges=edges)


async def build_program_tree(db: AsyncSession, program_id: int) -> TreeResponse | None:
    """Build a flat node/edge tree for a single program and its assigned members."""
    program_result = await db.execute(select(Program).where(Program.id == program_id))
    program = program_result.scalar_one_or_none()
    if program is None:
        return None

    stmt = (
        select(ProgramAssignment, TeamMember)
        .join(TeamMember, TeamMember.uuid == ProgramAssignment.member_uuid)
        .where(ProgramAssignment.program_id == program_id)
        .order_by(TeamMember.last_name, TeamMember.first_name)
    )
    rows = (await db.execute(stmt)).all()

    # Collect all member UUIDs in this program to look up total program counts
    member_uuids = [member.uuid for _, member in rows]
    program_count_map: dict = {}
    if member_uuids:
        # Count how many programs each member belongs to
        count_stmt = select(
            ProgramAssignment.member_uuid, ProgramAssignment.program_id
        ).where(ProgramAssignment.member_uuid.in_(member_uuids))
        count_rows = (await db.execute(count_stmt)).all()
        for row_uuid, _ in count_rows:
            program_count_map[row_uuid] = program_count_map.get(row_uuid, 0) + 1

    nodes: list[TreeNode] = [
        TreeNode(
            id=f"program-{program.id}",
            type="program",
            data={
                "id": program.id,
                "name": program.name,
                "description": program.description,
            },
        )
    ]
    edges: list[TreeEdge] = []

    for assignment, member in rows:
        member_node_id = f"member-{member.uuid}"
        total_programs = program_count_map.get(member.uuid, 1)
        nodes.append(
            TreeNode(
                id=member_node_id,
                type="member",
                data={
                    "uuid": str(member.uuid),
                    "name": member.name,
                    "title": member.title,
                    "image_path": member.image_path,
                    "role": assignment.role,
                    "program_count": total_programs,
                },
            )
        )
        edges.append(
            TreeEdge(
                id=f"edge-program-{program.id}-member-{member.uuid}",
                source=f"program-{program.id}",
                target=member_node_id,
            )
        )

    return TreeResponse(nodes=nodes, edges=edges)


async def build_area_tree(db: AsyncSession, area_id: int) -> TreeResponse | None:
    """Build a flat node/edge tree for a functional area: area -> teams -> members."""
    area_result = await db.execute(select(FunctionalArea).where(FunctionalArea.id == area_id))
    area = area_result.scalar_one_or_none()
    if area is None:
        return None

    # Load teams for this area, with their lead (for lead_name)
    teams_result = await db.execute(
        select(Team)
        .where(Team.functional_area_id == area_id)
        .options(selectinload(Team.lead))
        .order_by(Team.name)
    )
    teams = teams_result.scalars().all()

    # Load all members in this area
    members_result = await db.execute(
        select(TeamMember)
        .where(TeamMember.functional_area_id == area_id)
        .order_by(TeamMember.last_name, TeamMember.first_name)
    )
    members = members_result.scalars().all()

    nodes: list[TreeNode] = []
    edges: list[TreeEdge] = []

    area_node_id = f"area-{area.id}"
    nodes.append(
        TreeNode(
            id=area_node_id,
            type="area",
            data={"id": area.id, "name": area.name},
        )
    )

    for team in teams:
        team_node_id = f"team-{team.id}"
        nodes.append(
            TreeNode(
                id=team_node_id,
                type="team",
                data={
                    "id": team.id,
                    "name": team.name,
                    "lead_id": str(team.lead_id) if team.lead_id else None,
                    "lead_name": team.lead.name if team.lead else None,
                },
            )
        )
        edges.append(
            TreeEdge(
                id=f"edge-area-{area.id}-team-{team.id}",
                source=area_node_id,
                target=team_node_id,
            )
        )

    # Map lead UUIDs to the team they lead (for excluding from member nodes)
    lead_team_map = {team.lead_id: team.id for team in teams if team.lead_id}

    for member in members:
        # Skip member node if this member is the lead of the team they belong to
        if member.uuid in lead_team_map and lead_team_map[member.uuid] == member.team_id:
            continue

        member_node_id = f"member-{member.uuid}"
        nodes.append(
            TreeNode(
                id=member_node_id,
                type="member",
                data={
                    "uuid": str(member.uuid),
                    "name": member.name,
                    "title": member.title,
                    "image_path": member.image_path,
                },
            )
        )
        if member.team_id is not None:
            edges.append(
                TreeEdge(
                    id=f"edge-team-{member.team_id}-member-{member.uuid}",
                    source=f"team-{member.team_id}",
                    target=member_node_id,
                )
            )
        else:
            edges.append(
                TreeEdge(
                    id=f"edge-area-{area.id}-member-{member.uuid}",
                    source=area_node_id,
                    target=member_node_id,
                )
            )

    return TreeResponse(nodes=nodes, edges=edges)
