from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.observation import Observation
from app.models.user import User
from app.schemas.observation import ObservationCreate, ObservationResponse
from app.auth.dependencies import get_current_user, require_roles

router = APIRouter()


@router.get("")
async def list_observations(
    patient_id: str | None = None,
    concept_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List observations, optionally filtered by patient and concept type."""
    query = select(Observation).order_by(Observation.obs_datetime.desc())
    if patient_id:
        query = query.where(Observation.patient_id == patient_id)
    if concept_type:
        query = query.where(Observation.concept_type == concept_type)
    query = query.limit(200)

    result = await db.execute(query)
    observations = result.scalars().all()
    return [ObservationResponse.model_validate(o) for o in observations]


@router.get("/vitals/{patient_id}")
async def get_patient_vitals(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get vital signs for a patient."""
    result = await db.execute(
        select(Observation)
        .where(Observation.patient_id == patient_id)
        .where(Observation.concept_type == "vital_signs")
        .order_by(Observation.obs_datetime.desc())
        .limit(50)
    )
    observations = result.scalars().all()
    return [ObservationResponse.model_validate(o) for o in observations]


@router.get("/lab-results/{patient_id}")
async def get_patient_lab_results(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get lab results for a patient."""
    result = await db.execute(
        select(Observation)
        .where(Observation.patient_id == patient_id)
        .where(Observation.concept_type == "lab_result")
        .order_by(Observation.obs_datetime.desc())
        .limit(50)
    )
    observations = result.scalars().all()
    return [ObservationResponse.model_validate(o) for o in observations]


@router.post("", response_model=ObservationResponse, status_code=status.HTTP_201_CREATED)
async def create_observation(
    obs_data: ObservationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "doctor", "nurse", "lab"])),
):
    """Create a new observation."""
    observation = Observation(
        patient_id=obs_data.patient_id,
        encounter_id=obs_data.encounter_id,
        visit_id=obs_data.visit_id,
        concept_type=obs_data.concept_type,
        concept_code=obs_data.concept_code,
        concept_display=obs_data.concept_display,
        value_type=obs_data.value_type,
        value_numeric=obs_data.value_numeric,
        value_text=obs_data.value_text,
        value_coded=obs_data.value_coded,
        unit=obs_data.unit,
        extra_data=obs_data.extra_data,
        created_by=current_user.id,
    )
    db.add(observation)
    await db.commit()
    await db.refresh(observation)
    return observation
