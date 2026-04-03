"""Route handlers for program CRUD, tree, members, and assignments."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.program_teams import router as program_teams_router
from app.core.database import get_db
from app.schemas import (
    ProgramAssignmentCreate,
    ProgramAssignmentResponse,
    ProgramCreate,
    ProgramResponse,
    ProgramUpdate,
    TeamMemberListResponse,
)
from app.schemas.tree import TreeResponse
from app.services import (
    assign_member,
    create_program,
    delete_program,
    get_program,
    get_program_members,
    list_programs,
    unassign_member,
    update_program,
)
from app.services.tree_service import build_program_tree

router = APIRouter()

# Mount program teams as a sub-router under each program
router.include_router(program_teams_router, prefix="/{program_id}/teams", tags=["program-teams"])


@router.get("/", response_model=list[ProgramResponse])
async def list_programs_route(
    db: AsyncSession = Depends(get_db),
) -> list[ProgramResponse]:
    """List all programs."""
    return await list_programs(db)


@router.get("/{program_id}", response_model=ProgramResponse)
async def get_program_route(
    program_id: int,
    db: AsyncSession = Depends(get_db),
) -> ProgramResponse:
    """Fetch a single program by ID."""
    program = await get_program(db, program_id)
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")
    return program


@router.post("/", response_model=ProgramResponse, status_code=201)
async def create_program_route(
    data: ProgramCreate,
    db: AsyncSession = Depends(get_db),
) -> ProgramResponse:
    """Create a new program."""
    return await create_program(db, data)


@router.put("/{program_id}", response_model=ProgramResponse)
async def update_program_route(
    program_id: int,
    data: ProgramUpdate,
    db: AsyncSession = Depends(get_db),
) -> ProgramResponse:
    """Update an existing program by ID."""
    program = await update_program(db, program_id, data)
    if program is None:
        raise HTTPException(status_code=404, detail="Program not found")
    return program


@router.delete("/{program_id}", status_code=204)
async def delete_program_route(
    program_id: int,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a program by ID."""
    found = await delete_program(db, program_id)
    if not found:
        raise HTTPException(status_code=404, detail="Program not found")
    return Response(status_code=204)


@router.get("/{program_id}/tree", response_model=TreeResponse)
async def get_program_tree_route(
    program_id: int,
    db: AsyncSession = Depends(get_db),
) -> TreeResponse:
    """Fetch the node/edge tree for a single program."""
    tree = await build_program_tree(db, program_id)
    if tree is None:
        raise HTTPException(status_code=404, detail="Program not found")
    return tree


@router.get("/{program_id}/members", response_model=list[TeamMemberListResponse])
async def get_program_members_route(
    program_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[TeamMemberListResponse]:
    """List all members assigned to a program."""
    return await get_program_members(db, program_id)


@router.post("/{program_id}/assignments", response_model=ProgramAssignmentResponse, status_code=201)
async def assign_member_route(
    program_id: int,
    data: ProgramAssignmentCreate,
    db: AsyncSession = Depends(get_db),
) -> ProgramAssignmentResponse:
    """Assign a member to a program."""
    try:
        return await assign_member(db, program_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{program_id}/assignments/{member_uuid}", status_code=204)
async def unassign_member_route(
    program_id: int,
    member_uuid: UUID,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Remove a member's assignment from a program."""
    found = await unassign_member(db, program_id, member_uuid)
    if not found:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return Response(status_code=204)
