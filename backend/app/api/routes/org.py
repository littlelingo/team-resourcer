"""Route handlers for org-wide tree and supervisor management."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas import FunctionalManagerUpdate, SupervisorUpdate, TeamMemberDetailResponse
from app.schemas.tree import TreeResponse
from app.services import set_functional_manager, set_supervisor
from app.services.tree_service import build_org_tree

router = APIRouter()


@router.get("/tree", response_model=TreeResponse)
async def get_org_tree_route(
    db: AsyncSession = Depends(get_db),
) -> TreeResponse:
    """Fetch the full org-wide supervisor hierarchy as a node/edge tree."""
    return await build_org_tree(db)


@router.put("/members/{member_uuid}/supervisor", response_model=TeamMemberDetailResponse)
async def set_supervisor_route(
    member_uuid: UUID,
    data: SupervisorUpdate,
    db: AsyncSession = Depends(get_db),
) -> TeamMemberDetailResponse:
    """Set or clear the supervisor for a member by UUID."""
    try:
        member = await set_supervisor(db, member_uuid, data.supervisor_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.put("/members/{member_uuid}/functional-manager", response_model=TeamMemberDetailResponse)
async def set_functional_manager_route(
    member_uuid: UUID,
    data: FunctionalManagerUpdate,
    db: AsyncSession = Depends(get_db),
) -> TeamMemberDetailResponse:
    """Set or clear the functional manager for a member by UUID."""
    try:
        member = await set_functional_manager(db, member_uuid, data.functional_manager_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return member
