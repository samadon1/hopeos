from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
import re

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.database import get_db
from app.models.patient import Patient
from app.models.diagnosis import Diagnosis
from app.models.allergy import Allergy
from app.models.observation import Observation
from app.models.medication import Medication
from app.models.user import User
from app.schemas.patient import PatientCreate, PatientUpdate, PatientResponse, PatientListResponse
from app.auth.dependencies import get_current_user, require_roles
from app.utils.identifier import generate_patient_identifier

router = APIRouter()


# Schema for creating patient from document scan
class PatientFromScanRequest(BaseModel):
    """Request body for creating a patient from document scan."""
    # Demographics
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    gender: str  # 'M' or 'F' or 'male'/'female'
    birthdate: Optional[str] = None  # YYYY-MM-DD
    phone_number: Optional[str] = None
    ghana_card_number: Optional[str] = None
    nhis_number: Optional[str] = None
    community: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None

    # Medical data
    medical_conditions: Optional[List[str]] = None
    allergies: Optional[List[str]] = None

    # Vitals
    blood_pressure: Optional[str] = None  # "120/80"
    pulse: Optional[str] = None  # "72 bpm"
    temperature: Optional[str] = None  # "36.8 C"
    weight: Optional[str] = None  # "68 kg"
    height: Optional[str] = None  # "165 cm"
    spo2: Optional[str] = None  # "98 %"

    # Medications
    current_medications: Optional[List[str]] = None


class PatientFromScanResponse(BaseModel):
    """Response for patient created from document scan."""
    success: bool
    patient_id: str
    identifier: str
    message: str
    created: dict  # Summary of what was created


def parse_vital_value(vital_str: str) -> tuple[Optional[Decimal], Optional[str]]:
    """Parse a vital string like '72 bpm' into (value, unit)."""
    if not vital_str:
        return None, None
    # Extract number and unit
    match = re.match(r'([\d.]+)\s*(.*)$', vital_str.strip())
    if match:
        try:
            value = Decimal(match.group(1))
            unit = match.group(2).strip() or None
            return value, unit
        except Exception:
            pass
    return None, None


