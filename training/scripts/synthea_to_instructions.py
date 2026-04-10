#!/usr/bin/env python3
"""
Transform Synthea CSV output to instruction-tuning format for NCD prediction.

Usage:
    python synthea_to_instructions.py --input ./synthea/output/csv --output ./data
"""

import argparse
import csv
import json
import random
from pathlib import Path
from datetime import datetime, date
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

# NCD-relevant SNOMED codes
NCD_CONDITIONS = {
    "714628002": "Prediabetes",
    "44054006": "Type 2 Diabetes",
    "59621000": "Essential Hypertension",
    "38341003": "Hypertension",
    "368581000119106": "Diabetic Neuropathy",
    "1551000119108": "Diabetic Retinopathy",
    "127013003": "Diabetic Kidney Disease",
    "15777000": "Prediabetes (Impaired glucose tolerance)",
}

# NCD-relevant observation codes (LOINC)
VITAL_CODES = {
    "8480-6": "Systolic BP",
    "8462-4": "Diastolic BP",
    "39156-5": "BMI",
    "29463-7": "Body Weight",
    "8302-2": "Body Height",
    "8867-4": "Heart Rate",
}

LAB_CODES = {
    "2339-0": "Glucose",
    "2345-7": "Glucose (serum)",
    "4548-4": "HbA1c",
    "2093-3": "Total Cholesterol",
    "2085-9": "HDL Cholesterol",
    "2089-1": "LDL Cholesterol",
    "2571-8": "Triglycerides",
    "38483-4": "Creatinine",
    "33914-3": "eGFR",
}

ALL_CODES = {**VITAL_CODES, **LAB_CODES}


def calculate_age(birthdate: str, reference_date: Optional[str] = None) -> int:
    """Calculate age from birthdate."""
    birth = datetime.strptime(birthdate, "%Y-%m-%d").date()
    ref = datetime.strptime(reference_date, "%Y-%m-%d").date() if reference_date else date.today()
    age = ref.year - birth.year - ((ref.month, ref.day) < (birth.month, birth.day))
    return age


def load_patients(csv_path: Path) -> Dict[str, dict]:
    """Load patient demographics."""
    patients = {}
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            patients[row["Id"]] = {
                "id": row["Id"],
                "birthdate": row["BIRTHDATE"],
                "gender": "Male" if row["GENDER"] == "M" else "Female",
                "race": row.get("RACE", ""),
                "ethnicity": row.get("ETHNICITY", ""),
                "city": row.get("CITY", ""),
                "deceased": bool(row.get("DEATHDATE")),
            }
    return patients


def load_conditions(csv_path: Path) -> Dict[str, List[dict]]:
    """Load patient conditions, grouped by patient ID."""
    conditions = defaultdict(list)
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row["CODE"]
            if code in NCD_CONDITIONS:
                conditions[row["PATIENT"]].append({
                    "code": code,
                    "description": NCD_CONDITIONS[code],
                    "start": row["START"],
                    "stop": row.get("STOP", ""),
                })
    return dict(conditions)


def load_observations(csv_path: Path) -> Dict[str, List[dict]]:
    """Load patient observations, grouped by patient ID."""
    observations = defaultdict(list)
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row["CODE"]
            if code in ALL_CODES:
                try:
                    value = float(row["VALUE"]) if row["VALUE"] else None
                except ValueError:
                    value = row["VALUE"]

                if value is not None:
                    observations[row["PATIENT"]].append({
                        "code": code,
                        "description": ALL_CODES[code],
                        "value": value,
                        "units": row.get("UNITS", ""),
                        "date": row["DATE"][:10] if row["DATE"] else "",
                    })
    return dict(observations)


def load_medications(csv_path: Path) -> Dict[str, List[dict]]:
    """Load patient medications."""
    medications = defaultdict(list)
    ncd_med_keywords = ["metformin", "insulin", "glipizide", "sitagliptin",
                        "lisinopril", "amlodipine", "losartan", "atenolol",
                        "hydrochlorothiazide", "statin", "atorvastatin"]

    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            desc = row.get("DESCRIPTION", "").lower()
            if any(kw in desc for kw in ncd_med_keywords):
                medications[row["PATIENT"]].append({
                    "description": row["DESCRIPTION"],
                    "start": row["START"],
                    "stop": row.get("STOP", ""),
                })
    return dict(medications)


