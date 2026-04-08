from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal
from typing import Any


class ObservationBase(BaseModel):
    patient_id: str
    concept_type: str  # vital_signs, lab_result
    concept_display: str
    concept_code: str | None = None
    value_type: str  # numeric, text, coded
    value_numeric: Decimal | None = None
    value_text: str | None = None
    value_coded: str | None = None
    unit: str | None = None


class ObservationCreate(ObservationBase):
    encounter_id: str | None = None
    visit_id: str | None = None
    extra_data: dict[str, Any] | None = None


class ObservationResponse(ObservationBase):
    id: str
    encounter_id: str | None = None
    visit_id: str | None = None
    obs_datetime: datetime
    extra_data: dict[str, Any] | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
