"""Benchmark: Ollama vs llama-server for OCR JSON parsing.

Focused test on the actual document extraction workflow used by HopeOS.
"""

import os
import sys
import time
import json
import re
import httpx

OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "hopeos-gemma4-iq2")
LLAMA_SERVER_URL = os.getenv("LLAMA_SERVER_URL", "http://localhost:8080")

# The actual prompt used in ai_service.py
EXTRACTION_PROMPT = """Parse this Ghanaian medical document and extract patient information.

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

SYSTEM_PROMPT = "You are a medical document parser. Extract patient data and return ONLY valid JSON. No markdown, no explanation, no code blocks — just the raw JSON object."

# Realistic OCR output from a Ghanaian medical document
TEST_OCR_TEXTS = [
    {
        "name": "Simple Ghana Card",
        "text": """GHANA HEALTH SERVICE
DISTRICT HOSPITAL - PATIENT RECORD

Patient Name: MENSAH Kwame
Date of Birth: 15/03/1985
Gender: Male
Ghana Card No: GHA-123456789-1
Phone: 024-555-1234
Region: Greater Accra""",
        "expected": {"first_name": "Kwame", "last_name": "Mensah"},
    },
    {
        "name": "Full Medical Record",
        "text": """GHANA HEALTH SERVICE
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
3. Lifestyle modifications""",
        "expected": {"first_name": "Kwame", "last_name": "Mensah", "diagnoses": 2, "medications": 3},
    },
    {
        "name": "Messy OCR (realistic)",
        "text": """GH4NA HEALTH SERV1CE
D1STR1CT H0SP1TAL - PAT1ENT REC0RD

Pat1ent Name: 0SEI Kofi Agyeman
D0B: 22/O7/199O
Gender: Ma1e
Ghana Card: GHA-987654321-2
Pnone: O2O-333-4567

V1TALS:
BP: 125/8O mmHg
Pu1se: 72 bpm
Temp: 36.8 C

