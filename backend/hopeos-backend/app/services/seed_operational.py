"""Seed operational data (visits, lab orders, pharmacy orders, encounters, observations)."""
import asyncio
import random
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.patient import Patient
from app.models.user import User
from app.models.visit import Visit
from app.models.encounter import Encounter
from app.models.observation import Observation
from app.models.lab_order import LabOrder
from app.models.pharmacy_order import PharmacyOrder
from app.models.medication import Medication


# Common lab tests with realistic values
LAB_TESTS = [
    {"test_type": "Complete Blood Count (CBC)", "test_code": "CBC001", "unit": "cells/μL", "normal_range": (4500, 11000)},
    {"test_type": "Blood Glucose (Fasting)", "test_code": "GLU001", "unit": "mg/dL", "normal_range": (70, 100)},
    {"test_type": "Blood Glucose (Random)", "test_code": "GLU002", "unit": "mg/dL", "normal_range": (70, 140)},
    {"test_type": "Hemoglobin", "test_code": "HGB001", "unit": "g/dL", "normal_range": (12.0, 17.5)},
    {"test_type": "Lipid Panel - Total Cholesterol", "test_code": "LIP001", "unit": "mg/dL", "normal_range": (125, 200)},
    {"test_type": "Lipid Panel - HDL", "test_code": "LIP002", "unit": "mg/dL", "normal_range": (40, 60)},
    {"test_type": "Lipid Panel - LDL", "test_code": "LIP003", "unit": "mg/dL", "normal_range": (0, 100)},
    {"test_type": "Creatinine", "test_code": "CRE001", "unit": "mg/dL", "normal_range": (0.7, 1.3)},
    {"test_type": "Blood Urea Nitrogen (BUN)", "test_code": "BUN001", "unit": "mg/dL", "normal_range": (7, 20)},
    {"test_type": "Liver Function - ALT", "test_code": "LFT001", "unit": "U/L", "normal_range": (7, 56)},
    {"test_type": "Liver Function - AST", "test_code": "LFT002", "unit": "U/L", "normal_range": (10, 40)},
    {"test_type": "Thyroid (TSH)", "test_code": "THY001", "unit": "mIU/L", "normal_range": (0.4, 4.0)},
    {"test_type": "Urinalysis", "test_code": "URI001", "unit": "", "normal_range": None},
    {"test_type": "Malaria RDT", "test_code": "MAL001", "unit": "", "normal_range": None},
    {"test_type": "HIV Rapid Test", "test_code": "HIV001", "unit": "", "normal_range": None},
    {"test_type": "HbA1c", "test_code": "HBA001", "unit": "%", "normal_range": (4.0, 5.6)},
]

# Vital signs with realistic ranges
VITAL_SIGNS = [
    {"concept_display": "Blood Pressure - Systolic", "concept_code": "8480-6", "unit": "mmHg", "range": (90, 180)},
    {"concept_display": "Blood Pressure - Diastolic", "concept_code": "8462-4", "unit": "mmHg", "range": (60, 110)},
    {"concept_display": "Heart Rate", "concept_code": "8867-4", "unit": "bpm", "range": (50, 120)},
    {"concept_display": "Temperature", "concept_code": "8310-5", "unit": "°C", "range": (36.0, 39.5)},
    {"concept_display": "Respiratory Rate", "concept_code": "9279-1", "unit": "/min", "range": (12, 25)},
    {"concept_display": "Oxygen Saturation", "concept_code": "59408-5", "unit": "%", "range": (92, 100)},
    {"concept_display": "Weight", "concept_code": "29463-7", "unit": "kg", "range": (40, 120)},
    {"concept_display": "Height", "concept_code": "8302-2", "unit": "cm", "range": (140, 200)},
]

VISIT_TYPES = ["Outpatient", "Follow-up", "Emergency", "Referral", "Routine Check-up"]
LOCATIONS = ["OKB Clinic", "Main Hospital", "Outpatient Department", "Emergency Room", "Consultation Room 1", "Consultation Room 2"]
PRIORITIES = ["routine", "urgent", "stat"]


