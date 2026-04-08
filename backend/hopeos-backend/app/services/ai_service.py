"""AI Service using Ollama for local LLM inference with Gemma 4."""
import os
import re
import json
import base64
import asyncio
import subprocess
import tempfile
import httpx
from typing import Optional, List, AsyncGenerator, Dict, Any
from pathlib import Path

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "hopeos-gemma4")


class AIService:
    """Service for AI-powered clinical decision support using Gemma 4 via Ollama."""

    _instance: Optional["AIService"] = None

    def __init__(self):
        self.model_loaded = False
        self.is_multimodal = False
        self._client = httpx.Client(base_url=OLLAMA_BASE_URL, timeout=120.0)
        self._async_client = httpx.AsyncClient(base_url=OLLAMA_BASE_URL, timeout=120.0)

    @classmethod
    def get_instance(cls) -> "AIService":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = AIService()
        return cls._instance

    def load_model(self, force_reload: bool = False, auto_download: bool = False, preload_multimodal: bool = False) -> bool:
        """Check that Ollama is running and the model is available."""
        if self.model_loaded and not force_reload:
            return True

        try:
            resp = self._client.get("/api/tags")
            resp.raise_for_status()
            models = [m["name"] for m in resp.json().get("models", [])]
            if not any(OLLAMA_MODEL in m for m in models):
                print(f"Model '{OLLAMA_MODEL}' not found in Ollama. Available: {models}")
                print(f"Run: ollama create {OLLAMA_MODEL} -f models/Modelfile")
                return False
            print(f"Ollama model '{OLLAMA_MODEL}' ready.")
            self.model_loaded = True
            return True
        except httpx.ConnectError:
            print("Ollama not running. Start with: brew services start ollama")
            return False
        except Exception as e:
            print(f"Failed to connect to Ollama: {e}")
            return False

    def _call_ollama(self, messages: list, max_tokens: int = 512, temperature: float = 0.7) -> str:
        """Call Ollama chat API synchronously."""
        resp = self._client.post("/api/chat", json={
            "model": OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
            "options": {
                "num_predict": max_tokens,
                "temperature": temperature,
            },
        })
        resp.raise_for_status()
        return resp.json().get("message", {}).get("content", "").strip()

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 512,
        temperature: float = 0.7,
        image_base64: Optional[str] = None,
    ) -> str:
        """Generate a response from the LLM via Ollama."""
        if not self.model_loaded:
            if not self.load_model():
                return "AI model not available. Please ensure Ollama is running."

        return self._generate_text_only(prompt, system_prompt, max_tokens, temperature)

    def _generate_text_only(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 512,
        temperature: float = 0.7,
    ) -> str:
        """Generate text using Ollama API."""
        default_system = (
            "You are a clinical decision support assistant for HopeOS EHR. "
            "Provide helpful, accurate medical information while always "
            "recommending consultation with qualified healthcare providers "
            "for diagnosis and treatment decisions. Be concise and professional."
        )

        sys_content = system_prompt or default_system
        combined_prompt = f"{sys_content}\n\n{prompt}"

        messages = [{"role": "user", "content": combined_prompt}]

        try:
            return self._call_ollama(messages, max_tokens, temperature)
        except Exception as e:
            print(f"[DEBUG] Ollama generation error: {e}")
            return f"Error generating response: {str(e)}"

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 512,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """Stream responses from Ollama."""
        if not self.model_loaded:
            if not self.load_model():
                yield "AI model not available."
                return

        default_system = (
            "You are a clinical decision support assistant for HopeOS EHR. "
            "Provide helpful, accurate medical information while always "
            "recommending consultation with qualified healthcare providers "
            "for diagnosis and treatment decisions. Be concise and professional."
        )

        sys_content = system_prompt or default_system
        combined_prompt = f"{sys_content}\n\n{prompt}"
        messages = [{"role": "user", "content": combined_prompt}]

        try:
            async with self._async_client.stream("POST", "/api/chat", json={
                "model": OLLAMA_MODEL,
                "messages": messages,
                "stream": True,
                "options": {
                    "num_predict": max_tokens,
                    "temperature": temperature,
                },
            }) as resp:
                async for line in resp.aiter_lines():
                    if line:
                        data = json.loads(line)
                        content = data.get("message", {}).get("content", "")
                        if content:
                            yield content
                        if data.get("done"):
                            break
        except Exception as e:
            yield f"Error: {str(e)}"

    def analyze_symptoms(self, symptoms: List[str], patient_info: dict = None) -> str:
        """Analyze symptoms and suggest possible conditions."""
        patient_context = ""
        if patient_info:
            age = patient_info.get("age", "unknown")
            gender = patient_info.get("gender", "unknown")
            patient_context = f"Patient: {age} year old {gender}. "

        symptom_list = ", ".join(symptoms)
        prompt = f"""
{patient_context}
Presenting symptoms: {symptom_list}

Based on these symptoms, provide:
1. Possible differential diagnoses (most likely first)
2. Recommended examinations or tests
3. Red flags to watch for
4. General management suggestions

Note: This is for clinical decision support only. Final diagnosis requires proper clinical evaluation.
"""
        return self.generate(prompt, max_tokens=800)

    def analyze_lab_results(self, results: dict, reference_ranges: dict = None) -> str:
        """Analyze laboratory results."""
        results_text = "\n".join([f"- {k}: {v}" for k, v in results.items()])

        prompt = f"""
Laboratory Results:
{results_text}

Provide:
1. Which values are abnormal and their clinical significance
2. Possible conditions these results might indicate
3. Recommended follow-up tests if needed
4. Clinical considerations
"""
        return self.generate(prompt, max_tokens=600)

    def analyze_medical_image(self, image_base64: str, image_type: str = "X-ray") -> str:
        """Analyze a medical image (requires multimodal model)."""
        if not self.is_multimodal:
            return "Image analysis requires multimodal model. Please ensure mmproj is loaded."

        prompt = f"""
Analyze this {image_type} image. Describe:
1. Key findings and observations
2. Any abnormalities detected
3. Suggested clinical correlation
4. Recommendations for follow-up

Note: AI analysis is for decision support only. Definitive interpretation requires qualified radiologist.
"""
        return self.generate(prompt, image_base64=image_base64, max_tokens=800)

    def suggest_treatment(self, diagnosis: str, patient_info: dict = None) -> str:
        """Suggest treatment options for a diagnosis."""
        patient_context = ""
        if patient_info:
            age = patient_info.get("age", "unknown")
            gender = patient_info.get("gender", "unknown")
            allergies = patient_info.get("allergies", [])
            patient_context = f"Patient: {age} year old {gender}. "
            if allergies:
                patient_context += f"Known allergies: {', '.join(allergies)}. "

        prompt = f"""
{patient_context}
Diagnosis: {diagnosis}

Provide evidence-based treatment recommendations:
1. First-line treatment options
2. Alternative treatments if first-line is contraindicated
3. Supportive care measures
4. Follow-up recommendations
5. Patient education points

Note: Final treatment decisions must be made by the treating physician.
"""
        return self.generate(prompt, max_tokens=800)

    def generate_patient_summary(self, patient_data: Dict[str, Any]) -> str:
        """Generate a concise clinical summary of patient history for physicians.

        Args:
            patient_data: Dictionary containing patient demographics, vitals,
                         medications, lab results, diagnoses, and encounters.

        Returns:
            A structured clinical summary in markdown format.
        """
        # Extract patient demographics
        patient = patient_data.get("patient", {})
        name = patient.get("name", "Unknown")
        age = patient.get("age", "Unknown")
        gender = patient.get("gender", "Unknown")

        # Extract clinical data
        vitals = patient_data.get("vitals", [])
        medications = patient_data.get("medications", [])
        lab_results = patient_data.get("labResults", [])
        diagnoses = patient_data.get("diagnoses", [])
        encounters = patient_data.get("encounters", [])
        allergies = patient_data.get("allergies", [])

        # Format vitals (last 5)
        vitals_text = "None recorded"
        if vitals:
            recent_vitals = vitals[:5]
            vitals_text = "\n".join([
                f"- {v.get('display', v.get('name', 'Unknown'))}: {v.get('value', 'N/A')} {v.get('unit', '')}"
                for v in recent_vitals
            ])

        # Format medications
        meds_text = "None"
        if medications:
            meds_text = "\n".join([
                f"- {m.get('drugName', m.get('name', 'Unknown'))}: {m.get('dosage', '')} {m.get('frequency', '')}"
                for m in medications[:10]
            ])

        # Format lab results (last 5)
        labs_text = "None"
        if lab_results:
            recent_labs = lab_results[:5]
            labs_text = "\n".join([
                f"- {l.get('testType', l.get('name', 'Unknown'))}: {l.get('resultValue', l.get('value', 'Pending'))} {l.get('resultUnit', l.get('unit', ''))}"
                for l in recent_labs
            ])

        # Format diagnoses
        dx_text = "None documented"
        if diagnoses:
            dx_text = "\n".join([
                f"- {d.get('conditionText', d.get('name', 'Unknown'))} ({d.get('certainty', 'presumed')})"
                for d in diagnoses[:10]
            ])

        # Format allergies
        allergies_text = "No known allergies"
        if allergies:
            allergies_text = ", ".join([
                a.get("allergen", a.get("name", "Unknown")) for a in allergies
            ])

        # Format recent encounters
        encounters_text = "None"
        if encounters:
            recent_encounters = encounters[:5]
            encounters_text = "\n".join([
                f"- {e.get('encounterType', {}).get('display', e.get('type', 'Visit'))}: {e.get('encounterDatetime', e.get('date', 'Unknown date'))}"
                for e in recent_encounters
            ])

        prompt = f"""
You are a clinical decision support AI. Generate a concise, actionable patient history summary for a physician reviewing this patient's chart.

PATIENT INFORMATION:
- Name: {name}
- Age: {age}
- Gender: {gender}
- Allergies: {allergies_text}

RECENT VITAL SIGNS:
{vitals_text}

CURRENT MEDICATIONS:
{meds_text}

RECENT LAB RESULTS:
{labs_text}

DIAGNOSES/CONDITIONS:
{dx_text}

RECENT ENCOUNTERS:
{encounters_text}

Generate a clinical summary with these sections (use markdown formatting):

## Clinical Summary
A 2-3 sentence overview highlighting the most important clinical information.

## Key Concerns
Bullet points of items requiring physician attention (abnormal values, drug interactions, gaps in care, etc.)

## Active Problems
List of current conditions being managed.

## Recent Trends
Notable changes or patterns in vitals, labs, or symptoms.

Keep it concise - physicians need quick insights, not lengthy narratives.
"""

        system_prompt = (
            "You are a clinical decision support AI assistant. "
            "Generate concise, actionable summaries for busy physicians. "
            "Use clinical terminology appropriately. "
            "Always highlight critical findings and safety concerns first."
        )

        return self.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            max_tokens=800,
            temperature=0.3,  # Lower temperature for more consistent clinical output
        )

    # Path to llama-mtmd-cli for native vision
    LLAMA_MTMD_CLI = os.getenv("LLAMA_MTMD_CLI", "/opt/homebrew/bin/llama-mtmd-cli")

    def _extract_with_vision(self, image_base64: str) -> Dict[str, Any]:
        """Extract patient data using Tesseract OCR + Gemma text parsing.

        Two-stage pipeline:
        1. Tesseract OCR extracts text from image
        2. Gemma parses the text into structured JSON

        Args:
            image_base64: Base64-encoded image

        Returns:
            Dictionary with extracted data or error
        """
        import pytesseract
        from PIL import Image
        import io

        # Stage 1: OCR with Tesseract
        try:
            print("[DEBUG] Stage 1: Running Tesseract OCR...")
            image_data = base64.b64decode(image_base64)
            image = Image.open(io.BytesIO(image_data))

            # OCR configuration for medical documents
            custom_config = r'--oem 3 --psm 6'
            ocr_text = pytesseract.image_to_string(image, config=custom_config)
            print(f"[DEBUG] OCR extracted {len(ocr_text)} characters")
        except Exception as e:
            print(f"[DEBUG] OCR failed: {e}")
            return {"success": False, "error": f"OCR failed: {e}"}

        # Stage 2: Parse with Gemma
        print("[DEBUG] Stage 2: Parsing text with Gemma...")
        prompt = f'''Parse this Ghanaian medical document and extract patient information.

DOCUMENT TEXT:
{ocr_text}

IMPORTANT - Ghanaian Name Parsing Rules:
- Names may be in format "SURNAME Given-name" (e.g., "MENSAH Kwame" means first_name=Kwame, last_name=Mensah)
- Names may be in format "Given-name SURNAME" (e.g., "Kwame MENSAH" means first_name=Kwame, last_name=Mensah)
- If name has 2 parts: first part is first_name, second part is last_name
- If name has 3+ parts: first is first_name, last is last_name, middle parts are middle_name
- Surnames are often ALL CAPS or the longer/family name
- Common Ghanaian surnames: Mensah, Asante, Osei, Aboagye, Owusu, Adjei, Agyeman, Boateng, etc.

Extract these fields (use empty string if not found):
- first_name: Patient's given/personal name (NOT surname, NOT hospital name)
- middle_name: Any middle names or initials
- last_name: Patient's surname/family name (REQUIRED - must not be empty if name is found)
- birthdate: From "DOB:" or "Date of Birth:" field
- gender: male or female
- phone_number: Patient's phone/mobile number
- ghana_card_number: GHA-XXXXXXXXX-X format
- nhis_number: National Health Insurance number
- community, city, region: Address fields
- emergency_contact: Name and phone of emergency contact
- diagnoses: List from Assessment/Diagnosis section
- medications: List from Plan/Medications section
- blood_pressure, pulse, temperature, weight, height: From Vitals section

Return ONLY valid JSON:
{{"first_name":"","middle_name":"","last_name":"","birthdate":"","gender":"","phone_number":"","ghana_card_number":"","nhis_number":"","community":"","city":"","region":"","emergency_contact":"","diagnoses":[],"medications":[],"blood_pressure":"","pulse":"","temperature":"","weight":"","height":""}}'''

        return self._extract_with_llama_server_text(ocr_text, prompt)

    def _extract_with_llama_server_text(self, ocr_text: str, prompt: str) -> Dict[str, Any]:
        """Parse OCR text using preloaded text model (no llama-server needed)."""
        try:
            print("[DEBUG] Parsing OCR text with Gemma...")
            output = self._generate_text_only(prompt, max_tokens=800, temperature=0.3)
            print(f"[DEBUG] Model output ({len(output)} chars): {output[:200]}")
            return self._parse_vision_output(output)
        except Exception as e:
            print(f"[DEBUG] Text parsing error: {e}")
            return {"success": False, "error": str(e)}

    def _extract_with_llama_server(self, image_base64: str, prompt: str) -> Dict[str, Any]:
        """Extract using llama-server API with vision (model preloaded, thinking disabled)."""
        import requests

        LLAMA_SERVER_URL = os.getenv("LLAMA_SERVER_URL", "http://127.0.0.1:8081")

        try:
            print("[DEBUG] Calling llama-server for vision extraction...")
            data_uri = f"data:image/png;base64,{image_base64}"

            response = requests.post(
                f"{LLAMA_SERVER_URL}/v1/chat/completions",
                json={
                    "model": "gemma-4",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "image_url", "image_url": {"url": data_uri}},
                                {"type": "text", "text": prompt}
                            ]
                        }
                    ],
                    "max_tokens": 600,
                    "temperature": 1.0
                },
                timeout=120
            )

            result = response.json()
            output = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            print(f"[DEBUG] llama-server output ({len(output)} chars): {output[:200]}")

            return self._parse_vision_output(output)

        except requests.exceptions.ConnectionError:
            print("[DEBUG] llama-server not running, falling back to subprocess...")
            return self._extract_with_subprocess(image_base64, prompt)
        except Exception as e:
            print(f"[DEBUG] llama-server error: {e}")
            return {"success": False, "error": str(e)}

    def _extract_with_preloaded_model(self, image_base64: str, prompt: str) -> Dict[str, Any]:
        """Extract using the preloaded multimodal model (fast)."""
        try:
            print("[DEBUG] Using preloaded multimodal model for vision extraction...")

            # Create data URI for the image
            data_uri = f"data:image/png;base64,{image_base64}"

            # Build messages with image
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_uri}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ]

            # Generate response using preloaded model
            # Gemma 4 recommended settings: temp=1.0, top_p=0.95, top_k=64
            response = self._llm.create_chat_completion(
                messages=messages,
                max_tokens=2000,
                temperature=1.0,
                top_p=0.95,
                top_k=64,
            )

            output = response["choices"][0]["message"]["content"].strip()
            print(f"[DEBUG] Vision output ({len(output)} chars):")
            print(f"[DEBUG] Raw output: {output[:500]}")  # Print first 500 chars

            return self._parse_vision_output(output)

        except Exception as e:
            print(f"[DEBUG] Preloaded model extraction failed: {e}")
            return {"success": False, "error": f"Vision extraction error: {e}"}

    def _extract_with_subprocess(self, image_base64: str, prompt: str) -> Dict[str, Any]:
        """Fallback: Extract using subprocess (slow - loads model each time)."""
        # Check if CLI exists
        if not os.path.exists(self.LLAMA_MTMD_CLI):
            return {
                "success": False,
                "error": f"llama-mtmd-cli not found at {self.LLAMA_MTMD_CLI}"
            }

        # Save image to temp file
        try:
            image_data = base64.b64decode(image_base64)
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                tmp.write(image_data)
                tmp_path = tmp.name
        except Exception as e:
            return {"success": False, "error": f"Failed to decode image: {e}"}

        try:
            print(f"[DEBUG] Running llama-mtmd-cli vision extraction...")
            result = subprocess.run(
                [
                    self.LLAMA_MTMD_CLI,
                    "-m", str(self.MODEL_PATH),
                    "--mmproj", str(self.MMPROJ_PATH),
                    "--image", tmp_path,
                    "-p", prompt,
                    "-n", "500",  # Shorter output for JSON
                    "--temp", "1.0",  # Gemma 4 recommended
                    "--top-p", "0.95",
                    "--top-k", "64",
                    "--jinja",
                ],
                capture_output=True,
                text=True,
                timeout=120,
            )

            os.unlink(tmp_path)

            if result.returncode != 0:
                print(f"[DEBUG] CLI error: {result.stderr}")
                return {"success": False, "error": f"Vision extraction failed: {result.stderr}"}

            output = result.stdout.strip()
            print(f"[DEBUG] Raw vision output ({len(output)} chars)")
            return self._parse_vision_output(output)

        except subprocess.TimeoutExpired:
            os.unlink(tmp_path)
            return {"success": False, "error": "Vision extraction timed out"}
        except Exception as e:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            return {"success": False, "error": f"Vision extraction error: {e}"}

    def _parse_vision_output(self, output: str) -> Dict[str, Any]:
        """Parse JSON from vision model output."""
        # Extract JSON from output (may have thinking tags or other text)
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', output, re.DOTALL)
        if json_match:
            json_str = json_match.group()
            try:
                data = json.loads(json_str)
                data["success"] = True
                return data
            except json.JSONDecodeError:
                pass

        # Try to find JSON after any thinking/reasoning tags
        if "<|channel>" in output:
            parts = output.split("<|channel>")
            for part in reversed(parts):
                json_match = re.search(r'\{.*\}', part, re.DOTALL)
                if json_match:
                    try:
                        data = json.loads(json_match.group())
                        data["success"] = True
                        return data
                    except json.JSONDecodeError:
                        continue

        return {
            "success": False,
            "error": "Could not parse JSON from vision output",
            "raw_output": output[:2000]
        }

    def extract_patient_data_from_document(
        self,
        image_base64: str,
        document_type: str = "auto"
    ) -> Dict[str, Any]:
        """Extract patient data from a scanned document using Gemma 4 native vision.

        Uses single-stage pipeline with Gemma 4 multimodal vision - no OCR needed.

        Args:
            image_base64: Base64-encoded image of the document
            document_type: Type of document - "ghana_card", "paper_record", or "auto" (detect)

        Returns:
            Dictionary with FHIR Patient resource and confidence scores
        """
        print("[DEBUG] Extracting patient data with Gemma 4 native vision...")

        # Use native vision extraction
        vision_result = self._extract_with_vision(image_base64)

        if not vision_result.get("success"):
            return vision_result

        # Convert vision output to FHIR-compatible format
        try:
            result = {
                "success": True,
                "document_type": vision_result.get("document_type", "unknown"),
                "overall_confidence": vision_result.get("overall_confidence", 0.8),
                "fhir_patient": self._vision_to_fhir(vision_result),
                "extracted_data": self._vision_to_legacy(vision_result),
            }

            # Add diagnoses/conditions (UI expects "medical_conditions")
            diagnoses = vision_result.get("diagnoses") or vision_result.get("medical_conditions") or []
            if diagnoses:
                result["extracted_conditions"] = {
                    "medical_conditions": diagnoses,
                    "allergies": vision_result.get("allergies", []),
                    "_confidence": 0.8
                }
                result["extracted_data"]["medical_conditions"] = {
                    "value": diagnoses,
                    "confidence": 0.8
                }

            # Add allergies if present
            if vision_result.get("allergies"):
                result["extracted_data"]["allergies"] = {
                    "value": vision_result["allergies"],
                    "confidence": 0.8
                }

            # Add vitals
            vitals_keys = ["blood_pressure", "pulse", "temperature", "weight", "height", "spo2"]
            for key in vitals_keys:
                if vision_result.get(key):
                    result["extracted_data"][key] = {
                        "value": vision_result[key],
                        "confidence": 0.8
                    }

            # Add medications (UI expects "current_medications")
            medications = vision_result.get("medications") or vision_result.get("current_medications") or []
            if medications:
                result["extracted_data"]["current_medications"] = {
                    "value": medications,
                    "confidence": 0.8
                }

            return result

        except Exception as e:
            print(f"[DEBUG] Error converting vision result: {e}")
            return {
                "success": False,
                "error": f"Failed to process vision result: {e}",
                "raw_result": vision_result
            }

    def _vision_to_fhir(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert vision extraction result to FHIR Patient format."""
        fhir = {
            "resourceType": "Patient",
            "identifier": [],
            "name": [],
            "telecom": [],
            "address": [],
            "contact": [],
        }

        # Identifiers
        if data.get("ghana_card_number"):
            fhir["identifier"].append({
                "system": "urn:ghana:nia",
                "value": data["ghana_card_number"],
                "_confidence": 0.9
            })
        if data.get("nhis_number"):
            fhir["identifier"].append({
                "system": "urn:ghana:nhis",
                "value": data["nhis_number"],
                "_confidence": 0.9
            })

        # Name
        given = []
        if data.get("first_name"):
            given.append(data["first_name"])
        if data.get("middle_name"):
            given.append(data["middle_name"])
        if given or data.get("last_name"):
            fhir["name"].append({
                "use": "official",
                "family": data.get("last_name"),
                "given": given,
                "_confidence": 0.9
            })

        # Gender
        if data.get("gender"):
            fhir["gender"] = data["gender"].lower()
            fhir["_gender_confidence"] = 0.9

        # Birth date
        if data.get("birthdate"):
            fhir["birthDate"] = data["birthdate"]
            fhir["_birthDate_confidence"] = 0.9

        # Phone
        if data.get("phone_number"):
            fhir["telecom"].append({
                "system": "phone",
                "value": data["phone_number"],
                "_confidence": 0.9
            })

        # Address
        if any(data.get(k) for k in ["community", "city", "region"]):
            fhir["address"].append({
                "use": "home",
                "district": data.get("community"),
                "city": data.get("city"),
                "state": data.get("region"),
                "_confidence": 0.8
            })

        # Emergency contact
        if data.get("emergency_contact"):
            contact_str = data["emergency_contact"]
            parts = contact_str.split(" - ") if " - " in contact_str else [contact_str]
            fhir["contact"].append({
                "relationship": [{"text": "emergency"}],
                "name": {"text": parts[0] if parts else None},
                "telecom": [{"system": "phone", "value": parts[1] if len(parts) > 1 else None}],
                "_confidence": 0.8
            })

        return fhir

    def _vision_to_legacy(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert vision extraction result to legacy extracted_data format."""
        legacy = {}

        field_mapping = {
            "first_name": "first_name",
            "middle_name": "middle_name",
            "last_name": "last_name",
            "gender": "gender",
            "birthdate": "birthdate",
            "phone_number": "phone_number",
            "ghana_card_number": "ghana_card_number",
            "nhis_number": "nhis_number",
            "community": "community",
            "city": "city",
            "region": "region",
            "emergency_contact": "emergency_contact",
        }

        for src, dst in field_mapping.items():
            if data.get(src):
                legacy[dst] = {
                    "value": data[src],
                    "confidence": 0.9
                }

        return legacy

    def extract_patient_data_from_document_legacy(
        self,
        image_base64: str,
        document_type: str = "auto"
    ) -> Dict[str, Any]:
        """Legacy extraction using text model (kept for fallback).

        This method is kept as a fallback if vision extraction fails.
        """
        if not self.model_loaded:
            if not self.load_model():
                return {"error": "AI model not available", "success": False}

        # Use the generate method with the image for multimodal
        prompt = """Extract all patient information from this medical document. Output as valid JSON."""

        system_prompt = (
            "You are a FHIR document extraction specialist for Ghanaian healthcare. "
            "Extract patient data from identity documents and medical records into valid FHIR R4 Patient resources. "
            "Be precise with names, dates, and ID numbers. "
            "Output only valid JSON with no additional text or formatting."
        )

        try:
            response = self.generate(
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=2500,
                temperature=0.1,
                image_base64=image_base64,
            )

            # Handle None or empty response
            if not response:
                return {
                    "success": False,
                    "error": "AI model returned empty response",
                    "raw_response": None
                }

            print(f"[DEBUG] Raw AI response ({len(response)} chars):")
            print(response[:500] + "..." if len(response) > 500 else response)

            # Parse JSON from response
            cleaned = response.strip()
            # Remove markdown code blocks if present
            if cleaned.startswith("```"):
                cleaned = re.sub(r'^```(?:json)?\n?', '', cleaned)
                cleaned = re.sub(r'\n?```$', '', cleaned)

            # Try to fix common JSON issues
            # Handle truncated JSON - try to find valid JSON subset
            result = None
            try:
                result = json.loads(cleaned)
            except json.JSONDecodeError:
                # Try to extract valid JSON object
                json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
                if json_match:
                    # Try progressively shorter substrings to find valid JSON
                    potential_json = json_match.group()
                    for i in range(len(potential_json), 0, -10):
                        try:
                            # Try to complete truncated JSON by closing braces
                            truncated = potential_json[:i]
                            # Count open braces and brackets
                            open_braces = truncated.count('{') - truncated.count('}')
                            open_brackets = truncated.count('[') - truncated.count(']')
                            # Close any open brackets/braces
                            completed = truncated + ']' * open_brackets + '}' * open_braces
                            result = json.loads(completed)
                            print(f"[DEBUG] Recovered JSON by completing {open_braces} braces, {open_brackets} brackets")
                            break
                        except json.JSONDecodeError:
                            continue
                    if result is None:
                        raise json.JSONDecodeError("Could not recover valid JSON", cleaned, 0)
                else:
                    raise

            # Validate result is a dict
            if not isinstance(result, dict):
                return {
                    "success": False,
                    "error": f"AI returned non-object JSON: {type(result).__name__}",
                    "raw_response": response[:2000]
                }

            result["success"] = True

            # Also provide legacy format for backward compatibility
            # Initialize extracted_data first (will be populated below)
            result["extracted_data"] = {}

            fhir_patient = result.get("fhir_patient")
            if fhir_patient and isinstance(fhir_patient, dict):
                result["extracted_data"] = self._fhir_to_legacy_format(fhir_patient)

            # Add medical conditions and allergies from extracted_conditions
            # Note: Use `or {}` to handle both missing keys AND explicit None values
            extracted_conditions = result.get("extracted_conditions") or {}
            if isinstance(extracted_conditions, dict):
                conditions_conf = extracted_conditions.get("_confidence", 0.8)
                if extracted_conditions.get("medical_conditions"):
                    result["extracted_data"]["medical_conditions"] = {
                        "value": extracted_conditions["medical_conditions"],
                        "confidence": conditions_conf
                    }
                if extracted_conditions.get("allergies"):
                    result["extracted_data"]["allergies"] = {
                        "value": extracted_conditions["allergies"],
                        "confidence": conditions_conf
                    }

            # Add vitals from extracted_vitals
            # Note: Use `or {}` to handle both missing keys AND explicit None values
            extracted_vitals = result.get("extracted_vitals") or {}
            if isinstance(extracted_vitals, dict):
                for vital_key in ["blood_pressure", "pulse", "temperature", "weight", "height", "spo2"]:
                    vital_data = extracted_vitals.get(vital_key)
                    if vital_data and isinstance(vital_data, dict):
                        conf = vital_data.get("_confidence", 0.8)
                        if vital_key == "blood_pressure":
                            systolic = vital_data.get("systolic")
                            diastolic = vital_data.get("diastolic")
                            if systolic and diastolic:
                                result["extracted_data"]["blood_pressure"] = {
                                    "value": f"{systolic}/{diastolic}",
                                    "confidence": conf
                                }
                        elif vital_data.get("value") is not None:
                            unit = vital_data.get("unit", "")
                            result["extracted_data"][vital_key] = {
                                "value": f"{vital_data['value']} {unit}".strip(),
                                "confidence": conf
                            }

            # Add medications from extracted_medications
            # Note: Use `or []` to handle both missing keys AND explicit None values
            extracted_meds = result.get("extracted_medications") or []
            if isinstance(extracted_meds, list):
                meds_list = []
                avg_conf = 0.8
                for med in extracted_meds:
                    if isinstance(med, dict) and med.get("name"):
                        med_str = med["name"]
                        if med.get("dosage"):
                            med_str += f" {med['dosage']}"
                        if med.get("frequency"):
                            med_str += f" ({med['frequency']})"
                        meds_list.append(med_str)
                        if med.get("_confidence"):
                            avg_conf = med["_confidence"]
                if meds_list:
                    result["extracted_data"]["current_medications"] = {
                        "value": meds_list,
                        "confidence": avg_conf
                    }

            return result

        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"Failed to parse extraction result: {str(e)}",
                "raw_response": response[:2000] if 'response' in locals() else None
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Document extraction failed: {str(e)}",
            }

    def _fhir_to_legacy_format(self, fhir_patient: Dict[str, Any]) -> Dict[str, Any]:
        """Convert FHIR Patient to legacy extracted_data format for UI compatibility.

        Handles truncated/incomplete FHIR data gracefully by checking types at each level.
        """
        legacy = {}

        try:
            # Name - handle truncated data with defensive checks
            names = fhir_patient.get("name")
            if names and isinstance(names, list) and len(names) > 0:
                name = names[0]
                if isinstance(name, dict):
                    given = name.get("given") or []
                    conf = name.get("_confidence", 0.8)
                    if isinstance(given, list) and len(given) > 0:
                        legacy["first_name"] = {"value": str(given[0]), "confidence": conf}
                        if len(given) > 1:
                            legacy["middle_name"] = {"value": str(given[1]), "confidence": conf}
                    if name.get("family"):
                        legacy["last_name"] = {"value": str(name["family"]), "confidence": conf}

            # Gender
            if fhir_patient.get("gender"):
                legacy["gender"] = {
                    "value": str(fhir_patient["gender"]),
                    "confidence": fhir_patient.get("_gender_confidence", 0.8)
                }

            # Birth date
            if fhir_patient.get("birthDate"):
                legacy["birthdate"] = {
                    "value": str(fhir_patient["birthDate"]),
                    "confidence": fhir_patient.get("_birthDate_confidence", 0.8)
                }

            # Identifiers - handle truncated data
            identifiers = fhir_patient.get("identifier") or []
            if isinstance(identifiers, list):
                for ident in identifiers:
                    if not isinstance(ident, dict):
                        continue
                    conf = ident.get("_confidence", 0.8)
                    system = ident.get("system", "")
                    value = ident.get("value")
                    if value:
                        if "nia" in str(system).lower() or "ghana" in str(system).lower():
                            legacy["ghana_card_number"] = {"value": str(value), "confidence": conf}
                        elif "nhis" in str(system).lower():
                            legacy["nhis_number"] = {"value": str(value), "confidence": conf}

            # Phone - handle truncated data
            telecom = fhir_patient.get("telecom") or []
            if isinstance(telecom, list):
                for tel in telecom:
                    if isinstance(tel, dict) and tel.get("system") == "phone" and tel.get("value"):
                        legacy["phone_number"] = {
                            "value": str(tel["value"]),
                            "confidence": tel.get("_confidence", 0.8)
                        }
                        break

            # Address - handle truncated data
            addresses = fhir_patient.get("address")
            if addresses and isinstance(addresses, list) and len(addresses) > 0:
                addr = addresses[0]
                if isinstance(addr, dict):
                    conf = addr.get("_confidence", 0.8)
                    if addr.get("city"):
                        legacy["city"] = {"value": str(addr["city"]), "confidence": conf}
                    if addr.get("district"):
                        legacy["community"] = {"value": str(addr["district"]), "confidence": conf}
                    if addr.get("state"):
                        legacy["region"] = {"value": str(addr["state"]), "confidence": conf}
                    if addr.get("text"):
                        legacy["address"] = {"value": str(addr["text"]), "confidence": conf}

            # Emergency contact - handle truncated data
            contacts = fhir_patient.get("contact")
            if contacts and isinstance(contacts, list) and len(contacts) > 0:
                contact = contacts[0]
                if isinstance(contact, dict):
                    conf = contact.get("_confidence", 0.8)
                    contact_info = []
                    contact_name = contact.get("name")
                    if isinstance(contact_name, dict) and contact_name.get("text"):
                        contact_info.append(str(contact_name["text"]))
                    contact_telecom = contact.get("telecom")
                    if isinstance(contact_telecom, list):
                        for tel in contact_telecom:
                            if isinstance(tel, dict) and tel.get("value"):
                                contact_info.append(str(tel["value"]))
                    if contact_info:
                        legacy["emergency_contact"] = {
                            "value": " - ".join(contact_info),
                            "confidence": conf
                        }

        except Exception as e:
            # Log but don't fail - return whatever we've extracted so far
            print(f"[DEBUG] Error in _fhir_to_legacy_format: {e}")

        return legacy

    # Database schema context for analytics queries
    DATABASE_SCHEMA = """
Database Schema for HopeOS EHR System:

TABLES:
1. patients - Patient demographics
   - id (UUID, PK), identifier (unique string), first_name, middle_name, last_name
   - gender (male/female), birthdate (date), phone_number, email
   - city, state, country, community, occupation, marital_status
   - ghana_card_number, nhis_number, active (boolean), deceased (boolean)
   - created_at, updated_at

2. users - Staff/practitioners
   - id (UUID, PK), username (unique), email, display_name
   - role (admin/doctor/nurse/registrar/pharmacy/lab), active (boolean)
   - created_at, updated_at

3. visits - Patient visits (ambulatory encounters)
   - id (UUID, PK), patient_id (FK), visit_type, location
   - start_datetime, stop_datetime, status (planned/in-progress/finished)
   - created_by (FK users), created_at, updated_at

4. encounters - Clinical encounters within visits
   - id (UUID, PK), patient_id (FK), visit_id (FK), provider_id (FK users)
   - encounter_type (Consultation/Vitals/LabResult), encounter_datetime
   - location, notes (text), diagnosis (text)
   - created_at, updated_at

5. observations - Vitals and lab results
   - id (UUID, PK), patient_id (FK), encounter_id (FK), visit_id (FK)
   - concept_type (vital_signs/lab_result), concept_code, concept_display
   - value_type (numeric/text/coded), value_numeric (decimal), value_text, unit
   - obs_datetime, created_by (FK users), created_at

6. diagnoses - Patient conditions/diagnoses
   - id (UUID, PK), patient_id (FK), encounter_id (FK)
   - condition_text, condition_code (ICD-10), certainty (presumed/confirmed)
   - rank (1=primary), diagnosed_by (FK users), diagnosed_date
   - created_at, updated_at

7. medications - Prescriptions
   - id (UUID, PK), patient_id (FK), encounter_id (FK)
   - drug_name, drug_code, dosage, dosage_unit, frequency, route
   - duration, duration_unit, quantity, instructions
   - prescribed_by (FK users), prescribed_date, status (active/completed/stopped)
   - created_at, updated_at

8. pharmacy_orders - Medication dispensing
   - id (UUID, PK), patient_id (FK), medication_id (FK)
   - drug_name, dosage, quantity, ordered_date
   - status (pending/dispensed/cancelled)
   - prescribed_by (FK users), dispensed_by (FK users), dispensed_at
   - created_at, updated_at

9. lab_orders - Laboratory test orders
   - id (UUID, PK), patient_id (FK), test_type, test_code
   - ordered_date, priority (routine/urgent/stat)
   - status (pending/in-progress/completed/cancelled)
   - result_value, result_unit, result_interpretation (normal/abnormal/critical)
   - ordered_by (FK users), completed_by (FK users), completed_at
   - created_at, updated_at

COMMON QUERY PATTERNS:
- Date filtering: WHERE created_at >= '2024-01-01' or DATE(created_at) = '2024-01-15'
- Status filtering: WHERE status = 'completed'
- Aggregations: COUNT(*), SUM(), AVG(), GROUP BY
- Joins: patients JOIN visits ON patients.id = visits.patient_id
"""

    def generate_analytics_query(self, question: str) -> Dict[str, Any]:
        """Generate SQL query and chart config from natural language question.

        Returns dict with:
        - sql: The SQL query to execute
        - chart: Chart configuration for visualization
        - explanation: Brief explanation of the query
        """
        if not self.model_loaded:
            if not self.load_model():
                return {"error": "AI model not available"}

        prompt = f"""{self.DATABASE_SCHEMA}

USER QUESTION: {question}

Generate a response in valid JSON format with these fields:
1. "sql": A safe, read-only SQL query (SELECT only, no INSERT/UPDATE/DELETE/DROP)
2. "chart": Chart configuration object with:
   - "type": one of "bar", "line", "pie", "area", "table"
   - "title": descriptive chart title
   - "xKey": column name for x-axis (for bar/line/area)
   - "yKey": column name for y-axis (for bar/line/area)
   - "nameKey": column name for labels (for pie)
   - "valueKey": column name for values (for pie)
3. "explanation": One sentence explaining what the query does

Important rules:
- Use only SELECT statements
- Always alias aggregated columns (e.g., COUNT(*) as count)
- Use proper JOINs when referencing multiple tables
- For date ranges, use created_at or appropriate date columns
- Limit results to 100 rows max for performance

Respond ONLY with valid JSON, no markdown, no explanation outside JSON:
"""

        system_prompt = (
            "You are a SQL expert for healthcare analytics. "
            "Generate safe, read-only SQL queries and chart configurations. "
            "Respond ONLY with valid JSON. Never include markdown code blocks."
        )

        try:
            response = self.generate(
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=1000,
                temperature=0.3,  # Lower temperature for more consistent output
            )

            # Parse JSON from response
            # Clean up response - remove any markdown if present
            cleaned = response.strip()
            if cleaned.startswith("```"):
                # Remove markdown code blocks
                cleaned = re.sub(r'^```(?:json)?\n?', '', cleaned)
                cleaned = re.sub(r'\n?```$', '', cleaned)

            result = json.loads(cleaned)

            # Validate SQL is safe
            sql = result.get("sql", "")
            if not self._validate_sql_safety(sql):
                return {
                    "error": "Generated SQL contains unsafe operations",
                    "sql": sql
                }

            return result

        except json.JSONDecodeError as e:
            return {
                "error": f"Failed to parse AI response as JSON: {str(e)}",
                "raw_response": response
            }
        except Exception as e:
            return {"error": f"Error generating analytics query: {str(e)}"}

    def _validate_sql_safety(self, sql: str) -> bool:
        """Validate that SQL query is safe (read-only)."""
        if not sql:
            return False

        sql_upper = sql.upper().strip()

        # Must start with SELECT
        if not sql_upper.startswith("SELECT"):
            return False

        # Forbidden keywords
        dangerous_keywords = [
            "INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER",
            "CREATE", "REPLACE", "GRANT", "REVOKE", "EXEC", "EXECUTE",
            "INTO", "MERGE", "CALL"
        ]

        for keyword in dangerous_keywords:
            # Check for keyword as a whole word
            if re.search(rf'\b{keyword}\b', sql_upper):
                # Exception: "SELECT ... INTO" is dangerous, but we check INTO separately
                # Exception: "INSERT INTO" contains INTO but INSERT is already blocked
                return False

        # Check for multiple statements (semicolon followed by another statement)
        # Allow trailing semicolon but not multiple statements
        statements = [s.strip() for s in sql.split(";") if s.strip()]
        if len(statements) > 1:
            return False

        return True


# Singleton instance
ai_service = AIService.get_instance()
