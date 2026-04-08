from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.diagnosis import Diagnosis
from app.models.catalog import DiagnosisConcept
from app.models.user import User
from app.schemas.diagnosis import DiagnosisCreate, DiagnosisResponse
from app.auth.dependencies import get_current_user, require_roles

router = APIRouter()


@router.get("")
async def list_diagnoses(
    patient_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List diagnoses, optionally filtered by patient."""
    query = select(Diagnosis).order_by(Diagnosis.diagnosed_date.desc())
    if patient_id:
        query = query.where(Diagnosis.patient_id == patient_id)
    query = query.limit(100)

    result = await db.execute(query)
    diagnoses = result.scalars().all()
    return [DiagnosisResponse.model_validate(d) for d in diagnoses]


@router.get("/search")
async def search_diagnoses(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search diagnosis concepts."""
    search_term = f"%{q.lower()}%"

    result = await db.execute(
        select(DiagnosisConcept)
        .where(func.lower(DiagnosisConcept.name).like(search_term))
        .where(DiagnosisConcept.active == True)
        .limit(20)
    )
    concepts = result.scalars().all()

    # If no results from catalog, return common diagnoses
    if not concepts:
        common_diagnoses = [
            "Malaria", "Upper Respiratory Tract Infection", "Hypertension",
            "Diabetes Mellitus Type 2", "Gastritis", "Urinary Tract Infection",
            "Pneumonia", "Anemia", "Diarrhea", "Skin Infection",
        ]
        return [{"name": d, "code": None, "category": "Common"} for d in common_diagnoses if q.lower() in d.lower()]

    return [{"id": c.id, "name": c.name, "code": c.code, "category": c.category} for c in concepts]


@router.post("", response_model=DiagnosisResponse, status_code=status.HTTP_201_CREATED)
async def create_diagnosis(
    diag_data: DiagnosisCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "doctor"])),
):
    """Create a new diagnosis."""
    diagnosis = Diagnosis(
        patient_id=diag_data.patient_id,
        encounter_id=diag_data.encounter_id,
        condition_text=diag_data.condition_text,
        condition_code=diag_data.condition_code,
        certainty=diag_data.certainty,
        rank=diag_data.rank,
        notes=diag_data.notes,
        diagnosed_by=current_user.id,
    )
    db.add(diagnosis)
    await db.commit()
    await db.refresh(diagnosis)
    return diagnosis