def get_latest_observations(observations: List[dict]) -> Dict[str, dict]:
    """Get the most recent observation for each type."""
    latest = {}
    for obs in sorted(observations, key=lambda x: x["date"]):
        latest[obs["description"]] = obs
    return latest


def assess_diabetes_risk(patient: dict, obs: Dict[str, dict], conditions: List[dict]) -> Tuple[str, List[str]]:
    """Assess diabetes risk based on observations and conditions."""
    risk_factors = []
    risk_level = "LOW"

    # Check existing conditions
    has_diabetes = any(c["description"] == "Type 2 Diabetes" for c in conditions)
    has_prediabetes = any("Prediabetes" in c["description"] for c in conditions)

    if has_diabetes:
        return "DIAGNOSED", ["Patient has diagnosed Type 2 Diabetes"]

    # Check glucose
    glucose = obs.get("Glucose") or obs.get("Glucose (serum)")
    if glucose:
        val = glucose["value"]
        if val >= 126:
            risk_factors.append(f"Fasting glucose {val:.1f} mg/dL (diabetic range ≥126)")
            risk_level = "HIGH"
        elif val >= 100:
            risk_factors.append(f"Fasting glucose {val:.1f} mg/dL (prediabetes range 100-125)")
            risk_level = "MODERATE" if risk_level != "HIGH" else risk_level

    # Check HbA1c
    hba1c = obs.get("HbA1c")
    if hba1c:
        val = hba1c["value"]
        if val >= 6.5:
            risk_factors.append(f"HbA1c {val:.1f}% (diabetic range ≥6.5%)")
            risk_level = "HIGH"
        elif val >= 5.7:
            risk_factors.append(f"HbA1c {val:.1f}% (prediabetes range 5.7-6.4%)")
            risk_level = "MODERATE" if risk_level != "HIGH" else risk_level

    # Check BMI
    bmi = obs.get("BMI")
    if bmi:
        val = bmi["value"]
        if val >= 30:
            risk_factors.append(f"BMI {val:.1f} (obese)")
            risk_level = "MODERATE" if risk_level == "LOW" else risk_level
        elif val >= 25:
            risk_factors.append(f"BMI {val:.1f} (overweight)")

    # Check age
    age = calculate_age(patient["birthdate"])
    if age >= 45:
        risk_factors.append(f"Age {age} years (≥45 increases risk)")

    if has_prediabetes:
        risk_factors.append("History of prediabetes")
        risk_level = "MODERATE" if risk_level == "LOW" else risk_level

    if not risk_factors:
        risk_factors.append("No significant risk factors identified")

    return risk_level, risk_factors


def assess_hypertension_risk(patient: dict, obs: Dict[str, dict], conditions: List[dict]) -> Tuple[str, List[str]]:
    """Assess hypertension risk based on observations and conditions."""
    risk_factors = []
    risk_level = "LOW"

    # Check existing conditions
    has_hypertension = any("Hypertension" in c["description"] for c in conditions)

    if has_hypertension:
        return "DIAGNOSED", ["Patient has diagnosed Hypertension"]

    # Check blood pressure
    systolic = obs.get("Systolic BP")
    diastolic = obs.get("Diastolic BP")

    if systolic and diastolic:
        sys_val = systolic["value"]
        dia_val = diastolic["value"]

        if sys_val >= 140 or dia_val >= 90:
            risk_factors.append(f"BP {sys_val:.0f}/{dia_val:.0f} mmHg (Stage 1+ hypertension)")
            risk_level = "HIGH"
        elif sys_val >= 130 or dia_val >= 80:
            risk_factors.append(f"BP {sys_val:.0f}/{dia_val:.0f} mmHg (elevated)")
            risk_level = "MODERATE"
        elif sys_val >= 120:
            risk_factors.append(f"BP {sys_val:.0f}/{dia_val:.0f} mmHg (slightly elevated)")

    # Check BMI
    bmi = obs.get("BMI")
    if bmi and bmi["value"] >= 30:
        risk_factors.append(f"BMI {bmi['value']:.1f} (obesity increases BP risk)")
        risk_level = "MODERATE" if risk_level == "LOW" else risk_level

    # Check age
    age = calculate_age(patient["birthdate"])
    if age >= 55:
        risk_factors.append(f"Age {age} years (≥55 increases risk)")

    if not risk_factors:
        risk_factors.append("No significant risk factors identified")

    return risk_level, risk_factors


