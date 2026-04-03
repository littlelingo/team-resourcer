"""Route handlers for program team CRUD and program team membership management."""

from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.program_team import (
    ProgramTeamCreate,
    ProgramTeamResponse,
    ProgramTeamUpdate,
)
from app.schemas.team import TeamMemberAddResponse
from app.services.program_team_service import (
    add_member_to_program_team,
    create_program_team,
    delete_program_team,
    get_program_team,
    list_program_teams,
    remove_member_from_program_team,
    update_program_team,
)

router = APIRouter()


@router.get("/", response_model=list[ProgramTeamResponse])
async def list_program_teams_route(
    program_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[ProgramTeamResponse]:
    """List all teams within a program."""
    return await list_program_teams(db, program_id=program_id)


@router.get("/{program_team_id}", response_model=ProgramTeamResponse)
async def get_program_team_route(
    program_id: int,
    program_team_id: int,
    db: AsyncSession = Depends(get_db),
) -> ProgramTeamResponse:
    """Fetch a single program team by ID."""
    team = await get_program_team(db, program_team_id)
    if team is None or team.program_id != program_id:
        raise HTTPException(status_code=404, detail="Program team not found")
    return team


@router.post("/", response_model=ProgramTeamResponse, status_code=201)
async def create_program_team_route(
    program_id: int,
    data: ProgramTeamCreate,
    db: AsyncSession = Depends(get_db),
) -> ProgramTeamResponse:
    """Create a new team within a program."""
    try:
        return await create_program_team(db, data, program_id=program_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/{program_team_id}", response_model=ProgramTeamResponse)
async def update_program_team_route(
    program_id: int,
    program_team_id: int,
    data: ProgramTeamUpdate,
    db: AsyncSession = Depends(get_db),
) -> ProgramTeamResponse:
    """Update an existing program team by ID."""
    team = await get_program_team(db, program_team_id)
    if team is None or team.program_id != program_id:
        raise HTTPException(status_code=404, detail="Program team not found")
    team = await update_program_team(db, program_team_id, data)
    if team is None:
        raise HTTPException(status_code=404, detail="Program team not found")
    return team


@router.delete("/{program_team_id}", status_code=204)
async def delete_program_team_route(
    program_id: int,
    program_team_id: int,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a program team by ID."""
    team = await get_program_team(db, program_team_id)
    if team is None or team.program_id != program_id:
        raise HTTPException(status_code=404, detail="Program team not found")
    await delete_program_team(db, program_team_id)
    return Response(status_code=204)


@router.post("/{program_team_id}/members", response_model=TeamMemberAddResponse)
async def add_member_route(
    program_id: int,
    program_team_id: int,
    member_uuid: UUID = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Add a member to a program team (auto-creates program assignment if needed)."""
    team = await get_program_team(db, program_team_id)
    if team is None or team.program_id != program_id:
        raise HTTPException(status_code=404, detail="Program team not found")
    found = await add_member_to_program_team(db, program_team_id, member_uuid)
    if not found:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"ok": True}


@router.delete("/{program_team_id}/members/{member_uuid}", status_code=204)
async def remove_member_route(
    program_id: int,
    program_team_id: int,
    member_uuid: UUID,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Remove a member from a program team (keeps program assignment)."""
    team = await get_program_team(db, program_team_id)
    if team is None or team.program_id != program_id:
        raise HTTPException(status_code=404, detail="Program team not found")
    found = await remove_member_from_program_team(db, program_team_id, member_uuid)
    if not found:
        raise HTTPException(status_code=404, detail="Member not found in program team")
    return Response(status_code=204)
