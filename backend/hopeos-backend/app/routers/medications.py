from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.medication import Medication
from app.models.pharmacy_order import PharmacyOrder
from app.models.user import User
from app.schemas.medication import MedicationCreate, MedicationResponse
from app.auth.dependencies import get_current_user, require_roles

router = APIRouter()


@router.get("")
async def list_medications(
    patient_id: str | None = None,
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List medications, optionally filtered by patient and status."""
    query = select(Medication).order_by(Medication.prescribed_date.desc())
    if patient_id:
        query = query.where(Medication.patient_id == patient_id)
    if status_filter:
        query = query.where(Medication.status == status_filter)
    query = query.limit(100)

    result = await db.execute(query)
    medications = result.scalars().all()
    return [MedicationResponse.model_validate(m) for m in medications]


@router.get("/{medication_id}", response_model=MedicationResponse)
async def get_medication(
    medication_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a medication by ID."""
    result = await db.execute(select(Medication).where(Medication.id == medication_id))
    medication = result.scalar_one_or_none()
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    return medication


@router.post("", response_model=MedicationResponse, status_code=status.HTTP_201_CREATED)
async def create_medication(
    med_data: MedicationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "doctor"])),
):
    """Create a new medication (prescription)."""
    medication = Medication(
        patient_id=med_data.patient_id,
        encounter_id=med_data.encounter_id,
        drug_name=med_data.drug_name,
        drug_code=med_data.drug_code,
        dosage=med_data.dosage,
        dosage_unit=med_data.dosage_unit,
        frequency=med_data.frequency,
        route=med_data.route,
        duration=med_data.duration,
        duration_unit=med_data.duration_unit,
        quantity=med_data.quantity,
        instructions=med_data.instructions,
        prescribed_by=current_user.id,
    )
    db.add(medication)
    await db.flush()  # Get medication ID

    # Auto-create pharmacy order if requested
    if med_data.create_pharmacy_order:
        pharmacy_order = PharmacyOrder(
            patient_id=med_data.patient_id,
            medication_id=medication.id,
            drug_name=med_data.drug_name,
            dosage=med_data.dosage,
            quantity=med_data.quantity,
            prescribed_by=current_user.id,
        )
        db.add(pharmacy_order)

    await db.commit()
    await db.refresh(medication)
    return medication
