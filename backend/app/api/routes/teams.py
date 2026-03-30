"""Route handlers for team CRUD and team membership management."""

from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas import (
    TeamCreate,
    TeamMemberAddResponse,
    TeamResponse,
    TeamUpdate,
)
from app.services import (
    add_member_to_team,
    create_team,
    delete_team,
    get_team,
    list_teams,
    remove_member_from_team,
    update_team,
)

router = APIRouter()


@router.get("/", response_model=list[TeamResponse])
async def list_teams_route(
    area_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[TeamResponse]:
    """List all teams within a functional area."""
    return await list_teams(db, area_id=area_id)


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team_route(
    area_id: int,
    team_id: int,
    db: AsyncSession = Depends(get_db),
) -> TeamResponse:
    """Fetch a single team by ID within a functional area."""
    team = await get_team(db, team_id)
    if team is None or team.functional_area_id != area_id:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@router.post("/", response_model=TeamResponse, status_code=201)
async def create_team_route(
    area_id: int,
    data: TeamCreate,
    db: AsyncSession = Depends(get_db),
) -> TeamResponse:
    """Create a new team within a functional area."""
    # Override functional_area_id from path parameter
    data = data.model_copy(update={"functional_area_id": area_id})
    return await create_team(db, data)


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team_route(
    area_id: int,
    team_id: int,
    data: TeamUpdate,
    db: AsyncSession = Depends(get_db),
) -> TeamResponse:
    """Update an existing team by ID within a functional area."""
    team = await get_team(db, team_id)
    if team is None or team.functional_area_id != area_id:
        raise HTTPException(status_code=404, detail="Team not found")
    team = await update_team(db, team_id, data)
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@router.delete("/{team_id}", status_code=204)
async def delete_team_route(
    area_id: int,
    team_id: int,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a team by ID within a functional area."""
    team = await get_team(db, team_id)
    if team is None or team.functional_area_id != area_id:
        raise HTTPException(status_code=404, detail="Team not found")
    await delete_team(db, team_id)
    return Response(status_code=204)


@router.post("/{team_id}/members", response_model=TeamMemberAddResponse)
async def add_member_route(
    area_id: int,
    team_id: int,
    member_uuid: UUID = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Add a member to a team."""
    found = await add_member_to_team(db, team_id, member_uuid)
    if not found:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"ok": True}


@router.delete("/{team_id}/members/{member_uuid}", status_code=204)
async def remove_member_route(
    area_id: int,
    team_id: int,
    member_uuid: UUID,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Remove a member from a team."""
    found = await remove_member_from_team(db, team_id, member_uuid)
    if not found:
        raise HTTPException(status_code=404, detail="Member not found in team")
    return Response(status_code=204)