D1AGN0S1S: Acute Malar1a (B50.9)
PLAN: Artemether-Lumefantr1ne 80/48Omg x 3 days""",
        "expected": {"first_name": "Kofi", "last_name": "Osei"},
    },
]

NUM_RUNS = 3


def run_ollama(ocr_text: str) -> dict:
    """Run via Ollama API."""
    prompt = EXTRACTION_PROMPT.format(ocr_text=ocr_text)
    t0 = time.time()
    try:
        client = httpx.Client(base_url=OLLAMA_URL, timeout=180.0)
        resp = client.post("/api/chat", json={
            "model": OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "stream": False,
            "options": {"num_predict": 1500, "temperature": 0.1, "num_ctx": 2048},
        })
        resp.raise_for_status()
        data = resp.json()
        t1 = time.time()

        output = data.get("message", {}).get("content", "").strip()
        eval_count = data.get("eval_count", 0)
        eval_duration = data.get("eval_duration", 0)
        tok_per_sec = (eval_count / (eval_duration / 1e9)) if eval_duration else 0

        return {
            "success": True,
            "time_s": round(t1 - t0, 2),
            "output": output,
            "tokens": eval_count,
            "tok_per_sec": round(tok_per_sec, 1),
        }
    except Exception as e:
        return {"success": False, "error": str(e), "time_s": round(time.time() - t0, 2)}


def run_llama_server(ocr_text: str) -> dict:
    """Run via llama-server OpenAI-compatible API."""
    prompt = EXTRACTION_PROMPT.format(ocr_text=ocr_text)
    t0 = time.time()
    try:
        client = httpx.Client(base_url=LLAMA_SERVER_URL, timeout=180.0)
        resp = client.post("/v1/chat/completions", json={
            "model": "gemma-4",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 1500,
            "temperature": 0.1,
        })
        resp.raise_for_status()
        data = resp.json()
        t1 = time.time()

        output = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        usage = data.get("usage", {})
        tokens = usage.get("completion_tokens", 0)
        tok_per_sec = tokens / (t1 - t0) if (t1 - t0) > 0 else 0

        return {
            "success": True,
            "time_s": round(t1 - t0, 2),
            "output": output,
            "tokens": tokens,
            "tok_per_sec": round(tok_per_sec, 1),
        }
    except Exception as e:
        return {"success": False, "error": str(e), "time_s": round(time.time() - t0, 2)}


def parse_json_output(output: str) -> tuple[bool, dict, int]:
    """Parse JSON from model output. Returns (success, data, field_count)."""
    cleaned = output.strip()
    # Remove markdown code blocks
    if cleaned.startswith("```"):
        cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
        cleaned = re.sub(r'\s*```\s*$', '', cleaned)

    # Strip thinking tags
    if "<|channel>" in cleaned:
        parts = cleaned.split("<|channel>")
        cleaned = parts[-1].strip()

    try:
        data = json.loads(cleaned)
        fields = len([k for k, v in data.items() if v and v != [] and v != ""])
        return True, data, fields
    except json.JSONDecodeError:
        # Try to find JSON in output
        match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
                fields = len([k for k, v in data.items() if v and v != [] and v != ""])
                return True, data, fields
            except json.JSONDecodeError:
                pass
    return False, {}, 0


def check_extraction_quality(data: dict, expected: dict) -> dict:
    """Check if extracted data matches expected values."""
    results = {}
    for key, expected_val in expected.items():
        if key == "diagnoses":
            actual = data.get("diagnoses", [])
            results[key] = len(actual) >= expected_val if isinstance(actual, list) else False
        elif key == "medications":
            actual = data.get("medications", [])
            results[key] = len(actual) >= expected_val if isinstance(actual, list) else False
        else:
            actual = data.get(key, "").lower()
            results[key] = expected_val.lower() in actual
    return results


def main():
    print("=" * 75)
    print("Ollama vs llama-server: OCR JSON Parsing Benchmark")
    print("=" * 75)

    # Check servers
    ollama_ok = False
    llama_ok = False

    try:
        r = httpx.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        if any(OLLAMA_MODEL in m["name"] for m in r.json().get("models", [])):
            ollama_ok = True
            print(f"  Ollama: OK ({OLLAMA_MODEL})")
    except:
        print("  Ollama: NOT RUNNING")

    try:
        r = httpx.get(f"{LLAMA_SERVER_URL}/health", timeout=5)
        if r.status_code == 200:
            llama_ok = True
            print(f"  llama-server: OK ({LLAMA_SERVER_URL})")
    except:
        print("  llama-server: NOT RUNNING")

    if not ollama_ok and not llama_ok:
        print("\nNo servers running!")
        sys.exit(1)

    results = {"ollama": [], "llama_server": []}

    for test in TEST_OCR_TEXTS:
        print(f"\n{'=' * 75}")
        print(f"Test: {test['name']}")
        print(f"{'=' * 75}")
        print(f"OCR text ({len(test['text'])} chars):")
        print(test['text'][:200] + "..." if len(test['text']) > 200 else test['text'])

        # Ollama
        if ollama_ok:
            print(f"\n  Ollama ({NUM_RUNS} runs):")
            runs = []
            for i in range(NUM_RUNS):
                r = run_ollama(test["text"])
                runs.append(r)
                if r["success"]:
                    ok, data, fields = parse_json_output(r["output"])
                    quality = check_extraction_quality(data, test["expected"]) if ok else {}
                    quality_str = f"name={'✓' if quality.get('first_name') and quality.get('last_name') else '✗'}"
                    print(f"    Run {i+1}: {r['time_s']:.1f}s, {r['tok_per_sec']:.0f} tok/s, JSON={'✓' if ok else '✗'}, {fields} fields, {quality_str}")
                else:
                    print(f"    Run {i+1}: FAIL - {r.get('error', '')[:50]}")

            # Aggregate
            successful = [r for r in runs if r["success"]]
            if successful:
                avg_time = sum(r["time_s"] for r in successful) / len(successful)
                avg_tps = sum(r["tok_per_sec"] for r in successful) / len(successful)
                last_ok, last_data, last_fields = parse_json_output(successful[-1]["output"])
                last_quality = check_extraction_quality(last_data, test["expected"]) if last_ok else {}
                results["ollama"].append({
                    "test": test["name"],
                    "avg_time": round(avg_time, 2),
                    "avg_tps": round(avg_tps, 1),
                    "json_ok": last_ok,
                    "fields": last_fields,
                    "name_correct": last_quality.get("first_name", False) and last_quality.get("last_name", False),
                })

        # llama-server
        if llama_ok:
            print(f"\n  llama-server ({NUM_RUNS} runs):")
            runs = []
            for i in range(NUM_RUNS):
                r = run_llama_server(test["text"])
                runs.append(r)
                if r["success"]:
                    ok, data, fields = parse_json_output(r["output"])
                    quality = check_extraction_quality(data, test["expected"]) if ok else {}
                    quality_str = f"name={'✓' if quality.get('first_name') and quality.get('last_name') else '✗'}"
                    print(f"    Run {i+1}: {r['time_s']:.1f}s, {r['tok_per_sec']:.0f} tok/s, JSON={'✓' if ok else '✗'}, {fields} fields, {quality_str}")
                else:
                    print(f"    Run {i+1}: FAIL - {r.get('error', '')[:50]}")

            # Aggregate
            successful = [r for r in runs if r["success"]]
            if successful:
                avg_time = sum(r["time_s"] for r in successful) / len(successful)
                avg_tps = sum(r["tok_per_sec"] for r in successful) / len(successful)
                last_ok, last_data, last_fields = parse_json_output(successful[-1]["output"])
                last_quality = check_extraction_quality(last_data, test["expected"]) if last_ok else {}
                results["llama_server"].append({
                    "test": test["name"],
                    "avg_time": round(avg_time, 2),
                    "avg_tps": round(avg_tps, 1),
                    "json_ok": last_ok,
                    "fields": last_fields,
                    "name_correct": last_quality.get("first_name", False) and last_quality.get("last_name", False),
                })

    # Summary
    print(f"\n{'=' * 75}")
    print("SUMMARY")
    print(f"{'=' * 75}")
    print(f"{'Test':<25} {'Server':<15} {'Avg Time':>10} {'tok/s':>8} {'JSON':>6} {'Fields':>7} {'Name':>6}")
    print("-" * 80)

    for test in TEST_OCR_TEXTS:
        for server, data_list in results.items():
            match = [r for r in data_list if r["test"] == test["name"]]
            if match:
                r = match[0]
                print(f"{test['name']:<25} {server:<15} {r['avg_time']:>9.1f}s {r['avg_tps']:>7.0f} {'✓' if r['json_ok'] else '✗':>6} {r['fields']:>7} {'✓' if r['name_correct'] else '✗':>6}")

    # Overall comparison
    if results["ollama"] and results["llama_server"]:
        print(f"\n{'=' * 75}")
        print("OVERALL COMPARISON")
        print(f"{'=' * 75}")

        ollama_avg = sum(r["avg_time"] for r in results["ollama"]) / len(results["ollama"])
        llama_avg = sum(r["avg_time"] for r in results["llama_server"]) / len(results["llama_server"])
        ollama_tps = sum(r["avg_tps"] for r in results["ollama"]) / len(results["ollama"])
        llama_tps = sum(r["avg_tps"] for r in results["llama_server"]) / len(results["llama_server"])
        ollama_json = sum(1 for r in results["ollama"] if r["json_ok"]) / len(results["ollama"]) * 100
        llama_json = sum(1 for r in results["llama_server"] if r["json_ok"]) / len(results["llama_server"]) * 100
        ollama_name = sum(1 for r in results["ollama"] if r["name_correct"]) / len(results["ollama"]) * 100
        llama_name = sum(1 for r in results["llama_server"] if r["name_correct"]) / len(results["llama_server"]) * 100

        print(f"{'Metric':<25} {'Ollama':>15} {'llama-server':>15} {'Winner':>12}")
        print("-" * 70)
        print(f"{'Avg Response Time':<25} {ollama_avg:>14.1f}s {llama_avg:>14.1f}s {'llama' if llama_avg < ollama_avg else 'Ollama':>12}")
        print(f"{'Avg Tokens/sec':<25} {ollama_tps:>15.0f} {llama_tps:>15.0f} {'llama' if llama_tps > ollama_tps else 'Ollama':>12}")
        print(f"{'JSON Parse Success':<25} {ollama_json:>14.0f}% {llama_json:>14.0f}% {'llama' if llama_json > ollama_json else 'Ollama':>12}")
        print(f"{'Name Extraction':<25} {ollama_name:>14.0f}% {llama_name:>14.0f}% {'llama' if llama_name > ollama_name else 'Ollama':>12}")

        time_diff = ((llama_avg - ollama_avg) / ollama_avg) * 100
        print(f"\nTime difference: llama-server is {abs(time_diff):.0f}% {'faster' if time_diff < 0 else 'slower'} than Ollama")


if __name__ == "__main__":
    main()
