from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta

from app.database import get_db
from app.models.patient import Patient
from app.models.visit import Visit
from app.models.encounter import Encounter
from app.models.diagnosis import Diagnosis
from app.models.user import User
from app.models.lab_order import LabOrder
from app.models.pharmacy_order import PharmacyOrder
from app.schemas.analytics import (
    AnalyticsResponse,
    DepartmentStats,
    StaffStats,
    TrendComparison,
)
from app.auth.dependencies import get_current_user

router = APIRouter()


def calculate_trend(current: int, previous: int) -> TrendComparison:
    """Calculate percentage change between two periods."""
    if previous == 0:
        change_percent = 100.0 if current > 0 else 0.0
    else:
        change_percent = ((current - previous) / previous) * 100
    return TrendComparison(
        current=current,
        previous=previous,
        change_percent=round(change_percent, 2)
    )


@router.get("", response_model=AnalyticsResponse)
async def get_analytics(
    time_range: str = "week",  # day, week, month, year
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get dashboard analytics."""
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, datetime.min.time())

    # Calculate time range for current and previous periods
    if time_range == "day":
        range_start = today_start
        prev_range_start = today_start - timedelta(days=1)
        prev_range_end = today_start
    elif time_range == "week":
        range_start = today_start - timedelta(days=7)
        prev_range_start = today_start - timedelta(days=14)
        prev_range_end = range_start
    elif time_range == "month":
        range_start = today_start - timedelta(days=30)
        prev_range_start = today_start - timedelta(days=60)
        prev_range_end = range_start
    else:  # year
        range_start = today_start - timedelta(days=365)
        prev_range_start = today_start - timedelta(days=730)
        prev_range_end = range_start

    # =========================================================================
    # TOTAL COUNTS
    # =========================================================================
    total_patients_result = await db.execute(select(func.count()).select_from(Patient))
    total_patients = total_patients_result.scalar() or 0

    total_visits_result = await db.execute(select(func.count()).select_from(Visit))
    total_visits = total_visits_result.scalar() or 0

    total_encounters_result = await db.execute(select(func.count()).select_from(Encounter))
    total_encounters = total_encounters_result.scalar() or 0

    active_patients_result = await db.execute(
        select(func.count()).select_from(Patient).where(Patient.active == True)
    )
    active_patients = active_patients_result.scalar() or 0

    # =========================================================================
    # TREND COMPARISONS (current period vs previous period)
    # =========================================================================

    # Patients created in current period
    current_patients_result = await db.execute(
        select(func.count()).select_from(Patient).where(Patient.created_at >= range_start)
    )
    current_patients = current_patients_result.scalar() or 0

    # Patients created in previous period
    prev_patients_result = await db.execute(
        select(func.count()).select_from(Patient)
        .where(and_(Patient.created_at >= prev_range_start, Patient.created_at < prev_range_end))
    )
    prev_patients = prev_patients_result.scalar() or 0
    patient_trend = calculate_trend(current_patients, prev_patients)

    # Visits in current period
    current_visits_result = await db.execute(
        select(func.count()).select_from(Visit).where(Visit.start_datetime >= range_start)
    )
    current_visits = current_visits_result.scalar() or 0

    # Visits in previous period
    prev_visits_result = await db.execute(
        select(func.count()).select_from(Visit)
        .where(and_(Visit.start_datetime >= prev_range_start, Visit.start_datetime < prev_range_end))
    )
    prev_visits = prev_visits_result.scalar() or 0
    visit_trend = calculate_trend(current_visits, prev_visits)

    # Encounters in current period
    current_encounters_result = await db.execute(
        select(func.count()).select_from(Encounter).where(Encounter.encounter_datetime >= range_start)
    )
    current_encounters = current_encounters_result.scalar() or 0

    # Encounters in previous period
    prev_encounters_result = await db.execute(
        select(func.count()).select_from(Encounter)
        .where(and_(Encounter.encounter_datetime >= prev_range_start, Encounter.encounter_datetime < prev_range_end))
    )
    prev_encounters = prev_encounters_result.scalar() or 0
    encounter_trend = calculate_trend(current_encounters, prev_encounters)

    # =========================================================================
    # TODAY'S COUNTS
    # =========================================================================
    patients_today_result = await db.execute(
        select(func.count()).select_from(Patient).where(Patient.created_at >= today_start)
    )
    patients_today = patients_today_result.scalar() or 0

    visits_today_result = await db.execute(
        select(func.count()).select_from(Visit).where(Visit.start_datetime >= today_start)
    )
    visits_today = visits_today_result.scalar() or 0

    # =========================================================================
    # TOP DIAGNOSES
    # =========================================================================
    top_diagnoses_result = await db.execute(
        select(Diagnosis.condition_text, func.count(Diagnosis.id).label("count"))
        .where(Diagnosis.diagnosed_date >= range_start)
        .group_by(Diagnosis.condition_text)
        .order_by(func.count(Diagnosis.id).desc())
        .limit(10)
    )
    top_diagnoses = [{"condition": row[0], "count": row[1]} for row in top_diagnoses_result.all()]

    # =========================================================================
    # COMMUNITY DISTRIBUTION
    # =========================================================================
    community_result = await db.execute(
        select(Patient.community, func.count(Patient.id).label("count"))
        .where(Patient.community.isnot(None))
        .group_by(Patient.community)
        .order_by(func.count(Patient.id).desc())
    )
    community_distribution = [{"community": row[0], "patient_count": row[1]} for row in community_result.all()]

    # =========================================================================
    # GENDER DISTRIBUTION
    # =========================================================================
    gender_result = await db.execute(
        select(Patient.gender, func.count(Patient.id).label("count"))
        .group_by(Patient.gender)
    )
    gender_distribution = {row[0]: row[1] for row in gender_result.all()}

    # =========================================================================
    # AGE DISTRIBUTION
    # =========================================================================
    age_distribution = {"0-18": 0, "19-35": 0, "36-50": 0, "51-65": 0, "65+": 0}
    patients_result = await db.execute(select(Patient.birthdate))
    for row in patients_result.all():
        if row[0]:
            age = (today - row[0]).days // 365
            if age <= 18:
                age_distribution["0-18"] += 1
            elif age <= 35:
                age_distribution["19-35"] += 1
            elif age <= 50:
                age_distribution["36-50"] += 1
            elif age <= 65:
                age_distribution["51-65"] += 1
            else:
                age_distribution["65+"] += 1

    # =========================================================================
    # VISITS OVER TIME (dynamic based on time range)
    # =========================================================================
    visits_over_time = []
    if time_range == "day":
        # Hourly for the day
        for hour in range(24):
            hour_start = today_start + timedelta(hours=hour)
            hour_end = hour_start + timedelta(hours=1)
            result = await db.execute(
                select(func.count()).select_from(Visit)
                .where(and_(Visit.start_datetime >= hour_start, Visit.start_datetime < hour_end))
            )
            visits_over_time.append({
                "date": hour_start.strftime("%H:00"),
                "count": result.scalar() or 0,
            })
    elif time_range == "week":
        # Daily for the week
        for i in range(7, -1, -1):
            day = today - timedelta(days=i)
            day_start = datetime.combine(day, datetime.min.time())
            day_end = datetime.combine(day, datetime.max.time())
            result = await db.execute(
                select(func.count()).select_from(Visit)
                .where(and_(Visit.start_datetime >= day_start, Visit.start_datetime <= day_end))
            )
            visits_over_time.append({
                "date": day.isoformat(),
                "count": result.scalar() or 0,
            })
    elif time_range == "month":
        # Daily for the month (last 30 days)
        for i in range(30, -1, -1):
            day = today - timedelta(days=i)
            day_start = datetime.combine(day, datetime.min.time())
            day_end = datetime.combine(day, datetime.max.time())
            result = await db.execute(
                select(func.count()).select_from(Visit)
                .where(and_(Visit.start_datetime >= day_start, Visit.start_datetime <= day_end))
            )
            visits_over_time.append({
                "date": day.isoformat(),
                "count": result.scalar() or 0,
            })
    else:  # year
        # Monthly for the year
        for i in range(12, -1, -1):
            month_start = (today.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
            if i > 0:
                next_month = (month_start + timedelta(days=32)).replace(day=1)
            else:
                next_month = today + timedelta(days=1)
            month_start_dt = datetime.combine(month_start, datetime.min.time())
            next_month_dt = datetime.combine(next_month, datetime.min.time())
            result = await db.execute(
                select(func.count()).select_from(Visit)
                .where(and_(Visit.start_datetime >= month_start_dt, Visit.start_datetime < next_month_dt))
            )
            visits_over_time.append({
                "date": month_start.strftime("%Y-%m"),
                "count": result.scalar() or 0,
            })

    # =========================================================================
    # DEPARTMENT/LOCATION STATS (from encounters and visits)
    # =========================================================================
    dept_result = await db.execute(
        select(Encounter.location, func.count(Encounter.id).label("count"))
        .where(Encounter.location.isnot(None))
        .group_by(Encounter.location)
        .order_by(func.count(Encounter.id).desc())
        .limit(10)
    )
    department_stats = [
        DepartmentStats(department=row[0], count=row[1])
        for row in dept_result.all()
    ]

    # If no encounter locations, try visit locations
    if not department_stats:
        visit_loc_result = await db.execute(
            select(Visit.location, func.count(Visit.id).label("count"))
            .where(Visit.location.isnot(None))
            .group_by(Visit.location)
            .order_by(func.count(Visit.id).desc())
            .limit(10)
        )
        department_stats = [
            DepartmentStats(department=row[0], count=row[1])
            for row in visit_loc_result.all()
        ]

    # =========================================================================
    # STAFF STATS (from users table)
    # =========================================================================
    total_staff_result = await db.execute(select(func.count()).select_from(User))
    total_staff = total_staff_result.scalar() or 0

    active_staff_result = await db.execute(
        select(func.count()).select_from(User).where(User.active == True)
    )
    active_staff = active_staff_result.scalar() or 0

    role_result = await db.execute(
        select(User.role, func.count(User.id).label("count"))
        .group_by(User.role)
    )
    by_role = {row[0]: row[1] for row in role_result.all()}

    staff_stats = StaffStats(
        total=total_staff,
        active=active_staff,
        by_role=by_role
    )

    # =========================================================================
    # LAB ORDER STATS
    # =========================================================================
    lab_status_result = await db.execute(
        select(LabOrder.status, func.count(LabOrder.id).label("count"))
        .group_by(LabOrder.status)
    )
    lab_order_stats = {row[0]: row[1] for row in lab_status_result.all()}

    # =========================================================================
    # PHARMACY ORDER STATS
    # =========================================================================
    pharm_status_result = await db.execute(
        select(PharmacyOrder.status, func.count(PharmacyOrder.id).label("count"))
        .group_by(PharmacyOrder.status)
    )
    pharmacy_order_stats = {row[0]: row[1] for row in pharm_status_result.all()}

    return AnalyticsResponse(
        total_patients=total_patients,
        total_visits=total_visits,
        total_encounters=total_encounters,
        active_patients=active_patients,
        patients_today=patients_today,
        visits_today=visits_today,
        top_diagnoses=top_diagnoses,
        community_distribution=community_distribution,
        visits_over_time=visits_over_time,
        gender_distribution=gender_distribution,
        age_distribution=age_distribution,
        # New fields
        department_stats=department_stats,
        staff_stats=staff_stats,
        patient_trend=patient_trend,
        visit_trend=visit_trend,
        encounter_trend=encounter_trend,
        lab_order_stats=lab_order_stats,
        pharmacy_order_stats=pharmacy_order_stats,
    )


@router.get("/disease-stats")
async def get_disease_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get disease/diagnosis statistics."""
    result = await db.execute(
        select(Diagnosis.condition_text, func.count(Diagnosis.id).label("count"))
        .group_by(Diagnosis.condition_text)
        .order_by(func.count(Diagnosis.id).desc())
        .limit(20)
    )
    return [{"condition": row[0], "count": row[1]} for row in result.all()]
