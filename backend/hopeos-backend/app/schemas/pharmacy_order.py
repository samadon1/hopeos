from pydantic import BaseModel
from datetime import datetime


class PharmacyOrderBase(BaseModel):
    patient_id: str
    drug_name: str
    dosage: str | None = None
    quantity: int | None = None
    notes: str | None = None


class PharmacyOrderCreate(PharmacyOrderBase):
    medication_id: str | None = None


class PharmacyOrderUpdate(BaseModel):
    status: str | None = None  # pending, dispensed, cancelled
    notes: str | None = None


class PharmacyOrderResponse(PharmacyOrderBase):
    id: str
    medication_id: str | None = None
    prescribed_by: str | None = None
    ordered_date: datetime
    status: str
    dispensed_at: datetime | None = None
    dispensed_by: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
