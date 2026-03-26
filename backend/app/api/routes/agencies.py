"""Route handlers for agency CRUD."""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas import (
    AgencyCreate,
    AgencyListResponse,
    AgencyResponse,
    AgencyUpdate,
)
from app.services import (
    create_agency,
    delete_agency,
    get_agency,
    list_agencies,
    update_agency,
)

router = APIRouter()


@router.get("/", response_model=list[AgencyListResponse])
async def list_agencies_route(
    db: AsyncSession = Depends(get_db),
) -> list[AgencyListResponse]:
    """List all agencies."""
    return await list_agencies(db)


@router.get("/{agency_id}", response_model=AgencyResponse)
async def get_agency_route(
    agency_id: int,
    db: AsyncSession = Depends(get_db),
) -> AgencyResponse:
    """Fetch a single agency by ID."""
    agency = await get_agency(db, agency_id)
    if agency is None:
        raise HTTPException(status_code=404, detail="Agency not found")
    return agency


@router.post("/", response_model=AgencyResponse, status_code=201)
async def create_agency_route(
    data: AgencyCreate,
    db: AsyncSession = Depends(get_db),
) -> AgencyResponse:
    """Create a new agency."""
    return await create_agency(db, data)


@router.put("/{agency_id}", response_model=AgencyResponse)
async def update_agency_route(
    agency_id: int,
    data: AgencyUpdate,
    db: AsyncSession = Depends(get_db),
) -> AgencyResponse:
    """Update an existing agency by ID."""
    agency = await update_agency(db, agency_id, data)
    if agency is None:
        raise HTTPException(status_code=404, detail="Agency not found")
    return agency


@router.delete("/{agency_id}", status_code=204)
async def delete_agency_route(
    agency_id: int,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete an agency by ID."""
    found = await delete_agency(db, agency_id)
    if not found:
        raise HTTPException(status_code=404, detail="Agency not found")
    return Response(status_code=204)