def generate_recommendations(diabetes_risk: str, htn_risk: str, obs: Dict[str, dict]) -> List[str]:
    """Generate clinical recommendations based on risk assessment."""
    recommendations = []

    if diabetes_risk == "HIGH":
        recommendations.append("Order confirmatory tests: repeat fasting glucose, OGTT, or HbA1c")
        recommendations.append("Refer to diabetes educator if confirmed")
    elif diabetes_risk == "MODERATE":
        recommendations.append("Lifestyle counseling: diet modification, increase physical activity")
        recommendations.append("Recheck glucose/HbA1c in 3-6 months")

    if htn_risk == "HIGH":
        recommendations.append("Confirm elevated BP on 2 separate occasions")
        recommendations.append("Consider initiating antihypertensive therapy")
        recommendations.append("Order baseline labs: renal function, electrolytes, lipid panel")
    elif htn_risk == "MODERATE":
        recommendations.append("Lifestyle modifications: reduce sodium, DASH diet, exercise")
        recommendations.append("Recheck BP in 2-4 weeks")

    if diabetes_risk in ["DIAGNOSED", "HIGH"] or htn_risk in ["DIAGNOSED", "HIGH"]:
        recommendations.append("Assess cardiovascular risk (Framingham or ASCVD score)")

    # Check lipids
    ldl = obs.get("LDL Cholesterol")
    if ldl and ldl["value"] >= 130:
        recommendations.append(f"LDL {ldl['value']:.0f} mg/dL - consider statin therapy")

    if not recommendations:
        recommendations.append("Continue healthy lifestyle habits")
        recommendations.append("Annual wellness visit and screening")

    return recommendations


def format_patient_record(patient: dict, observations: List[dict],
                          conditions: List[dict], medications: List[dict]) -> str:
    """Format patient record as text input."""
    age = calculate_age(patient["birthdate"])
    latest_obs = get_latest_observations(observations)

    lines = [f"Patient: {age}yo {patient['gender']}"]

    # Vitals
    vitals = []
    if "Systolic BP" in latest_obs and "Diastolic BP" in latest_obs:
        vitals.append(f"BP {latest_obs['Systolic BP']['value']:.0f}/{latest_obs['Diastolic BP']['value']:.0f} mmHg")
    if "BMI" in latest_obs:
        vitals.append(f"BMI {latest_obs['BMI']['value']:.1f}")
    if "Body Weight" in latest_obs:
        vitals.append(f"Weight {latest_obs['Body Weight']['value']:.1f} kg")
    if "Heart Rate" in latest_obs:
        vitals.append(f"HR {latest_obs['Heart Rate']['value']:.0f} bpm")
    if vitals:
        lines.append(f"Vitals: {', '.join(vitals)}")

    # Labs
    labs = []
    for lab_name in ["Glucose", "Glucose (serum)", "HbA1c", "Total Cholesterol",
                     "HDL Cholesterol", "LDL Cholesterol", "Triglycerides", "Creatinine"]:
        if lab_name in latest_obs:
            obs = latest_obs[lab_name]
            labs.append(f"{lab_name} {obs['value']:.1f} {obs['units']}")
    if labs:
        lines.append(f"Labs: {', '.join(labs)}")

    # Active conditions
    active_conditions = [c["description"] for c in conditions if not c.get("stop")]
    if active_conditions:
        lines.append(f"Active conditions: {', '.join(active_conditions)}")

    # Medications
    active_meds = [m["description"] for m in medications if not m.get("stop")]
    if active_meds:
        lines.append(f"Medications: {', '.join(active_meds[:5])}")  # Limit to 5

    return "\n".join(lines)


