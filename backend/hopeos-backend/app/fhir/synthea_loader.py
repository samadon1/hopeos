"""Load Synthea-generated FHIR data into the database."""
import json
import asyncio
from pathlib import Path
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import async_session
from app.models.patient import Patient
from app.models.encounter import Encounter
from app.models.observation import Observation
from app.models.medication import Medication
from app.models.diagnosis import Diagnosis
from app.utils.identifier import generate_patient_identifier


class SyntheaLoader:
    """Load Synthea FHIR bundles into the database."""

    def __init__(self, db: AsyncSession, data_dir: str = "synthea/output/fhir"):
        self.db = db
        self.data_dir = Path(data_dir)
        self.stats = {
            "patients": 0,
            "encounters": 0,
            "observations": 0,
            "medications": 0,
            "conditions": 0,
        }
        self.patient_map = {}  # FHIR id -> DB id

    async def load_all(self) -> dict:
        """Load all Synthea FHIR bundles from the data directory."""
        if not self.data_dir.exists():
            return {"error": f"Data directory not found: {self.data_dir}"}

        bundle_files = list(self.data_dir.glob("*.json"))
        if not bundle_files:
            return {"error": "No JSON files found in data directory"}

        for bundle_file in bundle_files:
            try:
                bundle = json.loads(bundle_file.read_text())
                if bundle.get("resourceType") == "Bundle":
                    await self._process_bundle(bundle)
            except Exception as e:
                print(f"Error processing {bundle_file}: {e}")

        await self.db.commit()
        return self.stats

    async def _process_bundle(self, bundle: dict):
        """Process a single FHIR Bundle."""
        entries = bundle.get("entry", [])

        # First pass: create patients
        for entry in entries:
            resource = entry.get("resource", {})
            if resource.get("resourceType") == "Patient":
                await self._create_patient(resource)

        # Second pass: create related resources
        for entry in entries:
            resource = entry.get("resource", {})
            resource_type = resource.get("resourceType")

            if resource_type == "Encounter":
                await self._create_encounter(resource)
            elif resource_type == "Observation":
                await self._create_observation(resource)
            elif resource_type == "MedicationRequest":
                await self._create_medication(resource)
            elif resource_type == "Condition":
                await self._create_diagnosis(resource)

    async def _create_patient(self, fhir_patient: dict) -> Patient | None:
        """Convert FHIR Patient to database model."""
        fhir_id = fhir_patient.get("id")
        if not fhir_id:
            return None

        # Check if already exists
        if fhir_id in self.patient_map:
            return None

        # Parse name
        names = fhir_patient.get("name", [{}])
        name = names[0] if names else {}
        given_names = name.get("given", ["Unknown"])
        first_name = given_names[0] if given_names else "Unknown"
        middle_name = given_names[1] if len(given_names) > 1 else None
        last_name = name.get("family", "Unknown")

        # Parse address
        addresses = fhir_patient.get("address", [{}])
        address = addresses[0] if addresses else {}

        # Parse birthdate
        birthdate_str = fhir_patient.get("birthDate", "1990-01-01")
        try:
            birthdate = datetime.strptime(birthdate_str, "%Y-%m-%d").date()
        except ValueError:
            birthdate = date(1990, 1, 1)

        # Generate identifier
        identifier = await generate_patient_identifier(self.db)

        # Get phone/email from telecom
        phone = None
        email = None
        for telecom in fhir_patient.get("telecom", []):
            if telecom.get("system") == "phone":
                phone = telecom.get("value")
            elif telecom.get("system") == "email":
                email = telecom.get("value")

        patient = Patient(
            identifier=identifier,
            first_name=first_name,
            middle_name=middle_name,
            last_name=last_name,
            gender=fhir_patient.get("gender", "unknown"),
            birthdate=birthdate,
            phone_number=phone,
            email=email,
            address_line1=", ".join(address.get("line", [])),
            city=address.get("city"),
            state=address.get("state"),
            postal_code=address.get("postalCode"),
            country=address.get("country", "Ghana"),
            community="Synthea Import",
        )

        self.db.add(patient)
        await self.db.flush()

        self.patient_map[fhir_id] = patient.id
        self.stats["patients"] += 1

        return patient

    async def _create_encounter(self, fhir_encounter: dict):
        """Convert FHIR Encounter to database model."""
        # Get patient reference
        subject = fhir_encounter.get("subject", {})
        patient_ref = subject.get("reference", "")
        fhir_patient_id = patient_ref.replace("urn:uuid:", "").replace("Patient/", "")

        patient_id = self.patient_map.get(fhir_patient_id)
        if not patient_id:
            return

        # Parse datetime
        period = fhir_encounter.get("period", {})
        start_str = period.get("start", datetime.utcnow().isoformat())
        try:
            encounter_datetime = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        except ValueError:
            encounter_datetime = datetime.utcnow()

        # Get encounter type
        type_coding = fhir_encounter.get("type", [{}])
        encounter_type = "General"
        if type_coding and type_coding[0].get("coding"):
            encounter_type = type_coding[0]["coding"][0].get("display", "General")

        encounter = Encounter(
            patient_id=patient_id,
            encounter_type=encounter_type[:50],  # Limit length
            encounter_datetime=encounter_datetime,
            location="Synthea Clinic",
        )

        self.db.add(encounter)
        self.stats["encounters"] += 1

    async def _create_observation(self, fhir_obs: dict):
        """Convert FHIR Observation to database model."""
        # Get patient reference
        subject = fhir_obs.get("subject", {})
        patient_ref = subject.get("reference", "")
        fhir_patient_id = patient_ref.replace("urn:uuid:", "").replace("Patient/", "")

        patient_id = self.patient_map.get(fhir_patient_id)
        if not patient_id:
            return

        # Get concept
        code = fhir_obs.get("code", {})
        coding = code.get("coding", [{}])
        concept = coding[0] if coding else {}

        concept_display = concept.get("display", "Unknown")
        concept_code = concept.get("code")

        # Determine concept type
        category = fhir_obs.get("category", [{}])
        concept_type = "vital_signs"
        if category:
            cat_coding = category[0].get("coding", [{}])
            if cat_coding and cat_coding[0].get("code") == "laboratory":
                concept_type = "lab_result"

        # Get value
        value_numeric = None
        value_text = None
        unit = None

        if "valueQuantity" in fhir_obs:
            vq = fhir_obs["valueQuantity"]
            value_numeric = Decimal(str(vq.get("value", 0)))
            unit = vq.get("unit")
            value_type = "numeric"
        elif "valueString" in fhir_obs:
            value_text = fhir_obs["valueString"]
            value_type = "text"
        else:
            value_type = "text"
            value_text = "No value"

        # Parse datetime
        effective = fhir_obs.get("effectiveDateTime", datetime.utcnow().isoformat())
        try:
            obs_datetime = datetime.fromisoformat(effective.replace("Z", "+00:00"))
        except ValueError:
            obs_datetime = datetime.utcnow()

        observation = Observation(
            patient_id=patient_id,
            concept_type=concept_type,
            concept_code=concept_code,
            concept_display=concept_display[:200],
            value_type=value_type,
            value_numeric=value_numeric,
            value_text=value_text,
            unit=unit,
            obs_datetime=obs_datetime,
        )

        self.db.add(observation)
        self.stats["observations"] += 1

    async def _create_medication(self, fhir_med: dict):
        """Convert FHIR MedicationRequest to database model."""
        # Get patient reference
        subject = fhir_med.get("subject", {})
        patient_ref = subject.get("reference", "")
        fhir_patient_id = patient_ref.replace("urn:uuid:", "").replace("Patient/", "")

        patient_id = self.patient_map.get(fhir_patient_id)
        if not patient_id:
            return

        # Get medication
        med_codeable = fhir_med.get("medicationCodeableConcept", {})
        coding = med_codeable.get("coding", [{}])
        med = coding[0] if coding else {}

        drug_name = med.get("display", "Unknown Medication")
        drug_code = med.get("code")

        # Get dosage
        dosage_instructions = fhir_med.get("dosageInstruction", [{}])
        dosage_text = "As directed"
        if dosage_instructions:
            dosage_text = dosage_instructions[0].get("text", "As directed")

        medication = Medication(
            patient_id=patient_id,
            drug_name=drug_name[:200],
            drug_code=drug_code,
            dosage=dosage_text[:50] if dosage_text else "1",
            frequency="As directed",
        )

        self.db.add(medication)
        self.stats["medications"] += 1

    async def _create_diagnosis(self, fhir_condition: dict):
        """Convert FHIR Condition to database model."""
        # Get patient reference
        subject = fhir_condition.get("subject", {})
        patient_ref = subject.get("reference", "")
        fhir_patient_id = patient_ref.replace("urn:uuid:", "").replace("Patient/", "")

        patient_id = self.patient_map.get(fhir_patient_id)
        if not patient_id:
            return

        # Get condition
        code = fhir_condition.get("code", {})
        coding = code.get("coding", [{}])
        condition = coding[0] if coding else {}

        condition_text = condition.get("display", "Unknown Condition")
        condition_code = condition.get("code")

        # Parse onset date
        onset = fhir_condition.get("onsetDateTime", datetime.utcnow().isoformat())
        try:
            diagnosed_date = datetime.fromisoformat(onset.replace("Z", "+00:00"))
        except ValueError:
            diagnosed_date = datetime.utcnow()

        diagnosis = Diagnosis(
            patient_id=patient_id,
            condition_text=condition_text[:500],
            condition_code=condition_code,
            diagnosed_date=diagnosed_date,
        )

        self.db.add(diagnosis)
        self.stats["conditions"] += 1


async def load_synthea_data(data_dir: str = "synthea/output/fhir"):
    """Main function to load Synthea data."""
    async with async_session() as db:
        loader = SyntheaLoader(db, data_dir)
        stats = await loader.load_all()
        print(f"Loaded Synthea data: {stats}")
        return stats


if __name__ == "__main__":
    asyncio.run(load_synthea_data())