def random_date_in_past_months(months: int = 6) -> datetime:
    """Generate a random datetime within the past N months."""
    days_back = random.randint(1, months * 30)
    hours_offset = random.randint(8, 17)  # Working hours
    minutes_offset = random.randint(0, 59)
    return datetime.utcnow() - timedelta(days=days_back, hours=random.randint(0, 23) - hours_offset, minutes=minutes_offset)


def generate_lab_result(test: dict) -> tuple[str, str]:
    """Generate a realistic lab result value and interpretation."""
    if test["normal_range"] is None:
        # Qualitative tests
        if "Malaria" in test["test_type"]:
            result = random.choice(["Negative", "Positive (P. falciparum)", "Positive (P. vivax)"])
            interpretation = "normal" if "Negative" in result else "abnormal"
        elif "HIV" in test["test_type"]:
            result = random.choices(["Non-reactive", "Reactive"], weights=[95, 5])[0]
            interpretation = "normal" if "Non-reactive" in result else "abnormal"
        elif "Urinalysis" in test["test_type"]:
            result = random.choice(["Normal", "Trace protein", "Glucose positive", "Blood +1"])
            interpretation = "normal" if "Normal" in result else "abnormal"
        else:
            result = "Normal"
            interpretation = "normal"
        return result, interpretation

    # Numeric tests
    low, high = test["normal_range"]

    # 70% normal, 20% slightly abnormal, 10% critical
    roll = random.random()
    if roll < 0.70:
        # Normal range
        value = round(random.uniform(low, high), 1)
        interpretation = "normal"
    elif roll < 0.90:
        # Slightly abnormal
        if random.random() < 0.5:
            value = round(random.uniform(low * 0.8, low), 1)  # Low
        else:
            value = round(random.uniform(high, high * 1.2), 1)  # High
        interpretation = "abnormal"
    else:
        # Critical
        if random.random() < 0.5:
            value = round(random.uniform(low * 0.5, low * 0.8), 1)  # Very low
        else:
            value = round(random.uniform(high * 1.2, high * 1.5), 1)  # Very high
        interpretation = "critical"

    return str(value), interpretation


async def seed_visits(db: AsyncSession, patients: list[Patient], users: list[User], count_per_patient: int = 3) -> list[Visit]:
    """Create visits for patients."""
    print(f"Creating visits for {len(patients)} patients...")
    visits = []

    # Filter users who can create visits (doctors, nurses, admin)
    staff = [u for u in users if u.role in ("doctor", "nurse", "admin")]

    for patient in patients:
        num_visits = random.randint(1, count_per_patient)
        for _ in range(num_visits):
            start_dt = random_date_in_past_months(6)
            # 80% of visits are finished
            status = random.choices(["finished", "in-progress"], weights=[80, 20])[0]
            stop_dt = start_dt + timedelta(hours=random.randint(1, 4)) if status == "finished" else None

            visit = Visit(
                id=str(uuid4()),
                patient_id=patient.id,
                visit_type=random.choice(VISIT_TYPES),
                location=random.choice(LOCATIONS),
                start_datetime=start_dt,
                stop_datetime=stop_dt,
                status=status,
                created_by=random.choice(staff).id if staff else None,
            )
            db.add(visit)
            visits.append(visit)

    await db.commit()
    print(f"Created {len(visits)} visits")
    return visits


