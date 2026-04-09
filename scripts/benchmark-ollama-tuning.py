"""Benchmark: Ollama env var tuning for CPU inference speed.

Usage:
  python scripts/benchmark-ollama-tuning.py [image_path]

Tests different Ollama configurations by restarting Ollama with different env vars.
Does NOT change any production code.

NOTE: This script restarts Ollama between tests. Make sure no other
      processes depend on Ollama during the benchmark.
"""

import sys
import os
import time
import json
import re
import subprocess
import httpx

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "hopeos-gemma4-iq2")

PROMPT = """Parse this Ghanaian medical document and extract patient information.

DOCUMENT TEXT:
{ocr_text}

IMPORTANT - Ghanaian Name Parsing Rules:
- Names may be in format "SURNAME Given-name" or "Given-name SURNAME"
- If name has 2 parts: first part is first_name, second part is last_name
- If name has 3+ parts: first is first_name, last is last_name, middle parts are middle_name
- Surnames are often ALL CAPS

Extract these fields (use empty string if not found):
- first_name, middle_name, last_name, birthdate, gender, phone_number
- ghana_card_number, nhis_number, community, city, region
- emergency_contact, diagnoses (list), medications (list)
- blood_pressure, pulse, temperature, weight, height

Return ONLY valid JSON:
{{"first_name":"","middle_name":"","last_name":"","birthdate":"","gender":"","phone_number":"","ghana_card_number":"","nhis_number":"","community":"","city":"","region":"","emergency_contact":"","diagnoses":[],"medications":[],"blood_pressure":"","pulse":"","temperature":"","weight":"","height":""}}"""