def format_assessment(patient: dict, observations: List[dict], conditions: List[dict]) -> str:
    """Generate risk assessment output."""
    latest_obs = get_latest_observations(observations)

    diabetes_risk, diabetes_factors = assess_diabetes_risk(patient, latest_obs, conditions)
    htn_risk, htn_factors = assess_hypertension_risk(patient, latest_obs, conditions)
    recommendations = generate_recommendations(diabetes_risk, htn_risk, latest_obs)

    lines = ["## Risk Assessment", ""]

    # Diabetes
    lines.append(f"**Type 2 Diabetes: {diabetes_risk}**")
    for factor in diabetes_factors:
        lines.append(f"- {factor}")
    lines.append("")

    # Hypertension
    lines.append(f"**Hypertension: {htn_risk}**")
    for factor in htn_factors:
        lines.append(f"- {factor}")
    lines.append("")

    # Recommendations
    lines.append("## Recommendations")
    for i, rec in enumerate(recommendations, 1):
        lines.append(f"{i}. {rec}")

    return "\n".join(lines)


def create_instruction_example(patient: dict, observations: List[dict],
                               conditions: List[dict], medications: List[dict]) -> Optional[dict]:
    """Create a single instruction-tuning example."""
    if not observations:
        return None

    # Check if patient has enough data for meaningful assessment
    latest_obs = get_latest_observations(observations)
    has_bp = "Systolic BP" in latest_obs and "Diastolic BP" in latest_obs
    has_glucose = "Glucose" in latest_obs or "HbA1c" in latest_obs
    has_bmi = "BMI" in latest_obs

    if not (has_bp or has_glucose or has_bmi):
        return None

    input_text = format_patient_record(patient, observations, conditions, medications)
    output_text = format_assessment(patient, observations, conditions)

    instruction = "Based on the following patient record, assess the risk of Type 2 diabetes and hypertension. Provide risk levels (LOW, MODERATE, HIGH, or DIAGNOSED) with supporting factors, and clinical recommendations."

    return {
        "instruction": instruction,
        "input": input_text,
        "output": output_text,
        "patient_id": patient["id"],
    }


def main():
    parser = argparse.ArgumentParser(description="Transform Synthea CSV to instruction-tuning format")
    parser.add_argument("--input", "-i", required=True, help="Path to Synthea CSV output directory")
    parser.add_argument("--output", "-o", required=True, help="Path to output directory")
    parser.add_argument("--train-split", type=float, default=0.8, help="Training set ratio (default: 0.8)")
    parser.add_argument("--val-split", type=float, default=0.1, help="Validation set ratio (default: 0.1)")
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Loading Synthea data...")
    patients = load_patients(input_dir / "patients.csv")
    conditions = load_conditions(input_dir / "conditions.csv")
    observations = load_observations(input_dir / "observations.csv")
    medications = load_medications(input_dir / "medications.csv")

    print(f"Loaded {len(patients)} patients")
    print(f"Found {sum(len(v) for v in conditions.values())} NCD conditions")
    print(f"Found {sum(len(v) for v in observations.values())} relevant observations")

    # Generate examples
    print("\nGenerating instruction examples...")
    examples = []
    for patient_id, patient in patients.items():
        if patient["deceased"]:
            continue

        patient_obs = observations.get(patient_id, [])
        patient_cond = conditions.get(patient_id, [])
        patient_meds = medications.get(patient_id, [])

        example = create_instruction_example(patient, patient_obs, patient_cond, patient_meds)
        if example:
            examples.append(example)

    print(f"Generated {len(examples)} training examples")

    # Shuffle and split
    random.seed(42)
    random.shuffle(examples)

    train_end = int(len(examples) * args.train_split)
    val_end = train_end + int(len(examples) * args.val_split)

    train_examples = examples[:train_end]
    val_examples = examples[train_end:val_end]
    test_examples = examples[val_end:]

    # Write output files
    for split_name, split_examples in [("train", train_examples),
                                        ("val", val_examples),
                                        ("test", test_examples)]:
        output_file = output_dir / f"{split_name}.jsonl"
        with open(output_file, "w") as f:
            for example in split_examples:
                # Remove patient_id from output
                output_example = {k: v for k, v in example.items() if k != "patient_id"}
                f.write(json.dumps(output_example) + "\n")
        print(f"Wrote {len(split_examples)} examples to {output_file}")

    # Print sample
    if examples:
        print("\n" + "="*60)
        print("SAMPLE EXAMPLE:")
        print("="*60)
        sample = examples[0]
        print(f"\n[INSTRUCTION]\n{sample['instruction']}\n")
        print(f"[INPUT]\n{sample['input']}\n")
        print(f"[OUTPUT]\n{sample['output']}")


if __name__ == "__main__":
    main()