async def seed_encounters(db: AsyncSession, visits: list[Visit], users: list[User]) -> list[Encounter]:
    """Create encounters for visits."""
    print(f"Creating encounters for {len(visits)} visits...")
    encounters = []

    doctors = [u for u in users if u.role == "doctor"]
    nurses = [u for u in users if u.role == "nurse"]

    for visit in visits:
        # Each visit has 1-3 encounters
        num_encounters = random.randint(1, 3)
        encounter_types = random.sample(["Consultation", "Vitals", "LabResult"], min(num_encounters, 3))

        for enc_type in encounter_types:
            provider = random.choice(doctors) if enc_type == "Consultation" else random.choice(nurses) if nurses else None

            encounter = Encounter(
                id=str(uuid4()),
                patient_id=visit.patient_id,
                visit_id=visit.id,
                encounter_type=enc_type,
                encounter_datetime=visit.start_datetime + timedelta(minutes=random.randint(5, 60)),
                location=visit.location,
                provider_id=provider.id if provider else None,
                notes=f"{enc_type} notes for visit" if random.random() > 0.5 else None,
            )
            db.add(encounter)
            encounters.append(encounter)

    await db.commit()
    print(f"Created {len(encounters)} encounters")
    return encounters


async def seed_observations(db: AsyncSession, encounters: list[Encounter], users: list[User]) -> int:
    """Create vital sign observations for encounters."""
    print("Creating vital sign observations...")
    count = 0

    nurses = [u for u in users if u.role in ("nurse", "doctor")]

    # Only create vitals for Vitals and Consultation encounters
    vitals_encounters = [e for e in encounters if e.encounter_type in ("Vitals", "Consultation")]

    for encounter in vitals_encounters:
        # Record 3-6 vital signs per encounter
        num_vitals = random.randint(3, 6)
        selected_vitals = random.sample(VITAL_SIGNS, min(num_vitals, len(VITAL_SIGNS)))

        for vital in selected_vitals:
            low, high = vital["range"]
            value = round(random.uniform(low, high), 1)

            obs = Observation(
                id=str(uuid4()),
                patient_id=encounter.patient_id,
                encounter_id=encounter.id,
                visit_id=encounter.visit_id,
                concept_type="vital_signs",
                concept_code=vital["concept_code"],
                concept_display=vital["concept_display"],
                value_type="numeric",
                value_numeric=Decimal(str(value)),
                unit=vital["unit"],
                obs_datetime=encounter.encounter_datetime,
                created_by=random.choice(nurses).id if nurses else None,
            )
            db.add(obs)
            count += 1

    await db.commit()
    print(f"Created {count} observations")
    return count


async def seed_lab_orders(db: AsyncSession, patients: list[Patient], users: list[User], count: int = 500) -> int:
    """Create lab orders."""
    print(f"Creating {count} lab orders...")

    doctors = [u for u in users if u.role == "doctor"]
    lab_techs = [u for u in users if u.role == "lab"]

    created = 0
    for _ in range(count):
        patient = random.choice(patients)
        test = random.choice(LAB_TESTS)
        ordered_date = random_date_in_past_months(6)

        # Status distribution: 60% completed, 20% pending, 15% in-progress, 5% cancelled
        status = random.choices(
            ["completed", "pending", "in-progress", "cancelled"],
            weights=[60, 20, 15, 5]
        )[0]

        result_value = None
        result_unit = None
        result_interpretation = None
        completed_at = None
        completed_by = None
        specimen_collected = status != "pending"
        results_available = status == "completed"

        if status == "completed":
            result_value, result_interpretation = generate_lab_result(test)
            result_unit = test["unit"] if test["unit"] else None
            completed_at = ordered_date + timedelta(hours=random.randint(2, 48))
            completed_by = random.choice(lab_techs).id if lab_techs else None

        lab_order = LabOrder(
            id=str(uuid4()),
            patient_id=patient.id,
            test_type=test["test_type"],
            test_code=test["test_code"],
            ordered_by=random.choice(doctors).id if doctors else None,
            ordered_date=ordered_date,
            priority=random.choices(PRIORITIES, weights=[70, 20, 10])[0],
            status=status,
            specimen_collected=specimen_collected,
            results_available=results_available,
            result_value=result_value,
            result_unit=result_unit,
            result_interpretation=result_interpretation,
            completed_at=completed_at,
            completed_by=completed_by,
        )
        db.add(lab_order)
        created += 1

    await db.commit()
    print(f"Created {created} lab orders")
    return created


