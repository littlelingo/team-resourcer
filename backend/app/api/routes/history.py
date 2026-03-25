"""Route handlers for member financial history."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas import HistoryFieldEnum, MemberHistoryResponse
from app.services import get_member_history

router = APIRouter()


@router.get("/", response_model=list[MemberHistoryResponse])
async def get_history_route(
    member_uuid: UUID,
    field: HistoryFieldEnum | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[MemberHistoryResponse]:
    """List history entries for a member with optional field filter."""
    field_str = field.value if field is not None else None
    return await get_member_history(db, member_uuid, field=field_str)