@router.post("/from-scan", response_model=PatientFromScanResponse, status_code=status.HTTP_201_CREATED)
async def create_patient_from_scan(
    data: PatientFromScanRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "doctor", "nurse", "registrar"])),
):
    """Create a patient and related records from document scan data.

    Creates:
    - Patient record with demographics
    - Diagnosis records for medical conditions
    - Allergy records
    - Observation records for vitals
    - Medication records for current medications

    All records are created in a single transaction.
    """
    created_summary = {
        "patient": True,
        "diagnoses": 0,
        "allergies": 0,
        "observations": 0,
        "medications": 0,
    }

    try:
        # Generate unique identifier
        identifier = await generate_patient_identifier(db)

        # Parse gender
        gender = data.gender.lower()
        if gender in ['m', 'male']:
            gender = 'male'
        elif gender in ['f', 'female']:
            gender = 'female'
        else:
            gender = 'unknown'

        # Parse birthdate
        birthdate = None
        birthdate_estimated = False
        if data.birthdate:
            try:
                birthdate = datetime.strptime(data.birthdate, "%Y-%m-%d").date()
            except ValueError:
                # Try other formats
                for fmt in ["%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"]:
                    try:
                        birthdate = datetime.strptime(data.birthdate, fmt).date()
                        break
                    except ValueError:
                        continue

        # Create patient
        patient = Patient(
            identifier=identifier,
            first_name=data.first_name,
            middle_name=data.middle_name,
            last_name=data.last_name,
            gender=gender,
            birthdate=birthdate or date(1900, 1, 1),  # Default if missing
            birthdate_estimated=birthdate is None,
            phone_number=data.phone_number,
            community=data.community,
            city=data.city,
            state=data.region,
            emergency_contact_name=data.emergency_contact_name,
            emergency_contact_phone=data.emergency_contact_phone,
            ghana_card_number=data.ghana_card_number,
            nhis_number=data.nhis_number,
            created_by=current_user.id,
        )
        db.add(patient)
        await db.flush()  # Get patient.id without committing

        # Create diagnoses for medical conditions
        if data.medical_conditions:
            for i, condition in enumerate(data.medical_conditions):
                if condition and condition.strip():
                    diagnosis = Diagnosis(
                        patient_id=patient.id,
                        condition_text=condition.strip(),
                        certainty="confirmed",  # From document = confirmed
                        rank=i + 1,
                        diagnosed_by=current_user.id,
                        diagnosed_date=datetime.utcnow(),
                        notes="Extracted from document scan",
                    )
                    db.add(diagnosis)
                    created_summary["diagnoses"] += 1

        # Create allergy records
        if data.allergies:
            for allergy_name in data.allergies:
                if allergy_name and allergy_name.strip():
                    allergy = Allergy(
                        patient_id=patient.id,
                        allergen=allergy_name.strip(),
                        allergy_type="allergy",
                        category="medication",  # Default, could be refined
                        status="active",
                        criticality="unable-to-assess",  # We don't know from scan
                        recorded_by=current_user.id,
                        notes="Extracted from document scan",
                    )
                    db.add(allergy)
                    created_summary["allergies"] += 1

        # Create observation records for vitals
        vitals_mapping = {
            "blood_pressure": ("Blood Pressure", None),  # Special handling
            "pulse": ("Pulse Rate", "bpm"),
            "temperature": ("Temperature", "°C"),
            "weight": ("Weight", "kg"),
            "height": ("Height", "cm"),
            "spo2": ("SpO2", "%"),
        }

        for vital_key, (display_name, default_unit) in vitals_mapping.items():
            vital_value = getattr(data, vital_key)
            if vital_value:
                if vital_key == "blood_pressure":
                    # Special handling for BP: "120/80" -> two values
                    bp_match = re.match(r'(\d+)\s*/\s*(\d+)', vital_value)
                    if bp_match:
                        systolic, diastolic = bp_match.groups()
                        # Store as text with both values
                        obs = Observation(
                            patient_id=patient.id,
                            concept_type="vital_signs",
                            concept_display="Blood Pressure",
                            value_type="text",
                            value_text=f"{systolic}/{diastolic}",
                            unit="mmHg",
                            obs_datetime=datetime.utcnow(),
                            created_by=current_user.id,
                            extra_data={"systolic": int(systolic), "diastolic": int(diastolic), "source": "document_scan"},
                        )
                        db.add(obs)
                        created_summary["observations"] += 1
                else:
                    value, unit = parse_vital_value(vital_value)
                    if value is not None:
                        obs = Observation(
                            patient_id=patient.id,
                            concept_type="vital_signs",
                            concept_display=display_name,
                            value_type="numeric",
                            value_numeric=value,
                            unit=unit or default_unit,
                            obs_datetime=datetime.utcnow(),
                            created_by=current_user.id,
                            extra_data={"source": "document_scan"},
                        )
                        db.add(obs)
                        created_summary["observations"] += 1

        # Create medication records
        if data.current_medications:
            for med_str in data.current_medications:
                if med_str and med_str.strip():
                    # Try to parse dosage from string like "Metformin 500mg (twice daily)"
                    med_name = med_str.strip()
                    dosage = ""
                    frequency = ""

                    # Simple parsing - extract parenthetical as frequency
                    paren_match = re.search(r'\(([^)]+)\)', med_str)
                    if paren_match:
                        frequency = paren_match.group(1)
                        med_name = re.sub(r'\([^)]+\)', '', med_name).strip()

                    # Look for dosage pattern (number + unit)
                    dosage_match = re.search(r'(\d+\s*(?:mg|g|ml|mcg|iu))', med_name, re.IGNORECASE)
                    if dosage_match:
                        dosage = dosage_match.group(1)
                        med_name = re.sub(r'\d+\s*(?:mg|g|ml|mcg|iu)', '', med_name, flags=re.IGNORECASE).strip()

                    medication = Medication(
                        patient_id=patient.id,
                        drug_name=med_name or med_str.strip(),
                        dosage=dosage or "As directed",
                        frequency=frequency or "As directed",
                        status="active",
                        prescribed_by=current_user.id,
                        prescribed_date=datetime.utcnow(),
                        instructions="Extracted from document scan - verify with patient",
                    )
                    db.add(medication)
                    created_summary["medications"] += 1

        # Commit all changes
        await db.commit()
        await db.refresh(patient)

        return PatientFromScanResponse(
            success=True,
            patient_id=patient.id,
            identifier=patient.identifier,
            message=f"Patient created with {created_summary['diagnoses']} diagnoses, {created_summary['allergies']} allergies, {created_summary['observations']} vitals, {created_summary['medications']} medications",
            created=created_summary,
        )

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create patient: {str(e)}"
        )


