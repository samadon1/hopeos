from pydantic import BaseModel
from datetime import datetime


class MedicationBase(BaseModel):
    patient_id: str
    drug_name: str
    dosage: str
    frequency: str
    drug_code: str | None = None
    dosage_unit: str = "mg"
    route: str = "Oral"
    duration: int | None = None
    duration_unit: str = "days"
    quantity: int | None = None
    instructions: str | None = None


class MedicationCreate(MedicationBase):
    encounter_id: str | None = None
    create_pharmacy_order: bool = True  # Auto-create pharmacy order


class MedicationResponse(MedicationBase):
    id: str
    encounter_id: str | None = None
    prescribed_by: str | None = None
    prescribed_date: datetime
    start_date: datetime | None = None
    end_date: datetime | None = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
