"""Seed database with NCD test patient for CDS alerts testing."""
import asyncio
from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import async_session
from app.models.patient import Patient
from app.models.diagnosis import Diagnosis
from app.models.observation import Observation
from app.models.medication import Medication
from app.models.lab_order import LabOrder
from app.models.encounter import Encounter
from app.utils.identifier import generate_patient_identifier


async def seed_ncd_test_patient(db: AsyncSession):
    """Create a comprehensive NCD test patient with alerts-triggering data.

    This patient will have:
    - Diabetes type 2 + Hypertension diagnoses
    - Elevated BP (165/98)
    - High glucose (185 mg/dL)
    - High HbA1c (8.2%)
    - Elevated LDL (145 mg/dL)
    - Borderline eGFR (52 mL/min)
    - Multiple medications (polypharmacy)
    - Known allergy
    - Old last visit (8 months ago)
    """

    # Check if test patient already exists
    result = await db.execute(
        select(Patient).where(Patient.first_name == "Kofi", Patient.last_name == "Mensah")
    )
    existing = result.scalar_one_or_none()
    if existing:
        print(f"NCD Test Patient already exists with ID: {existing.id}")
        return existing.id

    # Generate unique identifier
    identifier = await generate_patient_identifier(db)

    # Create the patient - Realistic Ghanaian name
    patient = Patient(
        identifier=identifier,
        first_name="Kofi",
        middle_name="Agyemang",
        last_name="Mensah",
        gender="male",
        birthdate=date(1958, 5, 15),  # 66 years old
        phone_number="+233244123456",
        email="kofi.mensah@example.com",
        address_line1="15 Adum Road",
        city="Kumasi",
        state="Ashanti",
        country="Ghana",
        community="Suame",
    )
    db.add(patient)
    await db.flush()  # Get the patient ID

    patient_id = patient.id
    print(f"Created NCD Test Patient: {patient_id}")

    # Create diagnoses (NCD conditions)
    diagnoses = [
        Diagnosis(
            patient_id=patient_id,
            condition_text="Diabetes mellitus type 2 (disorder)",
            condition_code="E11",
            certainty="confirmed",
            rank=1,
            diagnosed_date=datetime.now() - timedelta(days=730),  # 2 years ago
        ),
        Diagnosis(
            patient_id=patient_id,
            condition_text="Essential hypertension (disorder)",
            condition_code="I10",
            certainty="confirmed",
            rank=2,
            diagnosed_date=datetime.now() - timedelta(days=900),  # 2.5 years ago
        ),
        Diagnosis(
            patient_id=patient_id,
            condition_text="Chronic kidney disease stage 3",
            condition_code="N18.3",
            certainty="confirmed",
            rank=3,
            diagnosed_date=datetime.now() - timedelta(days=180),  # 6 months ago
        ),
        Diagnosis(
            patient_id=patient_id,
            condition_text="Hyperlipidemia",
            condition_code="E78.5",
            certainty="confirmed",
            rank=4,
            diagnosed_date=datetime.now() - timedelta(days=365),  # 1 year ago
        ),
    ]
    for dx in diagnoses:
        db.add(dx)
    print(f"Added {len(diagnoses)} diagnoses")

    # Create vitals (observations) - with concerning values
    vitals = [
        # Blood Pressure - Elevated (Stage 2 HTN)
        Observation(
            patient_id=patient_id,
            concept_type="vital_signs",
            concept_code="8480-6",
            concept_display="Systolic Blood Pressure",
            value_type="numeric",
            value_numeric=Decimal("165"),
            unit="mmHg",
            obs_datetime=datetime.now() - timedelta(hours=2),
        ),
        Observation(
            patient_id=patient_id,
            concept_type="vital_signs",
            concept_code="8462-4",
            concept_display="Diastolic Blood Pressure",
            value_type="numeric",
            value_numeric=Decimal("98"),
            unit="mmHg",
            obs_datetime=datetime.now() - timedelta(hours=2),
        ),
        # Blood Glucose - Elevated
        Observation(
            patient_id=patient_id,
            concept_type="vital_signs",
            concept_code="2339-0",
            concept_display="Glucose",
            value_type="numeric",
            value_numeric=Decimal("185"),
            unit="mg/dL",
            obs_datetime=datetime.now() - timedelta(hours=2),
        ),
        # Heart Rate
        Observation(
            patient_id=patient_id,
            concept_type="vital_signs",
            concept_code="8867-4",
            concept_display="Heart Rate",
            value_type="numeric",
            value_numeric=Decimal("88"),
            unit="bpm",
            obs_datetime=datetime.now() - timedelta(hours=2),
        ),
        # Temperature
        Observation(
            patient_id=patient_id,
            concept_type="vital_signs",
            concept_code="8310-5",
            concept_display="Body Temperature",
            value_type="numeric",
            value_numeric=Decimal("37.1"),
            unit="C",
            obs_datetime=datetime.now() - timedelta(hours=2),
        ),
        # Weight
        Observation(
            patient_id=patient_id,
            concept_type="vital_signs",
            concept_code="29463-7",
            concept_display="Body Weight",
            value_type="numeric",
            value_numeric=Decimal("92"),
            unit="kg",
            obs_datetime=datetime.now() - timedelta(hours=2),
        ),
    ]
    for vital in vitals:
        db.add(vital)
    print(f"Added {len(vitals)} vital signs")

    # Create lab orders with results - concerning values
    labs = [
        # HbA1c - Uncontrolled (>7%)
        LabOrder(
            patient_id=patient_id,
            test_type="HbA1c",
            test_code="4548-4",
            status="completed",
            result_value="8.2",
            result_unit="%",
            result_interpretation="abnormal",
            ordered_date=datetime.now() - timedelta(days=120),  # 4 months ago (overdue)
            completed_at=datetime.now() - timedelta(days=118),
            results_available=True,
        ),
        # eGFR - Stage 3 CKD
        LabOrder(
            patient_id=patient_id,
            test_type="eGFR",
            test_code="33914-3",
            status="completed",
            result_value="52",
            result_unit="mL/min/1.73m2",
            result_interpretation="abnormal",
            ordered_date=datetime.now() - timedelta(days=30),
            completed_at=datetime.now() - timedelta(days=28),
            results_available=True,
        ),
        # LDL Cholesterol - Elevated
        LabOrder(
            patient_id=patient_id,
            test_type="LDL Cholesterol",
            test_code="13457-7",
            status="completed",
            result_value="145",
            result_unit="mg/dL",
            result_interpretation="abnormal",
            ordered_date=datetime.now() - timedelta(days=60),
            completed_at=datetime.now() - timedelta(days=58),
            results_available=True,
        ),
        # Potassium - slightly elevated (watch for hyperkalemia)
        LabOrder(
            patient_id=patient_id,
            test_type="Potassium",
            test_code="2823-3",
            status="completed",
            result_value="5.3",
            result_unit="mEq/L",
            result_interpretation="abnormal",
            ordered_date=datetime.now() - timedelta(days=30),
            completed_at=datetime.now() - timedelta(days=28),
            results_available=True,
        ),
        # Creatinine
        LabOrder(
            patient_id=patient_id,
            test_type="Creatinine",
            test_code="2160-0",
            status="completed",
            result_value="1.8",
            result_unit="mg/dL",
            result_interpretation="abnormal",
            ordered_date=datetime.now() - timedelta(days=30),
            completed_at=datetime.now() - timedelta(days=28),
            results_available=True,
        ),
    ]
    for lab in labs:
        db.add(lab)
    print(f"Added {len(labs)} lab orders")

    # Create medications (6+ for polypharmacy alert)
    medications = [
        Medication(
            patient_id=patient_id,
            drug_name="Metformin",
            drug_code="6809",
            dosage="1000mg",
            frequency="Twice daily",
            route="Oral",
            status="active",
            prescribed_date=datetime.now() - timedelta(days=365),
        ),
        Medication(
            patient_id=patient_id,
            drug_name="Lisinopril",
            drug_code="29046",
            dosage="20mg",
            frequency="Once daily",
            route="Oral",
            status="active",
            prescribed_date=datetime.now() - timedelta(days=365),
        ),
        Medication(
            patient_id=patient_id,
            drug_name="Amlodipine",
            drug_code="17767",
            dosage="10mg",
            frequency="Once daily",
            route="Oral",
            status="active",
            prescribed_date=datetime.now() - timedelta(days=180),
        ),
        Medication(
            patient_id=patient_id,
            drug_name="Atorvastatin",
            drug_code="83367",
            dosage="40mg",
            frequency="Once daily at bedtime",
            route="Oral",
            status="active",
            prescribed_date=datetime.now() - timedelta(days=365),
        ),
        Medication(
            patient_id=patient_id,
            drug_name="Aspirin",
            drug_code="1191",
            dosage="81mg",
            frequency="Once daily",
            route="Oral",
            status="active",
            prescribed_date=datetime.now() - timedelta(days=365),
        ),
        Medication(
            patient_id=patient_id,
            drug_name="Glimepiride",
            drug_code="25789",
            dosage="4mg",
            frequency="Once daily with breakfast",
            route="Oral",
            status="active",
            prescribed_date=datetime.now() - timedelta(days=90),
        ),
    ]
    for med in medications:
        db.add(med)
    print(f"Added {len(medications)} medications")

    # Create an old encounter (8 months ago for overdue follow-up)
    encounter = Encounter(
        patient_id=patient_id,
        encounter_type="Follow-up Visit",
        encounter_datetime=datetime.now() - timedelta(days=240),  # 8 months ago
        location="NCD Clinic",
    )
    db.add(encounter)
    print("Added 1 encounter (8 months ago)")

    await db.commit()

    print("\n" + "=" * 60)
    print("NCD Test Patient created successfully!")
    print("=" * 60)
    print(f"Patient ID: {patient_id}")
    print(f"Name: Kofi Agyemang Mensah")
    print(f"Identifier: {identifier}")
    print("\nThis patient should trigger the following CDS alerts:")
    print("  - WARNING: Elevated BP in hypertensive patient (165/98)")
    print("  - WARNING: Uncontrolled diabetes (HbA1c 8.2%)")
    print("  - WARNING: Elevated LDL (145 mg/dL)")
    print("  - WARNING: Declining kidney function (eGFR 52)")
    print("  - INFO: Overdue HbA1c (>3 months)")
    print("  - INFO: Polypharmacy (6 medications)")
    print("  - INFO: Overdue follow-up (8 months)")
    print("=" * 60)

    return patient_id


async def run_seed():
    """Run the NCD patient seed."""
    async with async_session() as db:
        patient_id = await seed_ncd_test_patient(db)
        return patient_id


if __name__ == "__main__":
    asyncio.run(run_seed())
