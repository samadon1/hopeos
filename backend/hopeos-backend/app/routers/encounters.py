from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.encounter import Encounter
from app.models.user import User
from app.schemas.encounter import EncounterCreate, EncounterUpdate, EncounterResponse
from app.auth.dependencies import get_current_user, require_roles

router = APIRouter()


@router.get("")
async def list_encounters(
    patient_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List encounters, optionally filtered by patient."""
    query = select(Encounter).order_by(Encounter.encounter_datetime.desc())
    if patient_id:
        query = query.where(Encounter.patient_id == patient_id)
    query = query.limit(100)

    result = await db.execute(query)
    encounters = result.scalars().all()
    return [EncounterResponse.model_validate(e) for e in encounters]


@router.get("/{encounter_id}", response_model=EncounterResponse)
async def get_encounter(
    encounter_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get an encounter by ID."""
    result = await db.execute(select(Encounter).where(Encounter.id == encounter_id))
    encounter = result.scalar_one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return encounter


@router.post("", response_model=EncounterResponse, status_code=status.HTTP_201_CREATED)
async def create_encounter(
    encounter_data: EncounterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "doctor", "nurse"])),
):
    """Create a new encounter."""
    encounter = Encounter(
        patient_id=encounter_data.patient_id,
        visit_id=encounter_data.visit_id,
        encounter_type=encounter_data.encounter_type,
        location=encounter_data.location,
        notes=encounter_data.notes,
        diagnosis=encounter_data.diagnosis,
        structured_data=encounter_data.structured_data,
        vitals_data=encounter_data.vitals_data,
        provider_id=current_user.id,
    )
    db.add(encounter)
    await db.commit()
    await db.refresh(encounter)
    return encounter


@router.put("/{encounter_id}", response_model=EncounterResponse)
async def update_encounter(
    encounter_id: str,
    encounter_data: EncounterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "doctor", "nurse"])),
):
    """Update an encounter."""
    result = await db.execute(select(Encounter).where(Encounter.id == encounter_id))
    encounter = result.scalar_one_or_none()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")

    update_data = encounter_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(encounter, field, value)

    await db.commit()
    await db.refresh(encounter)
    return encounter
