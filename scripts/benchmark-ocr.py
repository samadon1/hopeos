"""Benchmark: Tesseract+Gemma vs Gemma Vision for document scanning.

Usage:
  python scripts/benchmark-ocr.py <image_path>
  python scripts/benchmark-ocr.py  # uses a test image

Compares:
  1. Tesseract OCR → Gemma text parsing (current approach)
  2. Gemma 4 native vision via Ollama (proposed approach)
"""

import sys
import os
import time
import json
import base64
import httpx

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "hopeos-gemma4-iq2")

EXTRACTION_PROMPT = """Extract patient information from this document.
Return ONLY valid JSON with these fields (use empty string if not found):
{"first_name":"","last_name":"","middle_name":"","birthdate":"","gender":"","phone_number":"","ghana_card_number":"","nhis_number":"","community":"","city":"","region":"","emergency_contact":"","diagnoses":[],"medications":[]}"""


def load_image(path: str) -> str:
    """Load image and return base64 string."""
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def check_ollama():
    """Check if Ollama is running."""
    try:
        r = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        models = [m["name"] for m in r.json().get("models", [])]
        print(f"Ollama running. Models: {', '.join(models)}")
        return True
    except Exception as e:
        print(f"Ollama not available: {e}")
        return False


def benchmark_tesseract_gemma(image_path: str) -> dict:
    """Method 1: Tesseract OCR → Gemma text parsing."""
    result = {"method": "Tesseract + Gemma", "steps": {}}

    # Step 1: Tesseract OCR
    try:
        import pytesseract
        from PIL import Image

        t0 = time.time()
        img = Image.open(image_path)
        # Downscale if large
        orig_size = img.size
        max_dim = 1500
        if max(img.size) > max_dim:
            ratio = max_dim / max(img.size)
            img = img.resize((int(img.width * ratio), int(img.height * ratio)))

        ocr_text = pytesseract.image_to_string(img, config="--oem 3 --psm 6")
        t1 = time.time()

        result["steps"]["ocr"] = {
            "time_s": round(t1 - t0, 2),
            "chars": len(ocr_text),
            "image_size": f"{orig_size[0]}x{orig_size[1]} → {img.size[0]}x{img.size[1]}",
        }
        print(f"  OCR: {t1 - t0:.2f}s, {len(ocr_text)} chars")
        print(f"  OCR text preview: {ocr_text[:200]}...")
    except ImportError:
        print("  pytesseract not installed, skipping Method 1")
        result["error"] = "pytesseract not installed"
        return result
    except Exception as e:
        print(f"  OCR error: {e}")
        result["error"] = str(e)
        return result

    # Step 2: Gemma text parsing
    t0 = time.time()
    prompt = f"""Parse this document text and extract patient information.

DOCUMENT TEXT:
{ocr_text}

{EXTRACTION_PROMPT}"""

    try:
        client = httpx.Client(base_url=OLLAMA_BASE_URL, timeout=180.0)
        resp = client.post("/api/chat", json={
            "model": OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": "You are a document parser. Return ONLY valid JSON."},
                {"role": "user", "content": prompt},
            ],
            "stream": False,
            "options": {"num_predict": 1500, "temperature": 0.1},
        })
        resp.raise_for_status()
        output = resp.json().get("message", {}).get("content", "").strip()
        t1 = time.time()

        result["steps"]["gemma_parse"] = {
            "time_s": round(t1 - t0, 2),
            "output_chars": len(output),
        }
        result["total_time_s"] = round(
            result["steps"]["ocr"]["time_s"] + result["steps"]["gemma_parse"]["time_s"], 2
        )
        result["output_preview"] = output[:500]

        # Try to parse JSON
        try:
            import re
            cleaned = re.sub(r'^```(?:json)?\s*', '', output)
            cleaned = re.sub(r'\s*```\s*$', '', cleaned)
            parsed = json.loads(cleaned)
            result["parsed_fields"] = len([v for v in parsed.values() if v])
            result["parse_success"] = True
        except json.JSONDecodeError:
            result["parse_success"] = False

        print(f"  Gemma parse: {t1 - t0:.2f}s, {len(output)} chars")
        print(f"  Total: {result['total_time_s']}s")

    except Exception as e:
        t1 = time.time()
        print(f"  Gemma error: {e}")
        result["error"] = str(e)
        result["steps"]["gemma_parse"] = {"time_s": round(t1 - t0, 2), "error": str(e)}

    return result


def benchmark_gemma_vision(image_path: str) -> dict:
    """Method 2: Gemma 4 native vision via Ollama."""
    result = {"method": "Gemma Vision (direct)", "steps": {}}

    img_b64 = load_image(image_path)
    result["image_size_kb"] = round(len(img_b64) * 3 / 4 / 1024, 1)

    t0 = time.time()
    try:
        client = httpx.Client(base_url=OLLAMA_BASE_URL, timeout=300.0)
        resp = client.post("/api/chat", json={
            "model": OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": "You are a document parser. Return ONLY valid JSON."},
                {
                    "role": "user",
                    "content": EXTRACTION_PROMPT,
                    "images": [img_b64],
                },
            ],
            "stream": False,
            "options": {"num_predict": 1500, "temperature": 0.1},
        })
        resp.raise_for_status()
        output = resp.json().get("message", {}).get("content", "").strip()
        t1 = time.time()

        result["steps"]["vision"] = {
            "time_s": round(t1 - t0, 2),
            "output_chars": len(output),
        }
        result["total_time_s"] = round(t1 - t0, 2)
        result["output_preview"] = output[:500]

        # Try to parse JSON
        try:
            import re
            cleaned = re.sub(r'^```(?:json)?\s*', '', output)
            cleaned = re.sub(r'\s*```\s*$', '', cleaned)
            parsed = json.loads(cleaned)
            result["parsed_fields"] = len([v for v in parsed.values() if v])
            result["parse_success"] = True
        except json.JSONDecodeError:
            result["parse_success"] = False

        print(f"  Vision: {t1 - t0:.2f}s, {len(output)} chars")

    except Exception as e:
        t1 = time.time()
        print(f"  Vision error: {e}")
        result["error"] = str(e)
        result["steps"]["vision"] = {"time_s": round(t1 - t0, 2), "error": str(e)}

    return result


