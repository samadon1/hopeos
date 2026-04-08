from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.catalog import MedicationCatalog, LabTestCatalog, DiagnosisConcept
from app.models.user import User
from app.schemas.catalog import CatalogItem
from app.auth.dependencies import get_current_user, require_roles

router = APIRouter()


@router.get("/medications")
async def get_medication_catalog(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get medication catalog."""
    result = await db.execute(
        select(MedicationCatalog)
        .where(MedicationCatalog.active == True)
        .order_by(MedicationCatalog.name)
    )
    medications = result.scalars().all()
    return [CatalogItem.model_validate(m) for m in medications]


@router.get("/lab-tests")
async def get_lab_test_catalog(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get lab test catalog."""
    result = await db.execute(
        select(LabTestCatalog)
        .where(LabTestCatalog.active == True)
        .order_by(LabTestCatalog.name)
    )
    tests = result.scalars().all()
    return [CatalogItem.model_validate(t) for t in tests]


@router.get("/diagnoses")
async def get_diagnosis_catalog(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get diagnosis concepts catalog."""
    result = await db.execute(
        select(DiagnosisConcept)
        .where(DiagnosisConcept.active == True)
        .order_by(DiagnosisConcept.name)
    )
    diagnoses = result.scalars().all()
    return [CatalogItem.model_validate(d) for d in diagnoses]


@router.post("/initialize")
async def initialize_catalogs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """Initialize all catalogs with default data."""
    stats = {"medications": 0, "lab_tests": 0, "diagnoses": 0}

    # Medications
    medications = [
        ("Paracetamol", "Analgesics"),
        ("Ibuprofen", "NSAIDs"),
        ("Amoxicillin", "Antibiotics"),
        ("Metformin", "Antidiabetics"),
        ("Amlodipine", "Antihypertensives"),
        ("Omeprazole", "Gastrointestinal"),
        ("Ciprofloxacin", "Antibiotics"),
        ("Metronidazole", "Antibiotics"),
        ("Diclofenac", "NSAIDs"),
        ("Lisinopril", "Antihypertensives"),
        ("Atorvastatin", "Statins"),
        ("Losartan", "Antihypertensives"),
        ("Salbutamol", "Bronchodilators"),
        ("Prednisolone", "Corticosteroids"),
        ("Artemether-Lumefantrine", "Antimalarials"),
        ("Oral Rehydration Salts", "Electrolytes"),
        ("Ferrous Sulphate", "Iron Supplements"),
        ("Folic Acid", "Vitamins"),
        ("Vitamin B Complex", "Vitamins"),
        ("Zinc Sulphate", "Minerals"),
    ]

    for name, category in medications:
        existing = await db.execute(
            select(MedicationCatalog).where(MedicationCatalog.name == name)
        )
        if not existing.scalar_one_or_none():
            db.add(MedicationCatalog(name=name, category=category))
            stats["medications"] += 1

    # Lab Tests
    lab_tests = [
        ("Full Blood Count", "Hematology"),
        ("Malaria Rapid Test", "Parasitology"),
        ("Blood Glucose", "Biochemistry"),
        ("Urinalysis", "Urinalysis"),
        ("Liver Function Tests", "Biochemistry"),
        ("Renal Function Tests", "Biochemistry"),
        ("Lipid Profile", "Biochemistry"),
        ("HIV Test", "Serology"),
        ("Hepatitis B Test", "Serology"),
        ("Widal Test", "Serology"),
        ("Stool Microscopy", "Parasitology"),
        ("Pregnancy Test", "Serology"),
    ]

    for name, category in lab_tests:
        existing = await db.execute(
            select(LabTestCatalog).where(LabTestCatalog.name == name)
        )
        if not existing.scalar_one_or_none():
            db.add(LabTestCatalog(name=name, category=category))
            stats["lab_tests"] += 1

    # Diagnoses
    diagnoses = [
        ("Malaria", "Infectious"),
        ("Upper Respiratory Tract Infection", "Respiratory"),
        ("Urinary Tract Infection", "Urological"),
        ("Gastritis", "Gastrointestinal"),
        ("Hypertension", "Cardiovascular"),
        ("Diabetes Mellitus Type 2", "Metabolic"),
        ("Pneumonia", "Respiratory"),
        ("Anemia", "Hematological"),
        ("Diarrhea", "Gastrointestinal"),
        ("Skin Infection", "Dermatological"),
        ("Typhoid Fever", "Infectious"),
        ("Peptic Ulcer Disease", "Gastrointestinal"),
        ("Asthma", "Respiratory"),
        ("Arthritis", "Musculoskeletal"),
        ("Conjunctivitis", "Ophthalmological"),
    ]

    for name, category in diagnoses:
        existing = await db.execute(
            select(DiagnosisConcept).where(DiagnosisConcept.name == name)
        )
        if not existing.scalar_one_or_none():
            db.add(DiagnosisConcept(name=name, category=category))
            stats["diagnoses"] += 1

    await db.commit()
    return {"message": "Catalogs initialized", "stats": stats}
