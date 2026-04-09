"""Benchmark: Current prompt vs trimmed prompt for document extraction.

Usage:
  python scripts/benchmark-prompts.py [image_path]

Compares prompt sizes and Gemma response times without changing any production code.
"""

import sys
import os
import time
import json
import re
import base64
import httpx

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "hopeos-gemma4-iq2")

# ── Prompt A: Current (verbose) ──────────────────────────────────────────────
PROMPT_CURRENT = """Parse this Ghanaian medical document and extract patient information.

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
{{"first_name":"","middle_name":"","last_name":"","birthdate":"","gender":"","phone_number":"","ghana_card_number":"","nhis_number":"","community":"","city":"","region":"","emergency_contact":"","diagnoses":[],"medications":[],"blood_pressure":"","pulse":"","temperature":"","weight":"","height":""}}"""

# ── Prompt B: Trimmed ────────────────────────────────────────────────────────
PROMPT_TRIMMED = """Extract patient info from this document. Return ONLY valid JSON.

TEXT:
{ocr_text}

JSON format:
{{"first_name":"","last_name":"","middle_name":"","birthdate":"","gender":"","phone_number":"","ghana_card_number":"","nhis_number":"","community":"","city":"","region":"","emergency_contact":"","diagnoses":[],"medications":[]}}"""

# ── Prompt C: Minimal ────────────────────────────────────────────────────────
PROMPT_MINIMAL = """Extract patient data as JSON from this text:
{ocr_text}

Return: {{"first_name":"","last_name":"","birthdate":"","gender":"","phone_number":"","ghana_card_number":"","diagnoses":[]}}"""


def get_ocr_text(image_path: str) -> str:
    """Run Tesseract OCR on image."""
    import pytesseract
    from PIL import Image

    img = Image.open(image_path)
    max_dim = 1500
    if max(img.size) > max_dim:
        ratio = max_dim / max(img.size)
        img = img.resize((int(img.width * ratio), int(img.height * ratio)))
    return pytesseract.image_to_string(img, config="--oem 3 --psm 6")


def run_prompt(name: str, prompt: str, ocr_text: str) -> dict:
    """Send a prompt to Gemma and measure response."""
    filled = prompt.format(ocr_text=ocr_text)
    prompt_tokens_est = len(filled.split())  # rough estimate

    print(f"\n{'=' * 50}")
    print(f"Prompt: {name}")
    print(f"Prompt length: {len(filled)} chars (~{prompt_tokens_est} tokens est.)")
    print(f"{'=' * 50}")

    t0 = time.time()
    try:
        client = httpx.Client(base_url=OLLAMA_BASE_URL, timeout=300.0)
        resp = client.post("/api/chat", json={
            "model": OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": "You are a document parser. Return ONLY valid JSON, no markdown."},
                {"role": "user", "content": filled},
            ],
            "stream": False,
            "options": {"num_predict": 1500, "temperature": 0.1},
        })
        resp.raise_for_status()
        data = resp.json()
        output = data.get("message", {}).get("content", "").strip()
        t1 = time.time()

        # Parse JSON
        cleaned = re.sub(r'^```(?:json)?\s*', '', output)
        cleaned = re.sub(r'\s*```\s*$', '', cleaned)
        parse_ok = False
        fields_found = 0
        try:
            parsed = json.loads(cleaned)
            parse_ok = True
            fields_found = len([v for v in parsed.values() if v and v != [] and v != ""])
        except json.JSONDecodeError:
            # Try to find JSON in output
            match = re.search(r'\{.*\}', cleaned, re.DOTALL)
            if match:
                try:
                    parsed = json.loads(match.group())
                    parse_ok = True
                    fields_found = len([v for v in parsed.values() if v and v != [] and v != ""])
                except json.JSONDecodeError:
                    pass

        result = {
            "name": name,
            "prompt_chars": len(filled),
            "prompt_tokens_est": prompt_tokens_est,
            "time_s": round(t1 - t0, 2),
            "output_chars": len(output),
            "parse_ok": parse_ok,
            "fields_found": fields_found,
            "output_preview": output[:400],
        }

        print(f"  Time: {t1 - t0:.2f}s")
        print(f"  Output: {len(output)} chars")
        print(f"  JSON parse: {'OK' if parse_ok else 'FAILED'}, {fields_found} fields")
        print(f"  Preview: {output[:200]}")

        return result

    except Exception as e:
        t1 = time.time()
        print(f"  Error: {e}")
        return {
            "name": name,
            "prompt_chars": len(filled),
            "time_s": round(t1 - t0, 2),
            "error": str(e),
            "parse_ok": False,
            "fields_found": 0,
        }