# Configurations to test: (name, env_vars, api_options)
CONFIGS = [
    (
        "Current defaults",
        {},  # no env changes, just restart clean
        {"num_predict": 1500, "temperature": 0.1},
    ),
    (
        "num_ctx=2048 only",
        {},
        {"num_ctx": 2048, "num_predict": 1500, "temperature": 0.1},
    ),
    (
        "ctx=2048 + flash_attn",
        {"OLLAMA_FLASH_ATTENTION": "1"},
        {"num_ctx": 2048, "num_predict": 1500, "temperature": 0.1},
    ),
    (
        "ctx=2048 + flash + kv_q8",
        {"OLLAMA_FLASH_ATTENTION": "1", "OLLAMA_KV_CACHE_TYPE": "q8_0"},
        {"num_ctx": 2048, "num_predict": 1500, "temperature": 0.1},
    ),
    (
        "ctx=2048 + flash + kv_q4",
        {"OLLAMA_FLASH_ATTENTION": "1", "OLLAMA_KV_CACHE_TYPE": "q4_0"},
        {"num_ctx": 2048, "num_predict": 1500, "temperature": 0.1},
    ),
    (
        "ALL tuned (recommended)",
        {
            "OLLAMA_FLASH_ATTENTION": "1",
            "OLLAMA_KV_CACHE_TYPE": "q8_0",
            "OLLAMA_NUM_PARALLEL": "1",
            "OLLAMA_KEEP_ALIVE": "-1",
        },
        {"num_ctx": 2048, "num_predict": 1500, "temperature": 0.1},
    ),
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


def stop_ollama():
    """Stop Ollama server."""
    try:
        subprocess.run(["pkill", "-f", "ollama"], capture_output=True, timeout=5)
        time.sleep(2)
    except Exception:
        pass


def start_ollama(env_vars: dict):
    """Start Ollama with specific env vars."""
    env = os.environ.copy()
    # Clear previous ollama tuning vars
    for key in ["OLLAMA_FLASH_ATTENTION", "OLLAMA_KV_CACHE_TYPE", "OLLAMA_NUM_PARALLEL", "OLLAMA_KEEP_ALIVE"]:
        env.pop(key, None)
    # Set new ones
    env.update(env_vars)

    subprocess.Popen(
        ["ollama", "serve"],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Wait for Ollama to be ready
    for i in range(30):
        try:
            httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
            return True
        except Exception:
            time.sleep(1)
    return False


def wait_for_model_load():
    """Send a tiny request to ensure the model is loaded (warm up)."""
    try:
        client = httpx.Client(base_url=OLLAMA_BASE_URL, timeout=120.0)
        client.post("/api/chat", json={
            "model": OLLAMA_MODEL,
            "messages": [{"role": "user", "content": "hi"}],
            "stream": False,
            "options": {"num_predict": 1},
        })
    except Exception:
        pass


def run_inference(ocr_text: str, api_options: dict) -> dict:
    """Run a single inference and return timing + quality metrics."""
    filled = PROMPT.format(ocr_text=ocr_text)

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
            "options": api_options,
        })
        resp.raise_for_status()
        data = resp.json()
        output = data.get("message", {}).get("content", "").strip()
        t1 = time.time()

        # Token stats
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

        return {
            "time_s": round(t1 - t0, 2),
            "parse_ok": parse_ok,
            "fields_found": fields_found,
            "first_name": first_name,
            "eval_tokens": eval_count,
            "tok_per_sec": round(tok_per_sec, 1),
            "prompt_tok_per_sec": round(prompt_tok_per_sec, 1),
        }

    except Exception as e:
        t1 = time.time()
        return {
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

    # OCR once
    print(f"Image: {image_path}")
    print(f"Model: {OLLAMA_MODEL}")
    print("\nRunning OCR...")
    ocr_text = get_ocr_text(image_path)
    print(f"OCR: {len(ocr_text)} chars\n")

    results = []

    for name, env_vars, api_options in CONFIGS:
        print(f"\n{'=' * 65}")
        print(f"Config: {name}")
        if env_vars:
            print(f"  Env: {env_vars}")
        print(f"  API: {api_options}")
        print(f"{'=' * 65}")

        # Restart Ollama with new env
        print("  Restarting Ollama...")
        stop_ollama()
        if not start_ollama(env_vars):
            print("  ERROR: Ollama failed to start!")
            results.append({"name": name, "error": "Failed to start"})
            continue

        # Warm up (load model into memory)
        print("  Loading model (warm up)...")
        wait_for_model_load()
        time.sleep(2)  # let things settle

        # Run inference
        print("  Running inference...")
        r = run_inference(ocr_text, api_options)
        r["name"] = name

        print(f"  Time: {r['time_s']}s")
        print(f"  Speed: {r.get('tok_per_sec', 0)} tok/s (gen), {r.get('prompt_tok_per_sec', 0)} tok/s (prompt)")
        print(f"  JSON: {'OK' if r['parse_ok'] else 'FAIL'}, {r['fields_found']} fields, first_name={r.get('first_name', '')}")

        results.append(r)

    # Restart Ollama clean at the end
    print("\n\nRestarting Ollama with clean defaults...")
    stop_ollama()
    start_ollama({})

    # Summary
    print(f"\n{'=' * 95}")
    print("SUMMARY")
    print(f"{'=' * 95}")
    print(f"{'Config':<28} {'Time':>7} {'Gen tok/s':>10} {'Prompt tok/s':>13} {'JSON':>5} {'Fields':>7} {'Name':>10}")
    print("-" * 95)
    for r in results:
        if "error" in r and r.get("time_s") is None:
            print(f"{r['name']:<28} {'ERROR':>7}")
            continue
        print(f"{r['name']:<28} {r['time_s']:>6}s {r.get('tok_per_sec', 0):>9.1f} {r.get('prompt_tok_per_sec', 0):>12.1f} {('OK' if r['parse_ok'] else 'FAIL'):>5} {r['fields_found']:>7} {r.get('first_name', ''):>10}")

    # Speed comparison
    valid = [r for r in results if r.get("time_s")]
    if len(valid) >= 2:
        base = valid[0]["time_s"]
        print(f"\nSpeedup vs defaults:")
        for r in valid:
            diff = r["time_s"] - base
            pct = ((r["time_s"] - base) / base) * 100 if base else 0
            print(f"  {r['name']}: {diff:+.1f}s ({pct:+.0f}%)")


if __name__ == "__main__":
    main()
