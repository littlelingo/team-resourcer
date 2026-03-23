from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.teams import router as teams_router
from app.core.database import get_db
from app.schemas import (
    FunctionalAreaCreate,
    FunctionalAreaListResponse,
    FunctionalAreaResponse,
    FunctionalAreaUpdate,
)
from app.services import (
    create_area,
    delete_area,
    get_area,
    list_areas,
    update_area,
)

router = APIRouter()

# Mount teams as a sub-router under each area
router.include_router(teams_router, prefix="/{area_id}/teams", tags=["teams"])


@router.get("/", response_model=list[FunctionalAreaListResponse])
async def list_areas_route(
    db: AsyncSession = Depends(get_db),
) -> list[FunctionalAreaListResponse]:
    return await list_areas(db)


@router.get("/{area_id}", response_model=FunctionalAreaResponse)
async def get_area_route(
    area_id: int,
    db: AsyncSession = Depends(get_db),
) -> FunctionalAreaResponse:
    area = await get_area(db, area_id)
    if area is None:
        raise HTTPException(status_code=404, detail="Area not found")
    return area


@router.post("/", response_model=FunctionalAreaResponse, status_code=201)
async def create_area_route(
    data: FunctionalAreaCreate,
    db: AsyncSession = Depends(get_db),
) -> FunctionalAreaResponse:
    return await create_area(db, data)


@router.put("/{area_id}", response_model=FunctionalAreaResponse)
async def update_area_route(
    area_id: int,
    data: FunctionalAreaUpdate,
    db: AsyncSession = Depends(get_db),
) -> FunctionalAreaResponse:
    area = await update_area(db, area_id, data)
    if area is None:
        raise HTTPException(status_code=404, detail="Area not found")
    return area


@router.delete("/{area_id}", status_code=204)
async def delete_area_route(
    area_id: int,
    db: AsyncSession = Depends(get_db),
) -> Response:
    found = await delete_area(db, area_id)
    if not found:
        raise HTTPException(status_code=404, detail="Area not found")
    return Response(status_code=204)