def benchmark_gemma_vision_downscaled(image_path: str) -> dict:
    """Method 3: Gemma 4 vision with downscaled image."""
    result = {"method": "Gemma Vision (downscaled)", "steps": {}}

    from PIL import Image
    import io

    # Downscale
    t0 = time.time()
    img = Image.open(image_path)
    orig_size = img.size
    max_dim = 800
    if max(img.size) > max_dim:
        ratio = max_dim / max(img.size)
        img = img.resize((int(img.width * ratio), int(img.height * ratio)))

    # Convert to JPEG for smaller size
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    t_resize = time.time() - t0

    result["image_size_kb"] = round(len(img_b64) * 3 / 4 / 1024, 1)
    result["steps"]["resize"] = {
        "time_s": round(t_resize, 2),
        "from": f"{orig_size[0]}x{orig_size[1]}",
        "to": f"{img.size[0]}x{img.size[1]}",
    }
    print(f"  Resize: {t_resize:.2f}s ({orig_size[0]}x{orig_size[1]} → {img.size[0]}x{img.size[1]})")

    t0 = time.time()
    try:
        client = httpx.Client(base_url=OLLAMA_BASE_URL, timeout=300.0)
        resp = client.post("/api/chat", json={
            "model": OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": "You are a document parser. Return ONLY valid JSON."},
                {
                    "role": "user",
                    "content": EXTRACTION_PROMPT,
                    "images": [img_b64],
                },
            ],
            "stream": False,
            "options": {"num_predict": 1500, "temperature": 0.1},
        })
        resp.raise_for_status()
        output = resp.json().get("message", {}).get("content", "").strip()
        t1 = time.time()

        result["steps"]["vision"] = {
            "time_s": round(t1 - t0, 2),
            "output_chars": len(output),
        }
        result["total_time_s"] = round(t_resize + (t1 - t0), 2)
        result["output_preview"] = output[:500]

        # Try to parse JSON
        try:
            import re
            cleaned = re.sub(r'^```(?:json)?\s*', '', output)
            cleaned = re.sub(r'\s*```\s*$', '', cleaned)
            parsed = json.loads(cleaned)
            result["parsed_fields"] = len([v for v in parsed.values() if v])
            result["parse_success"] = True
        except json.JSONDecodeError:
            result["parse_success"] = False

        print(f"  Vision: {t1 - t0:.2f}s, {len(output)} chars")
        print(f"  Total: {result['total_time_s']}s")

    except Exception as e:
        t1 = time.time()
        print(f"  Vision error: {e}")
        result["error"] = str(e)

    return result


def create_test_image():
    """Create a simple test image with text if no image provided."""
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (800, 400), "white")
    draw = ImageDraw.Draw(img)

    text = """GHANA HEALTH SERVICE - PATIENT RECORD
Name: MENSAH Kwame Boateng
Date of Birth: 15/03/1985
Gender: Male
Ghana Card: GHA-123456789-1
Phone: 024-555-1234
Region: Greater Accra
Community: Madina
Emergency Contact: Ama Mensah 024-555-5678
Diagnosis: Hypertension, Type 2 Diabetes
Medications: Metformin 500mg, Amlodipine 5mg"""

    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
    except Exception:
        font = ImageFont.load_default()

    draw.text((30, 20), text, fill="black", font=font)

    path = "/tmp/hopeos_test_document.png"
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

    print(f"Image: {image_path}")
    print(f"Model: {OLLAMA_MODEL}")
    print(f"Ollama: {OLLAMA_BASE_URL}")
    print()

    if not check_ollama():
        sys.exit(1)

    print()
    results = []

    # Method 1: Tesseract + Gemma
    print("=" * 50)
    print("Method 1: Tesseract OCR + Gemma text parsing")
    print("=" * 50)
    r1 = benchmark_tesseract_gemma(image_path)
    results.append(r1)

    print()

    # Method 2: Gemma Vision (full resolution)
    print("=" * 50)
    print("Method 2: Gemma Vision (full resolution)")
    print("=" * 50)
    r2 = benchmark_gemma_vision(image_path)
    results.append(r2)

    print()

    # Method 3: Gemma Vision (downscaled)
    print("=" * 50)
    print("Method 3: Gemma Vision (downscaled to 800px)")
    print("=" * 50)
    r3 = benchmark_gemma_vision_downscaled(image_path)
    results.append(r3)

    # Summary
    print()
    print("=" * 50)
    print("SUMMARY")
    print("=" * 50)
    print(f"{'Method':<35} {'Time':>8} {'JSON OK':>8} {'Fields':>8}")
    print("-" * 65)
    for r in results:
        name = r["method"]
        time_s = f"{r.get('total_time_s', 'N/A')}s"
        parse_ok = "Yes" if r.get("parse_success") else "No"
        fields = str(r.get("parsed_fields", "-"))
        print(f"{name:<35} {time_s:>8} {parse_ok:>8} {fields:>8}")

    print()
    print("Output previews:")
    for r in results:
        print(f"\n--- {r['method']} ---")
        print(r.get("output_preview", r.get("error", "N/A"))[:300])


if __name__ == "__main__":
    main()