def create_test_image():
    """Create a test image with realistic medical document text."""
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (800, 500), "white")
    draw = ImageDraw.Draw(img)

    text = """GHANA HEALTH SERVICE
DISTRICT HOSPITAL - PATIENT RECORD FORM

Patient Name: MENSAH Kwame Boateng
Date of Birth: 15/03/1985
Gender: Male
Ghana Card No: GHA-123456789-1
NHIS No: NHIS-2024-00456
Phone: 024-555-1234

Address: Madina, Greater Accra Region

Emergency Contact: Ama Mensah (Wife) - 024-555-5678

VITALS: BP 140/90, Pulse 78, Temp 37.2C, Weight 82kg

ASSESSMENT/DIAGNOSIS:
1. Essential Hypertension (I10)
2. Type 2 Diabetes Mellitus (E11.9)

PLAN/MEDICATIONS:
1. Metformin 500mg BD
2. Amlodipine 5mg OD
3. Lifestyle modifications"""

    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
    except Exception:
        font = ImageFont.load_default()

    draw.text((30, 20), text, fill="black", font=font)
    path = "/tmp/hopeos_test_medical_doc.png"
    img.save(path)
    print(f"Created test image: {path}")
    return path


def main():
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
    else:
        print("No image provided, creating test document...\n")
        image_path = create_test_image()

    if not os.path.exists(image_path):
        print(f"Error: {image_path} not found")
        sys.exit(1)

    # Check Ollama
    try:
        httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
    except Exception:
        print("Ollama not running!")
        sys.exit(1)

    # OCR once, reuse for all prompts
    print(f"Image: {image_path}")
    print(f"Model: {OLLAMA_MODEL}")
    print("\nRunning OCR...")
    ocr_text = get_ocr_text(image_path)
    print(f"OCR: {len(ocr_text)} chars")
    print(f"OCR preview: {ocr_text[:150]}...")

    # Run each prompt
    prompts = [
        ("A: Current (verbose)", PROMPT_CURRENT),
        ("B: Trimmed", PROMPT_TRIMMED),
        ("C: Minimal", PROMPT_MINIMAL),
    ]

    results = []
    for name, prompt in prompts:
        r = run_prompt(name, prompt, ocr_text)
        results.append(r)

    # Summary table
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print(f"{'=' * 70}")
    print(f"{'Prompt':<25} {'Chars':>8} {'Time':>8} {'JSON':>6} {'Fields':>7}")
    print("-" * 70)
    for r in results:
        print(f"{r['name']:<25} {r['prompt_chars']:>8} {r.get('time_s', '?'):>7}s {('OK' if r['parse_ok'] else 'FAIL'):>6} {r['fields_found']:>7}")

    # Speed comparison
    if all(r.get("time_s") for r in results):
        base = results[0]["time_s"]
        print(f"\nRelative to current:")
        for r in results:
            diff = r["time_s"] - base
            pct = ((r["time_s"] - base) / base) * 100 if base else 0
            print(f"  {r['name']}: {diff:+.1f}s ({pct:+.0f}%)")


if __name__ == "__main__":
    main()
