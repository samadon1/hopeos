from pydantic import BaseModel
from datetime import datetime
from typing import Any


class EncounterBase(BaseModel):
    patient_id: str
    encounter_type: str  # Consultation, Vitals, LabResult
    location: str | None = None
    notes: str | None = None
    diagnosis: str | None = None
    structured_data: dict[str, Any] | None = None
    vitals_data: dict[str, Any] | None = None


class EncounterCreate(EncounterBase):
    visit_id: str | None = None


class EncounterUpdate(BaseModel):
    encounter_type: str | None = None
    location: str | None = None
    notes: str | None = None
    diagnosis: str | None = None
    structured_data: dict[str, Any] | None = None
    vitals_data: dict[str, Any] | None = None


class EncounterResponse(EncounterBase):
    id: str
    visit_id: str | None = None
    encounter_datetime: datetime
    provider_id: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
