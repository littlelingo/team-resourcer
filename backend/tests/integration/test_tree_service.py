from app.models.program_assignment import ProgramAssignment
from app.models.team_member import TeamMember
from app.services.tree_service import build_area_tree, build_org_tree, build_program_tree


async def test_build_org_tree_empty(db_session):
    result = await build_org_tree(db_session)
    assert result.nodes == []
    assert result.edges == []


async def test_build_org_tree_single_member(db_session, area, member):
    result = await build_org_tree(db_session)
    assert len(result.nodes) == 1
    assert result.nodes[0].id == f"member-{member.uuid}"
    assert result.edges == []


async def test_build_org_tree_supervisor_edge(db_session, area):
    alice = TeamMember(employee_id="TREE001", name="Alice", functional_area_id=area.id)
    bob = TeamMember(employee_id="TREE002", name="Bob", functional_area_id=area.id)
    db_session.add_all([alice, bob])
    await db_session.flush()
    bob.supervisor_id = alice.uuid
    await db_session.flush()
    result = await build_org_tree(db_session)
    assert len(result.nodes) == 2
    assert len(result.edges) == 1
    edge = result.edges[0]
    assert edge.source == f"member-{alice.uuid}"
    assert edge.target == f"member-{bob.uuid}"


async def test_build_program_tree_not_found(db_session):
    result = await build_program_tree(db_session, 99999)
    assert result is None


async def test_build_program_tree_with_members(db_session, area, member, program):
    pa = ProgramAssignment(member_uuid=member.uuid, program_id=program.id, role="Lead")
    db_session.add(pa)
    await db_session.flush()
    result = await build_program_tree(db_session, program.id)
    node_ids = [n.id for n in result.nodes]
    assert f"program-{program.id}" in node_ids
    assert f"member-{member.uuid}" in node_ids
    assert len(result.edges) == 1


async def test_build_area_tree_not_found(db_session):
    result = await build_area_tree(db_session, 99999)
    assert result is None


async def test_build_area_tree_structure(db_session, area, team, member):
    member.team_id = team.id
    await db_session.flush()
    result = await build_area_tree(db_session, area.id)
    node_ids = [n.id for n in result.nodes]
    assert f"area-{area.id}" in node_ids
    assert f"team-{team.id}" in node_ids
    assert f"member-{member.uuid}" in node_ids
    edge_sources = [e.source for e in result.edges]
    assert f"area-{area.id}" in edge_sources
    assert f"team-{team.id}" in edge_sources


async def test_build_area_tree_member_without_team_links_to_area(db_session, area, member):
    result = await build_area_tree(db_session, area.id)
    area_edges = [e for e in result.edges if e.source == f"area-{area.id}"]
    assert any(e.target == f"member-{member.uuid}" for e in area_edges)
