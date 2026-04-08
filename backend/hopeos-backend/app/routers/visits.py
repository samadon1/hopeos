from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from app.database import get_db
from app.models.visit import Visit
from app.models.user import User
from app.schemas.visit import VisitCreate, VisitUpdate, VisitResponse
from app.auth.dependencies import get_current_user, require_roles

router = APIRouter()


@router.get("")
async def list_visits(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all visits."""
    result = await db.execute(select(Visit).order_by(Visit.start_datetime.desc()).limit(100))
    visits = result.scalars().all()
    return [VisitResponse.model_validate(v) for v in visits]


@router.get("/{visit_id}", response_model=VisitResponse)
async def get_visit(
    visit_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a visit by ID."""
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    return visit


@router.post("", response_model=VisitResponse, status_code=status.HTTP_201_CREATED)
async def create_visit(
    visit_data: VisitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "doctor", "nurse", "registrar"])),
):
    """Create a new visit."""
    visit = Visit(
        patient_id=visit_data.patient_id,
        visit_type=visit_data.visit_type,
        location=visit_data.location,
        created_by=current_user.id,
    )
    db.add(visit)
    await db.commit()
    await db.refresh(visit)
    return visit


@router.put("/{visit_id}", response_model=VisitResponse)
async def update_visit(
    visit_id: str,
    visit_data: VisitUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "doctor", "nurse"])),
):
    """Update a visit."""
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    update_data = visit_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(visit, field, value)

    await db.commit()
    await db.refresh(visit)
    return visit