async def seed_pharmacy_orders(db: AsyncSession, patients: list[Patient], medications: list[Medication], users: list[User], count: int = 400) -> int:
    """Create pharmacy orders from existing medications."""
    print(f"Creating {count} pharmacy orders...")

    doctors = [u for u in users if u.role == "doctor"]
    pharmacists = [u for u in users if u.role == "pharmacy"]

    created = 0
    for _ in range(count):
        patient = random.choice(patients)
        # Try to find a medication for this patient, or use any medication
        patient_meds = [m for m in medications if m.patient_id == patient.id]
        med = random.choice(patient_meds) if patient_meds else random.choice(medications) if medications else None

        if not med:
            continue

        ordered_date = random_date_in_past_months(6)

        # Status: 70% dispensed, 20% pending, 10% cancelled
        status = random.choices(
            ["dispensed", "pending", "cancelled"],
            weights=[70, 20, 10]
        )[0]

        dispensed_at = None
        dispensed_by = None

        if status == "dispensed":
            dispensed_at = ordered_date + timedelta(hours=random.randint(1, 8))
            dispensed_by = random.choice(pharmacists).id if pharmacists else None

        pharmacy_order = PharmacyOrder(
            id=str(uuid4()),
            patient_id=patient.id,
            medication_id=med.id,
            drug_name=med.drug_name,
            dosage=med.dosage,
            quantity=random.randint(10, 90),
            prescribed_by=random.choice(doctors).id if doctors else None,
            ordered_date=ordered_date,
            status=status,
            dispensed_at=dispensed_at,
            dispensed_by=dispensed_by,
        )
        db.add(pharmacy_order)
        created += 1

    await db.commit()
    print(f"Created {created} pharmacy orders")
    return created


async def run_operational_seed():
    """Run all operational data seeders."""
    print("=" * 60)
    print("Seeding Operational Data")
    print("=" * 60)

    async with async_session() as db:
        # Get existing data
        patients_result = await db.execute(select(Patient).limit(200))
        patients = list(patients_result.scalars().all())
        print(f"Found {len(patients)} patients")

        users_result = await db.execute(select(User))
        users = list(users_result.scalars().all())
        print(f"Found {len(users)} users")

        medications_result = await db.execute(select(Medication).limit(1000))
        medications = list(medications_result.scalars().all())
        print(f"Found {len(medications)} medications")

        if not patients:
            print("ERROR: No patients found. Run Synthea loader first.")
            return

        if not users:
            print("ERROR: No users found. Run seed.py first.")
            return

        # Check if we already have operational data
        visits_count = await db.execute(select(func.count(Visit.id)))
        existing_visits = visits_count.scalar()

        if existing_visits > 0:
            print(f"\nWARNING: Found {existing_visits} existing visits.")
            print("Skipping visit/encounter/observation seeding to avoid duplicates.")
        else:
            # Seed visits, encounters, observations
            visits = await seed_visits(db, patients, users, count_per_patient=3)
            encounters = await seed_encounters(db, visits, users)
            await seed_observations(db, encounters, users)

        # Check existing lab orders
        lab_count = await db.execute(select(func.count(LabOrder.id)))
        existing_labs = lab_count.scalar()

        if existing_labs > 0:
            print(f"\nWARNING: Found {existing_labs} existing lab orders.")
            print("Skipping lab order seeding.")
        else:
            await seed_lab_orders(db, patients, users, count=500)

        # Check existing pharmacy orders
        pharm_count = await db.execute(select(func.count(PharmacyOrder.id)))
        existing_pharm = pharm_count.scalar()

        if existing_pharm > 0:
            print(f"\nWARNING: Found {existing_pharm} existing pharmacy orders.")
            print("Skipping pharmacy order seeding.")
        else:
            await seed_pharmacy_orders(db, patients, medications, users, count=400)

    print("\n" + "=" * 60)
    print("Operational Data Seeding Complete!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_operational_seed())
