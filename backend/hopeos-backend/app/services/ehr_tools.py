"""EHR Tools for Agent-based navigation.

These tools allow the AI agent to query patient data from the EHR database.
Each tool returns structured data that the agent can reason over.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy import select, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.models.observation import Observation
from app.models.medication import Medication
from app.models.lab_order import LabOrder
from app.models.diagnosis import Diagnosis
from app.models.encounter import Encounter
from app.models.allergy import Allergy


# Tool definitions for function calling
EHR_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_patient_info",
            "description": "Get basic patient demographics and identifiers",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {
                        "type": "string",
                        "description": "The patient's UUID"
                    }
                },
                "required": ["patient_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_patient_vitals",
            "description": "Get patient vital signs (blood pressure, heart rate, temperature, weight, glucose). Can filter by type and date range.",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {
                        "type": "string",
                        "description": "The patient's UUID"
                    },
                    "vital_type": {
                        "type": "string",
                        "description": "Optional: Filter by vital type (e.g., 'blood_pressure', 'glucose', 'heart_rate', 'temperature', 'weight')",
                        "enum": ["blood_pressure", "glucose", "heart_rate", "temperature", "weight", "all"]
                    },
                    "days_back": {
                        "type": "integer",
                        "description": "Number of days to look back (default: 90)"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results (default: 10)"
                    }
                },
                "required": ["patient_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_patient_labs",
            "description": "Get patient laboratory test results. Can filter by test type (HbA1c, eGFR, lipids, etc.)",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {
                        "type": "string",
                        "description": "The patient's UUID"
                    },
                    "test_type": {
                        "type": "string",
                        "description": "Optional: Filter by test type (e.g., 'HbA1c', 'eGFR', 'LDL', 'Creatinine', 'Potassium')"
                    },
                    "days_back": {
                        "type": "integer",
                        "description": "Number of days to look back (default: 365)"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results (default: 20)"
                    }
                },
                "required": ["patient_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_patient_medications",
            "description": "Get patient's current and past medications",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {
                        "type": "string",
                        "description": "The patient's UUID"
                    },
                    "status": {
                        "type": "string",
                        "description": "Filter by status: 'active', 'completed', 'stopped', or 'all'",
                        "enum": ["active", "completed", "stopped", "all"]
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results (default: 20)"
                    }
                },
                "required": ["patient_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_patient_diagnoses",
            "description": "Get patient's diagnoses and medical conditions",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {
                        "type": "string",
                        "description": "The patient's UUID"
                    },
                    "condition_keyword": {
                        "type": "string",
                        "description": "Optional: Filter by condition keyword (e.g., 'diabetes', 'hypertension', 'kidney')"
                    },
                    "certainty": {
                        "type": "string",
                        "description": "Filter by certainty: 'confirmed', 'presumed', or 'all'",
                        "enum": ["confirmed", "presumed", "all"]
                    }
                },
                "required": ["patient_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_patient_encounters",
            "description": "Get patient's visit/encounter history",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {
                        "type": "string",
                        "description": "The patient's UUID"
                    },
                    "encounter_type": {
                        "type": "string",
                        "description": "Optional: Filter by encounter type (e.g., 'Consultation', 'Follow-up', 'Emergency')"
                    },
                    "days_back": {
                        "type": "integer",
                        "description": "Number of days to look back (default: 365)"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results (default: 10)"
                    }
                },
                "required": ["patient_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_patient_allergies",
            "description": "Get patient's known allergies and adverse reactions",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {
                        "type": "string",
                        "description": "The patient's UUID"
                    }
                },
                "required": ["patient_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_clinical_indicators",
            "description": "Calculate clinical indicators and risk scores (e.g., days since last visit, medication count for polypharmacy, time since last HbA1c)",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {
                        "type": "string",
                        "description": "The patient's UUID"
                    },
                    "indicators": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of indicators to calculate: 'days_since_last_visit', 'medication_count', 'days_since_hba1c', 'bp_control', 'diabetes_control'"
                    }
                },
                "required": ["patient_id"]
            }
        }
    }
]


# Mapping of vital type names to LOINC codes
VITAL_CODE_MAP = {
    "blood_pressure": ["8480-6", "8462-4"],  # Systolic, Diastolic
    "systolic": ["8480-6"],
    "diastolic": ["8462-4"],
    "glucose": ["2339-0"],
    "heart_rate": ["8867-4"],
    "temperature": ["8310-5"],
    "weight": ["29463-7"],
}


class EHRTools:
    """Tool executor for EHR queries."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool by name with given arguments."""
        tool_map = {
            "get_patient_info": self.get_patient_info,
            "get_patient_vitals": self.get_patient_vitals,
            "get_patient_labs": self.get_patient_labs,
            "get_patient_medications": self.get_patient_medications,
            "get_patient_diagnoses": self.get_patient_diagnoses,
            "get_patient_encounters": self.get_patient_encounters,
            "get_patient_allergies": self.get_patient_allergies,
            "calculate_clinical_indicators": self.calculate_clinical_indicators,
        }

        if tool_name not in tool_map:
            return {"error": f"Unknown tool: {tool_name}"}

        try:
            return await tool_map[tool_name](**arguments)
        except Exception as e:
            return {"error": f"Tool execution failed: {str(e)}"}

    async def get_patient_info(self, patient_id: str) -> Dict[str, Any]:
        """Get basic patient information."""
        result = await self.db.execute(
            select(Patient).where(Patient.id == patient_id)
        )
        patient = result.scalar_one_or_none()

        if not patient:
            return {"error": "Patient not found"}

        # Calculate age
        age = None
        if patient.birthdate:
            today = datetime.now().date()
            age = today.year - patient.birthdate.year
            if (today.month, today.day) < (patient.birthdate.month, patient.birthdate.day):
                age -= 1

        return {
            "patient_id": patient.id,
            "identifier": patient.identifier,
            "name": f"{patient.first_name} {patient.middle_name or ''} {patient.last_name}".strip(),
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "gender": patient.gender,
            "birthdate": str(patient.birthdate) if patient.birthdate else None,
            "age": age,
            "phone": patient.phone_number,
            "city": patient.city,
            "community": patient.community,
            "ghana_card": patient.ghana_card_number,
            "nhis_number": patient.nhis_number,
            "active": patient.active,
        }

    async def get_patient_vitals(
        self,
        patient_id: str,
        vital_type: str = "all",
        days_back: int = 90,
        limit: int = 10
    ) -> Dict[str, Any]:
        """Get patient vital signs."""
        cutoff_date = datetime.now() - timedelta(days=days_back)

        query = select(Observation).where(
            and_(
                Observation.patient_id == patient_id,
                Observation.concept_type == "vital_signs",
                Observation.obs_datetime >= cutoff_date
            )
        ).order_by(desc(Observation.obs_datetime)).limit(limit)

        # Filter by vital type if specified
        if vital_type and vital_type != "all":
            codes = VITAL_CODE_MAP.get(vital_type, [])
            if codes:
                query = select(Observation).where(
                    and_(
                        Observation.patient_id == patient_id,
                        Observation.concept_type == "vital_signs",
                        Observation.concept_code.in_(codes),
                        Observation.obs_datetime >= cutoff_date
                    )
                ).order_by(desc(Observation.obs_datetime)).limit(limit)

        result = await self.db.execute(query)
        vitals = result.scalars().all()

        return {
            "patient_id": patient_id,
            "vital_type_filter": vital_type,
            "days_back": days_back,
            "count": len(vitals),
            "vitals": [
                {
                    "type": v.concept_display,
                    "code": v.concept_code,
                    "value": float(v.value_numeric) if v.value_numeric else v.value_text,
                    "unit": v.unit,
                    "datetime": v.obs_datetime.isoformat() if v.obs_datetime else None,
                }
                for v in vitals
            ]
        }

    async def get_patient_labs(
        self,
        patient_id: str,
        test_type: Optional[str] = None,
        days_back: int = 365,
        limit: int = 20
    ) -> Dict[str, Any]:
        """Get patient laboratory results."""
        cutoff_date = datetime.now() - timedelta(days=days_back)

        conditions = [
            LabOrder.patient_id == patient_id,
            LabOrder.results_available == True,
            LabOrder.ordered_date >= cutoff_date
        ]

        if test_type:
            conditions.append(LabOrder.test_type.ilike(f"%{test_type}%"))

        query = select(LabOrder).where(
            and_(*conditions)
        ).order_by(desc(LabOrder.completed_at)).limit(limit)

        result = await self.db.execute(query)
        labs = result.scalars().all()

        return {
            "patient_id": patient_id,
            "test_type_filter": test_type,
            "days_back": days_back,
            "count": len(labs),
            "results": [
                {
                    "test_type": lab.test_type,
                    "test_code": lab.test_code,
                    "value": lab.result_value,
                    "unit": lab.result_unit,
                    "interpretation": lab.result_interpretation,
                    "ordered_date": lab.ordered_date.isoformat() if lab.ordered_date else None,
                    "completed_date": lab.completed_at.isoformat() if lab.completed_at else None,
                }
                for lab in labs
            ]
        }

    async def get_patient_medications(
        self,
        patient_id: str,
        status: str = "active",
        limit: int = 20
    ) -> Dict[str, Any]:
        """Get patient medications."""
        conditions = [Medication.patient_id == patient_id]

        if status and status != "all":
            conditions.append(Medication.status == status)

        query = select(Medication).where(
            and_(*conditions)
        ).order_by(desc(Medication.prescribed_date)).limit(limit)

        result = await self.db.execute(query)
        meds = result.scalars().all()

        return {
            "patient_id": patient_id,
            "status_filter": status,
            "count": len(meds),
            "medications": [
                {
                    "drug_name": med.drug_name,
                    "drug_code": med.drug_code,
                    "dosage": med.dosage,
                    "frequency": med.frequency,
                    "route": med.route,
                    "status": med.status,
                    "prescribed_date": med.prescribed_date.isoformat() if med.prescribed_date else None,
                }
                for med in meds
            ]
        }

    async def get_patient_diagnoses(
        self,
        patient_id: str,
        condition_keyword: Optional[str] = None,
        certainty: str = "all"
    ) -> Dict[str, Any]:
        """Get patient diagnoses."""
        conditions = [Diagnosis.patient_id == patient_id]

        if condition_keyword:
            conditions.append(Diagnosis.condition_text.ilike(f"%{condition_keyword}%"))

        if certainty and certainty != "all":
            conditions.append(Diagnosis.certainty == certainty)

        query = select(Diagnosis).where(
            and_(*conditions)
        ).order_by(Diagnosis.rank)

        result = await self.db.execute(query)
        diagnoses = result.scalars().all()

        return {
            "patient_id": patient_id,
            "condition_filter": condition_keyword,
            "certainty_filter": certainty,
            "count": len(diagnoses),
            "diagnoses": [
                {
                    "condition": dx.condition_text,
                    "code": dx.condition_code,
                    "certainty": dx.certainty,
                    "rank": dx.rank,
                    "diagnosed_date": dx.diagnosed_date.isoformat() if dx.diagnosed_date else None,
                }
                for dx in diagnoses
            ]
        }

    async def get_patient_encounters(
        self,
        patient_id: str,
        encounter_type: Optional[str] = None,
        days_back: int = 365,
        limit: int = 10
    ) -> Dict[str, Any]:
        """Get patient encounters/visits."""
        cutoff_date = datetime.now() - timedelta(days=days_back)

        conditions = [
            Encounter.patient_id == patient_id,
            Encounter.encounter_datetime >= cutoff_date
        ]

        if encounter_type:
            conditions.append(Encounter.encounter_type.ilike(f"%{encounter_type}%"))

        query = select(Encounter).where(
            and_(*conditions)
        ).order_by(desc(Encounter.encounter_datetime)).limit(limit)

        result = await self.db.execute(query)
        encounters = result.scalars().all()

        return {
            "patient_id": patient_id,
            "type_filter": encounter_type,
            "days_back": days_back,
            "count": len(encounters),
            "encounters": [
                {
                    "type": enc.encounter_type,
                    "datetime": enc.encounter_datetime.isoformat() if enc.encounter_datetime else None,
                    "location": enc.location,
                    "notes": enc.notes[:200] if enc.notes else None,  # Truncate long notes
                }
                for enc in encounters
            ]
        }

    async def get_patient_allergies(self, patient_id: str) -> Dict[str, Any]:
        """Get patient allergies."""
        try:
            query = select(Allergy).where(Allergy.patient_id == patient_id)
            result = await self.db.execute(query)
            allergies = result.scalars().all()

            return {
                "patient_id": patient_id,
                "count": len(allergies),
                "allergies": [
                    {
                        "allergen": allergy.allergen,
                        "reaction": allergy.reaction,
                        "severity": allergy.severity,
                        "status": allergy.status,
                    }
                    for allergy in allergies
                ]
            }
        except Exception:
            # Allergy table might not exist
            return {
                "patient_id": patient_id,
                "count": 0,
                "allergies": [],
                "note": "No allergy data available"
            }

    async def calculate_clinical_indicators(
        self,
        patient_id: str,
        indicators: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Calculate clinical indicators and risk metrics."""
        if indicators is None:
            indicators = ["days_since_last_visit", "medication_count", "days_since_hba1c", "bp_control"]

        result = {"patient_id": patient_id, "indicators": {}}

        for indicator in indicators:
            if indicator == "days_since_last_visit":
                enc_result = await self.db.execute(
                    select(Encounter)
                    .where(Encounter.patient_id == patient_id)
                    .order_by(desc(Encounter.encounter_datetime))
                    .limit(1)
                )
                last_enc = enc_result.scalar_one_or_none()
                if last_enc and last_enc.encounter_datetime:
                    days = (datetime.now() - last_enc.encounter_datetime).days
                    result["indicators"]["days_since_last_visit"] = {
                        "value": days,
                        "last_visit_date": last_enc.encounter_datetime.isoformat(),
                        "overdue": days > 180,  # More than 6 months
                        "status": "overdue" if days > 180 else "due_soon" if days > 90 else "ok"
                    }
                else:
                    result["indicators"]["days_since_last_visit"] = {"value": None, "note": "No visits found"}

            elif indicator == "medication_count":
                med_result = await self.db.execute(
                    select(Medication)
                    .where(and_(
                        Medication.patient_id == patient_id,
                        Medication.status == "active"
                    ))
                )
                meds = med_result.scalars().all()
                count = len(meds)
                result["indicators"]["medication_count"] = {
                    "value": count,
                    "polypharmacy": count >= 5,
                    "high_polypharmacy": count >= 10,
                    "medications": [m.drug_name for m in meds]
                }

            elif indicator == "days_since_hba1c":
                lab_result = await self.db.execute(
                    select(LabOrder)
                    .where(and_(
                        LabOrder.patient_id == patient_id,
                        LabOrder.test_type.ilike("%hba1c%"),
                        LabOrder.results_available == True
                    ))
                    .order_by(desc(LabOrder.completed_at))
                    .limit(1)
                )
                last_hba1c = lab_result.scalar_one_or_none()
                if last_hba1c and last_hba1c.completed_at:
                    days = (datetime.now() - last_hba1c.completed_at).days
                    result["indicators"]["days_since_hba1c"] = {
                        "value": days,
                        "last_value": last_hba1c.result_value,
                        "last_date": last_hba1c.completed_at.isoformat(),
                        "overdue": days > 90,  # More than 3 months for diabetics
                        "status": "overdue" if days > 90 else "due_soon" if days > 60 else "ok"
                    }
                else:
                    result["indicators"]["days_since_hba1c"] = {"value": None, "note": "No HbA1c tests found"}

            elif indicator == "bp_control":
                bp_result = await self.db.execute(
                    select(Observation)
                    .where(and_(
                        Observation.patient_id == patient_id,
                        Observation.concept_code.in_(["8480-6", "8462-4"]),
                    ))
                    .order_by(desc(Observation.obs_datetime))
                    .limit(2)
                )
                bp_readings = bp_result.scalars().all()
                if len(bp_readings) >= 2:
                    systolic = next((v for v in bp_readings if v.concept_code == "8480-6"), None)
                    diastolic = next((v for v in bp_readings if v.concept_code == "8462-4"), None)
                    if systolic and diastolic:
                        sys_val = float(systolic.value_numeric) if systolic.value_numeric else 0
                        dia_val = float(diastolic.value_numeric) if diastolic.value_numeric else 0
                        result["indicators"]["bp_control"] = {
                            "systolic": sys_val,
                            "diastolic": dia_val,
                            "reading": f"{int(sys_val)}/{int(dia_val)}",
                            "date": systolic.obs_datetime.isoformat() if systolic.obs_datetime else None,
                            "elevated": sys_val >= 140 or dia_val >= 90,
                            "severely_elevated": sys_val >= 180 or dia_val >= 120,
                            "status": "critical" if sys_val >= 180 or dia_val >= 120 else "elevated" if sys_val >= 140 or dia_val >= 90 else "controlled"
                        }
                else:
                    result["indicators"]["bp_control"] = {"note": "Insufficient BP readings"}

            elif indicator == "diabetes_control":
                # Get latest HbA1c and glucose
                hba1c_result = await self.db.execute(
                    select(LabOrder)
                    .where(and_(
                        LabOrder.patient_id == patient_id,
                        LabOrder.test_type.ilike("%hba1c%"),
                        LabOrder.results_available == True
                    ))
                    .order_by(desc(LabOrder.completed_at))
                    .limit(1)
                )
                last_hba1c = hba1c_result.scalar_one_or_none()

                glucose_result = await self.db.execute(
                    select(Observation)
                    .where(and_(
                        Observation.patient_id == patient_id,
                        Observation.concept_code == "2339-0"
                    ))
                    .order_by(desc(Observation.obs_datetime))
                    .limit(1)
                )
                last_glucose = glucose_result.scalar_one_or_none()

                control_data = {}
                if last_hba1c:
                    try:
                        hba1c_val = float(last_hba1c.result_value)
                        control_data["hba1c"] = {
                            "value": hba1c_val,
                            "date": last_hba1c.completed_at.isoformat() if last_hba1c.completed_at else None,
                            "controlled": hba1c_val < 7.0,
                            "status": "controlled" if hba1c_val < 7.0 else "uncontrolled" if hba1c_val < 9.0 else "poorly_controlled"
                        }
                    except ValueError:
                        pass

                if last_glucose and last_glucose.value_numeric:
                    glucose_val = float(last_glucose.value_numeric)
                    control_data["fasting_glucose"] = {
                        "value": glucose_val,
                        "date": last_glucose.obs_datetime.isoformat() if last_glucose.obs_datetime else None,
                        "elevated": glucose_val > 126,
                        "status": "normal" if glucose_val < 100 else "prediabetic" if glucose_val < 126 else "diabetic"
                    }

                result["indicators"]["diabetes_control"] = control_data if control_data else {"note": "No diabetes markers found"}

        return result
