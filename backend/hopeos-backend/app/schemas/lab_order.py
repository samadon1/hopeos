from pydantic import BaseModel
from datetime import datetime


class LabOrderBase(BaseModel):
    patient_id: str
    test_type: str
    test_code: str | None = None
    priority: str = "routine"  # routine, urgent, stat
    notes: str | None = None


class LabOrderCreate(LabOrderBase):
    pass


class LabOrderUpdate(BaseModel):
    status: str | None = None  # pending, in-progress, completed, cancelled
    specimen_collected: bool | None = None
    results_available: bool | None = None
    result_value: str | None = None
    result_unit: str | None = None
    result_interpretation: str | None = None  # normal, abnormal, critical
    notes: str | None = None


class LabOrderResponse(LabOrderBase):
    id: str
    ordered_by: str | None = None
    ordered_date: datetime
    status: str
    specimen_collected: bool
    results_available: bool
    result_value: str | None = None
    result_unit: str | None = None
    result_interpretation: str | None = None
    completed_at: datetime | None = None
    completed_by: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
