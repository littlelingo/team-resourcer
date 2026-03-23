from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas import SupervisorUpdate, TeamMemberDetailResponse
from app.schemas.tree import TreeResponse
from app.services import set_supervisor
from app.services.tree_service import build_org_tree

router = APIRouter()


@router.get("/tree", response_model=TreeResponse)
async def get_org_tree_route(
    db: AsyncSession = Depends(get_db),
) -> TreeResponse:
    return await build_org_tree(db)


@router.put("/members/{member_uuid}/supervisor", response_model=TeamMemberDetailResponse)
async def set_supervisor_route(
    member_uuid: UUID,
    data: SupervisorUpdate,
    db: AsyncSession = Depends(get_db),
) -> TeamMemberDetailResponse:
    try:
        member = await set_supervisor(db, member_uuid, data.supervisor_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return member
