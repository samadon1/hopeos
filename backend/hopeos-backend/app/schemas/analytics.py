from pydantic import BaseModel
from typing import Optional


class DiseaseStats(BaseModel):
    condition: str
    count: int


class CommunityStats(BaseModel):
    community: str
    patient_count: int


class TimeSeriesPoint(BaseModel):
    date: str
    count: int


class DepartmentStats(BaseModel):
    department: str
    count: int


class StaffStats(BaseModel):
    total: int
    active: int
    by_role: dict[str, int]


class TrendComparison(BaseModel):
    """Compare current period vs previous period."""
    current: int
    previous: int
    change_percent: float  # positive = increase, negative = decrease


class AnalyticsResponse(BaseModel):
    total_patients: int
    total_visits: int
    total_encounters: int
    active_patients: int
    patients_today: int
    visits_today: int
    top_diagnoses: list[DiseaseStats]
    community_distribution: list[CommunityStats]
    visits_over_time: list[TimeSeriesPoint]
    gender_distribution: dict[str, int]
    age_distribution: dict[str, int]
    # New fields for real data
    department_stats: Optional[list[DepartmentStats]] = None
    staff_stats: Optional[StaffStats] = None
    patient_trend: Optional[TrendComparison] = None
    visit_trend: Optional[TrendComparison] = None
    encounter_trend: Optional[TrendComparison] = None
    lab_order_stats: Optional[dict[str, int]] = None
    pharmacy_order_stats: Optional[dict[str, int]] = None
