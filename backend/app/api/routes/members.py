"""Route handlers for team member CRUD and profile image upload."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas import (
    TeamMemberCreate,
    TeamMemberDetailResponse,
    TeamMemberListResponse,
    TeamMemberUpdate,
)
from app.services import (
    create_member,
    delete_member,
    get_member,
    list_members,
    save_profile_image,
    update_member,
)

router = APIRouter()


@router.get("/", response_model=list[TeamMemberListResponse])
async def list_members_route(
    program_id: int | None = None,
    area_id: int | None = None,
    team_id: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[TeamMemberListResponse]:
    """List all members with optional filters."""
    return await list_members(db, program_id=program_id, area_id=area_id, team_id=team_id)


@router.get("/{member_uuid}", response_model=TeamMemberDetailResponse)
async def get_member_route(
    member_uuid: UUID,
    db: AsyncSession = Depends(get_db),
) -> TeamMemberDetailResponse:
    """Fetch a single member by UUID."""
    member = await get_member(db, member_uuid)
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.post("/", response_model=TeamMemberDetailResponse, status_code=201)
async def create_member_route(
    data: TeamMemberCreate,
    db: AsyncSession = Depends(get_db),
) -> TeamMemberDetailResponse:
    """Create a new member and return the detail response."""
    return await create_member(db, data)


@router.put("/{member_uuid}", response_model=TeamMemberDetailResponse)
async def update_member_route(
    member_uuid: UUID,
    data: TeamMemberUpdate,
    db: AsyncSession = Depends(get_db),
) -> TeamMemberDetailResponse:
    """Update an existing member by UUID."""
    member = await update_member(db, member_uuid, data)
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.delete("/{member_uuid}", status_code=204)
async def delete_member_route(
    member_uuid: UUID,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete a member by UUID."""
    found = await delete_member(db, member_uuid)
    if not found:
        raise HTTPException(status_code=404, detail="Member not found")
    return Response(status_code=204)


@router.post("/{member_uuid}/image")
async def upload_image_route(
    member_uuid: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Upload a profile image for a member."""
    member = await get_member(db, member_uuid)
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    try:
        image_path = await save_profile_image(member_uuid, file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    member.image_path = image_path
    await db.commit()
    return {"image_path": image_path}
