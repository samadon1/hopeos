from pydantic import BaseModel
from datetime import datetime


class VisitBase(BaseModel):
    patient_id: str
    visit_type: str = "Outpatient"
    location: str = "OKB Clinic"


class VisitCreate(VisitBase):
    pass


class VisitUpdate(BaseModel):
    visit_type: str | None = None
    location: str | None = None
    stop_datetime: datetime | None = None
    status: str | None = None  # planned, in-progress, finished


class VisitResponse(VisitBase):
    id: str
    start_datetime: datetime
    stop_datetime: datetime | None = None
    status: str
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