@router.get("", response_model=PatientListResponse)
async def list_patients(
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    community: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List patients with optional community filter."""
    query = select(Patient).order_by(Patient.created_at.desc())

    if community:
        query = query.where(Patient.community == community)

    # Get total count
    count_query = select(func.count()).select_from(Patient)
    if community:
        count_query = count_query.where(Patient.community == community)
    total_result = await db.execute(count_query)
    total_count = total_result.scalar()

    # Get paginated results
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    patients = result.scalars().all()

    return PatientListResponse(
        results=[PatientResponse.model_validate(p) for p in patients],
        count=len(patients),
        total_count=total_count,
    )


@router.get("/search")
async def search_patients(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search patients by name, identifier, or phone."""
    search_term = f"%{q.lower()}%"

    query = select(Patient).where(
        or_(
            func.lower(Patient.first_name).like(search_term),
            func.lower(Patient.last_name).like(search_term),
            func.lower(Patient.identifier).like(search_term),
            Patient.phone_number.like(f"%{q}%"),
        )
    ).order_by(Patient.created_at.desc()).limit(50)

    result = await db.execute(query)
    patients = result.scalars().all()

    return [PatientResponse.model_validate(p) for p in patients]


@router.get("/communities")
async def get_communities(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get list of unique communities."""
    query = select(Patient.community).where(Patient.community.isnot(None)).distinct()
    result = await db.execute(query)
    communities = [row[0] for row in result.all() if row[0]]
    return sorted(communities)


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single patient by ID."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return patient


@router.get("/{patient_id}/complete")
async def get_complete_patient_data(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get complete patient data including all related records."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Get related data
    from app.models.visit import Visit
    from app.models.encounter import Encounter
    from app.models.observation import Observation
    from app.models.medication import Medication
    from app.models.diagnosis import Diagnosis
    from app.models.allergy import Allergy
    from app.models.lab_order import LabOrder
    from app.models.pharmacy_order import PharmacyOrder

    visits = await db.execute(
        select(Visit).where(Visit.patient_id == patient_id).order_by(Visit.start_datetime.desc())
    )
    encounters = await db.execute(
        select(Encounter).where(Encounter.patient_id == patient_id).order_by(Encounter.encounter_datetime.desc())
    )
    observations = await db.execute(
        select(Observation).where(Observation.patient_id == patient_id).order_by(Observation.obs_datetime.desc())
    )
    medications = await db.execute(
        select(Medication).where(Medication.patient_id == patient_id).order_by(Medication.prescribed_date.desc())
    )
    diagnoses = await db.execute(
        select(Diagnosis).where(Diagnosis.patient_id == patient_id).order_by(Diagnosis.diagnosed_date.desc())
    )
    allergies = await db.execute(
        select(Allergy).where(Allergy.patient_id == patient_id).order_by(Allergy.created_at.desc())
    )
    lab_orders = await db.execute(
        select(LabOrder).where(LabOrder.patient_id == patient_id).order_by(LabOrder.ordered_date.desc())
    )
    pharmacy_orders = await db.execute(
        select(PharmacyOrder).where(PharmacyOrder.patient_id == patient_id).order_by(PharmacyOrder.ordered_date.desc())
    )

    return {
        "patient": PatientResponse.model_validate(patient),
        "visits": [dict(id=v.id, visit_type=v.visit_type, start_datetime=v.start_datetime, status=v.status) for v in visits.scalars().all()],
        "encounters": [dict(id=e.id, encounter_type=e.encounter_type, encounter_datetime=e.encounter_datetime) for e in encounters.scalars().all()],
        "observations": [dict(id=o.id, concept_type=o.concept_type, concept_code=o.concept_code, concept_display=o.concept_display, value_numeric=o.value_numeric, value_text=o.value_text, unit=o.unit, obs_datetime=o.obs_datetime) for o in observations.scalars().all()],
        "medications": [dict(id=m.id, drug_name=m.drug_name, dosage=m.dosage, frequency=m.frequency, status=m.status, prescribed_date=m.prescribed_date) for m in medications.scalars().all()],
        "diagnoses": [dict(id=d.id, condition_text=d.condition_text, certainty=d.certainty, diagnosed_date=d.diagnosed_date) for d in diagnoses.scalars().all()],
        "allergies": [dict(id=a.id, allergen=a.allergen, allergy_type=a.allergy_type, category=a.category, status=a.status, criticality=a.criticality, reaction=a.reaction, severity=a.severity, recorded_date=a.created_at) for a in allergies.scalars().all()],
        "labOrders": [dict(id=l.id, test_type=l.test_type, status=l.status, result_value=l.result_value) for l in lab_orders.scalars().all()],
        "pharmacyOrders": [dict(id=p.id, drug_name=p.drug_name, status=p.status) for p in pharmacy_orders.scalars().all()],
    }


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient_data: PatientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "doctor", "nurse", "registrar"])),
):
    """Create a new patient."""
    # Generate unique identifier
    identifier = await generate_patient_identifier(db)

    patient = Patient(
        identifier=identifier,
        first_name=patient_data.first_name,
        middle_name=patient_data.middle_name,
        last_name=patient_data.last_name,
        gender=patient_data.gender,
        birthdate=patient_data.birthdate,
        birthdate_estimated=patient_data.birthdate_estimated,
        phone_number=patient_data.phone_number,
        email=patient_data.email,
        national_id=patient_data.national_id,
        community=patient_data.community,
        religion=patient_data.religion,
        occupation=patient_data.occupation,
        marital_status=patient_data.marital_status,
        education_level=patient_data.education_level,
        emergency_contact_name=patient_data.emergency_contact_name,
        emergency_contact_phone=patient_data.emergency_contact_phone,
        emergency_contact_relationship=patient_data.emergency_contact_relationship,
        ghana_card_number=patient_data.ghana_card_number,
        nhis_number=patient_data.nhis_number,
        created_by=current_user.id,
    )

    # Handle address
    if patient_data.address:
        patient.address_line1 = patient_data.address.address1
        patient.address_line2 = patient_data.address.address2
        patient.city = patient_data.address.cityVillage
        patient.state = patient_data.address.stateProvince
        patient.postal_code = patient_data.address.postalCode
        patient.country = patient_data.address.country

    db.add(patient)
    await db.commit()
    await db.refresh(patient)

    return patient


@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: str,
    patient_data: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "doctor", "nurse", "registrar"])),
):
    """Update a patient."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Update only provided fields
    update_data = patient_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(patient, field, value)

    await db.commit()
    await db.refresh(patient)

    return patient


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """Delete a patient (admin only)."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    await db.delete(patient)
    await db.commit()


@router.post("/seed/ncd-test-patient", status_code=status.HTTP_201_CREATED)
async def create_ncd_test_patient(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """Create an NCD test patient with data that triggers CDS alerts.

    This creates a patient with:
    - Diabetes type 2 + Hypertension + CKD diagnoses
    - Elevated BP (165/98 mmHg)
    - High glucose (185 mg/dL)
    - High HbA1c (8.2%)
    - Elevated LDL (145 mg/dL)
    - Low eGFR (52 mL/min)
    - 6 medications (polypharmacy)
    - Last visit 8 months ago (overdue follow-up)

    Admin access required.
    """
    from app.services.seed_ncd_patient import seed_ncd_test_patient

    patient_id = await seed_ncd_test_patient(db)

    return {
        "message": "NCD test patient created successfully",
        "patient_id": patient_id,
        "alerts_expected": [
            "WARNING: Elevated BP in hypertensive patient",
            "WARNING: Uncontrolled diabetes (HbA1c 8.2%)",
            "WARNING: Elevated LDL cholesterol",
            "WARNING: Declining kidney function",
            "INFO: Overdue HbA1c screening",
            "INFO: Polypharmacy (6 medications)",
            "INFO: Overdue follow-up",
        ],
    }
