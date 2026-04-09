"""Benchmark: Ollama num_ctx and num_predict options for CPU speed.

Usage:
  python scripts/benchmark-options.py [image_path]

Tests different num_ctx / num_predict combos without changing production code.
"""

import sys
import os
import time
import json
import re
import httpx

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "hopeos-gemma4-iq2")

PROMPT = """Parse this Ghanaian medical document and extract patient information.

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

# Configurations to test: (name, num_ctx, num_predict)
CONFIGS = [
    ("Current (default)",    8192, 1500),
    ("ctx=4096 pred=1500",   4096, 1500),
    ("ctx=2048 pred=1500",   2048, 1500),
    ("ctx=2048 pred=500",    2048,  500),
    ("ctx=1024 pred=500",    1024,  500),
]


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


def run_config(name: str, ocr_text: str, num_ctx: int, num_predict: int) -> dict:
    """Send prompt with specific Ollama options and measure response."""
    filled = PROMPT.format(ocr_text=ocr_text)

    print(f"\n{'=' * 60}")
    print(f"Config: {name}  (num_ctx={num_ctx}, num_predict={num_predict})")
    print(f"{'=' * 60}")

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
            "options": {
                "num_ctx": num_ctx,
                "num_predict": num_predict,
                "temperature": 0.1,
            },
        })
        resp.raise_for_status()
        data = resp.json()
        output = data.get("message", {}).get("content", "").strip()
        t1 = time.time()

        # Get token stats from Ollama response
        eval_count = data.get("eval_count", 0)
        eval_duration = data.get("eval_duration", 0)
        prompt_eval_count = data.get("prompt_eval_count", 0)
        prompt_eval_duration = data.get("prompt_eval_duration", 0)

        tok_per_sec = (eval_count / (eval_duration / 1e9)) if eval_duration else 0
        prompt_tok_per_sec = (prompt_eval_count / (prompt_eval_duration / 1e9)) if prompt_eval_duration else 0

        # Parse JSON
        cleaned = re.sub(r'^```(?:json)?\s*', '', output)
        cleaned = re.sub(r'\s*```\s*$', '', cleaned)
        parse_ok = False
        fields_found = 0
        first_name = ""
        try:
            parsed = json.loads(cleaned)
            parse_ok = True
            fields_found = len([v for v in parsed.values() if v and v != [] and v != ""])
            first_name = parsed.get("first_name", "")
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', cleaned, re.DOTALL)
            if match:
                try:
                    parsed = json.loads(match.group())
                    parse_ok = True
                    fields_found = len([v for v in parsed.values() if v and v != [] and v != ""])
                    first_name = parsed.get("first_name", "")
                except json.JSONDecodeError:
                    pass

        result = {
            "name": name,
            "num_ctx": num_ctx,
            "num_predict": num_predict,
            "time_s": round(t1 - t0, 2),
            "parse_ok": parse_ok,
            "fields_found": fields_found,
            "first_name": first_name,
            "output_chars": len(output),
            "eval_tokens": eval_count,
            "tok_per_sec": round(tok_per_sec, 1),
            "prompt_tokens": prompt_eval_count,
            "prompt_tok_per_sec": round(prompt_tok_per_sec, 1),
        }

        print(f"  Time: {t1 - t0:.2f}s")
        print(f"  Output: {len(output)} chars, {eval_count} tokens")
        print(f"  Speed: {tok_per_sec:.1f} tok/s (gen), {prompt_tok_per_sec:.1f} tok/s (prompt)")
        print(f"  JSON: {'OK' if parse_ok else 'FAIL'}, {fields_found} fields, first_name={first_name}")

        return result

    except Exception as e:
        t1 = time.time()
        print(f"  Error: {e}")
        return {
            "name": name,
            "num_ctx": num_ctx,
            "num_predict": num_predict,
            "time_s": round(t1 - t0, 2),
            "parse_ok": False,
            "fields_found": 0,
            "first_name": "",
            "error": str(e),
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

    # OCR once
    print(f"Image: {image_path}")
    print(f"Model: {OLLAMA_MODEL}")
    print("\nRunning OCR...")
    ocr_text = get_ocr_text(image_path)
    print(f"OCR: {len(ocr_text)} chars")

    # Run each config
    results = []
    for name, num_ctx, num_predict in CONFIGS:
        r = run_config(name, ocr_text, num_ctx, num_predict)
        results.append(r)

    # Summary
    print(f"\n{'=' * 90}")
    print("SUMMARY")
    print(f"{'=' * 90}")
    print(f"{'Config':<25} {'num_ctx':>7} {'pred':>5} {'Time':>7} {'tok/s':>6} {'JSON':>5} {'Fields':>7} {'first_name':<15}")
    print("-" * 90)
    for r in results:
        print(f"{r['name']:<25} {r['num_ctx']:>7} {r['num_predict']:>5} {r['time_s']:>6}s {r.get('tok_per_sec', 0):>5.1f} {('OK' if r['parse_ok'] else 'FAIL'):>5} {r['fields_found']:>7} {r.get('first_name', ''):>15}")

    # Speed comparison
    if all(r.get("time_s") for r in results):
        base = results[0]["time_s"]
        print(f"\nSpeedup vs current:")
        for r in results:
            diff = r["time_s"] - base
            pct = ((r["time_s"] - base) / base) * 100 if base else 0
            print(f"  {r['name']}: {diff:+.1f}s ({pct:+.0f}%)")


if __name__ == "__main__":
    main()
