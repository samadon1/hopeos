from pydantic import BaseModel
from datetime import datetime


class DiagnosisBase(BaseModel):
    patient_id: str
    condition_text: str
    condition_code: str | None = None
    certainty: str = "confirmed"  # presumed, confirmed
    rank: int = 1  # 1 = primary
    notes: str | None = None


class DiagnosisCreate(DiagnosisBase):
    encounter_id: str | None = None


class DiagnosisResponse(DiagnosisBase):
    id: str
    encounter_id: str | None = None
    diagnosed_by: str | None = None
    diagnosed_date: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
