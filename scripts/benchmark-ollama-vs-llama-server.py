"""Benchmark: Ollama vs llama-server comparison.

Usage:
  # Terminal 1: Start Ollama (if not running)
  ollama serve

  # Terminal 2: Start llama-server
  llama-server -m backend/hopeos-backend/models/gemma-4-E2B-it-UD-IQ2_M.gguf \
    --port 8080 --ctx-size 2048 --n-predict 512

  # Terminal 3: Run benchmark
  python scripts/benchmark-ollama-vs-llama-server.py

Compares:
  - Cold start latency (first request after server start)
  - Warm latency (subsequent requests)
  - Tokens per second
  - Response quality (JSON parsing)
"""

import os
import sys
import time
import json
import httpx

# Config
OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "hopeos-gemma4-iq2")
LLAMA_SERVER_URL = os.getenv("LLAMA_SERVER_URL", "http://localhost:8080")

# Test prompts - simple and complex
PROMPTS = [
    {
        "name": "Simple (greeting)",
        "messages": [{"role": "user", "content": "Hello, how are you?"}],
        "max_tokens": 50,
    },
    {
        "name": "Medium (clinical)",
        "messages": [
            {"role": "system", "content": "You are a clinical assistant. Be concise."},
            {"role": "user", "content": "What are the common symptoms of malaria?"},
        ],
        "max_tokens": 200,
    },
    {
        "name": "Complex (JSON extraction)",
        "messages": [
            {"role": "system", "content": "You are a JSON parser. Return ONLY valid JSON, no markdown."},
            {"role": "user", "content": """Extract patient info from this text:
Patient: Kwame Mensah, Male, DOB: 1985-03-15
Ghana Card: GHA-123456789-1
Vitals: BP 140/90, Pulse 78
Diagnosis: Hypertension, Type 2 Diabetes

Return JSON with fields: name, gender, birthdate, ghana_card, blood_pressure, pulse, diagnoses (array)"""},
        ],
        "max_tokens": 300,
    },
]

NUM_RUNS = 3  # Runs per prompt (first is cold, rest are warm)


def check_ollama() -> bool:
    """Check if Ollama is running and model is available."""
    try:
        resp = httpx.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        models = [m["name"] for m in resp.json().get("models", [])]
        if any(OLLAMA_MODEL in m for m in models):
            print(f"  Ollama: OK (model: {OLLAMA_MODEL})")
            return True
        print(f"  Ollama: Model '{OLLAMA_MODEL}' not found. Available: {models}")
        return False
    except httpx.ConnectError:
        print("  Ollama: NOT RUNNING (start with: ollama serve)")
        return False


def check_llama_server() -> bool:
    """Check if llama-server is running."""
    try:
        resp = httpx.get(f"{LLAMA_SERVER_URL}/health", timeout=5)
        if resp.status_code == 200:
            print(f"  llama-server: OK ({LLAMA_SERVER_URL})")
            return True
        print(f"  llama-server: Unhealthy (status {resp.status_code})")
        return False
    except httpx.ConnectError:
        print(f"  llama-server: NOT RUNNING")
        print(f"    Start with:")
        print(f"    llama-server -m backend/hopeos-backend/models/gemma-4-E2B-it-UD-IQ2_M.gguf \\")
        print(f"      --port 8080 --ctx-size 2048 --n-predict 512")
        return False


def run_ollama(messages: list, max_tokens: int) -> dict:
    """Run inference via Ollama API."""
    t0 = time.time()
    try:
        client = httpx.Client(base_url=OLLAMA_URL, timeout=120.0)
        resp = client.post("/api/chat", json={
            "model": OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
            "options": {
                "num_predict": max_tokens,
                "temperature": 0.7,
                "num_ctx": 2048,
            },
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
            "time_s": round(t1 - t0, 3),
            "output": output,
            "tokens": eval_count,
            "tok_per_sec": round(tok_per_sec, 1),
        }
    except Exception as e:
        return {"success": False, "error": str(e), "time_s": round(time.time() - t0, 3)}


def run_llama_server(messages: list, max_tokens: int) -> dict:
    """Run inference via llama-server (OpenAI-compatible API)."""
    t0 = time.time()
    try:
        client = httpx.Client(base_url=LLAMA_SERVER_URL, timeout=120.0)
        resp = client.post("/v1/chat/completions", json={
            "model": "gemma-4",  # Ignored by llama-server but required by schema
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.7,
        })
        resp.raise_for_status()
        data = resp.json()
        t1 = time.time()

        choice = data.get("choices", [{}])[0]
        output = choice.get("message", {}).get("content", "").strip()
        usage = data.get("usage", {})
        completion_tokens = usage.get("completion_tokens", 0)

        # llama-server doesn't provide tok/sec directly, calculate from time
        tok_per_sec = completion_tokens / (t1 - t0) if (t1 - t0) > 0 else 0

        return {
            "success": True,
            "time_s": round(t1 - t0, 3),
            "output": output,
            "tokens": completion_tokens,
            "tok_per_sec": round(tok_per_sec, 1),
        }
    except Exception as e:
        return {"success": False, "error": str(e), "time_s": round(time.time() - t0, 3)}


def check_json_quality(output: str) -> tuple[bool, int]:
    """Check if output is valid JSON and count fields."""
    import re
    cleaned = output.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
        cleaned = re.sub(r'\s*```\s*$', '', cleaned)

    try:
        data = json.loads(cleaned)
        fields = len([v for v in data.values() if v and v != [] and v != ""])
        return True, fields
    except (json.JSONDecodeError, AttributeError):
        # Try to find JSON in output
        match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
                fields = len([v for v in data.values() if v and v != [] and v != ""])
                return True, fields
            except (json.JSONDecodeError, AttributeError):
                pass
    return False, 0


def main():
    print("=" * 70)
    print("Ollama vs llama-server Benchmark")
    print("=" * 70)
    print("\nChecking servers...")

    ollama_ok = check_ollama()
    llama_ok = check_llama_server()

    if not ollama_ok and not llama_ok:
        print("\nNo servers available. Please start at least one.")
        sys.exit(1)

    results = {"ollama": [], "llama_server": []}

    print("\n" + "=" * 70)
    print("Running benchmarks...")
    print("=" * 70)

    for prompt_info in PROMPTS:
        name = prompt_info["name"]
        messages = prompt_info["messages"]
        max_tokens = prompt_info["max_tokens"]

        print(f"\n--- {name} (max_tokens={max_tokens}) ---")

        # Test Ollama
        if ollama_ok:
            print(f"  Ollama:")
            times = []
            for i in range(NUM_RUNS):
                r = run_ollama(messages, max_tokens)
                times.append(r)
                status = "OK" if r["success"] else f"FAIL: {r.get('error', '')}"
                print(f"    Run {i+1}: {r['time_s']:.2f}s, {r.get('tok_per_sec', 0):.1f} tok/s - {status}")

            if times and times[0]["success"]:
                avg_time = sum(t["time_s"] for t in times if t["success"]) / len([t for t in times if t["success"]])
                avg_tps = sum(t.get("tok_per_sec", 0) for t in times if t["success"]) / len([t for t in times if t["success"]])
                json_ok, fields = check_json_quality(times[-1].get("output", "")) if "JSON" in name else (None, None)
                results["ollama"].append({
                    "prompt": name,
                    "avg_time": round(avg_time, 3),
                    "avg_tok_per_sec": round(avg_tps, 1),
                    "cold_time": times[0]["time_s"],
                    "warm_time": times[-1]["time_s"] if len(times) > 1 else times[0]["time_s"],
                    "json_ok": json_ok,
                    "json_fields": fields,
                })

        # Test llama-server
        if llama_ok:
            print(f"  llama-server:")
            times = []
            for i in range(NUM_RUNS):
                r = run_llama_server(messages, max_tokens)
                times.append(r)
                status = "OK" if r["success"] else f"FAIL: {r.get('error', '')}"
                print(f"    Run {i+1}: {r['time_s']:.2f}s, {r.get('tok_per_sec', 0):.1f} tok/s - {status}")

            if times and times[0]["success"]:
                avg_time = sum(t["time_s"] for t in times if t["success"]) / len([t for t in times if t["success"]])
                avg_tps = sum(t.get("tok_per_sec", 0) for t in times if t["success"]) / len([t for t in times if t["success"]])
                json_ok, fields = check_json_quality(times[-1].get("output", "")) if "JSON" in name else (None, None)
                results["llama_server"].append({
                    "prompt": name,
                    "avg_time": round(avg_time, 3),
                    "avg_tok_per_sec": round(avg_tps, 1),
                    "cold_time": times[0]["time_s"],
                    "warm_time": times[-1]["time_s"] if len(times) > 1 else times[0]["time_s"],
                    "json_ok": json_ok,
                    "json_fields": fields,
                })

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    if results["ollama"] or results["llama_server"]:
        print(f"\n{'Prompt':<25} {'Server':<15} {'Avg Time':>10} {'Avg tok/s':>12} {'Cold':>8} {'Warm':>8} {'JSON':>6}")
        print("-" * 90)

        for prompt_info in PROMPTS:
            name = prompt_info["name"]
            for server, data in results.items():
                matching = [r for r in data if r["prompt"] == name]
                if matching:
                    r = matching[0]
                    json_str = ""
                    if r["json_ok"] is not None:
                        json_str = f"{'OK' if r['json_ok'] else 'FAIL'}({r['json_fields']})"
                    print(f"{name:<25} {server:<15} {r['avg_time']:>9.2f}s {r['avg_tok_per_sec']:>11.1f} {r['cold_time']:>7.2f}s {r['warm_time']:>7.2f}s {json_str:>6}")

    # Comparison
    if results["ollama"] and results["llama_server"]:
        print("\n--- Comparison (llama-server vs Ollama) ---")
        for prompt_info in PROMPTS:
            name = prompt_info["name"]
            ollama_r = next((r for r in results["ollama"] if r["prompt"] == name), None)
            llama_r = next((r for r in results["llama_server"] if r["prompt"] == name), None)
            if ollama_r and llama_r:
                time_diff = llama_r["avg_time"] - ollama_r["avg_time"]
                time_pct = (time_diff / ollama_r["avg_time"]) * 100 if ollama_r["avg_time"] else 0
                tps_diff = llama_r["avg_tok_per_sec"] - ollama_r["avg_tok_per_sec"]
                faster = "llama-server" if time_diff < 0 else "Ollama"
                print(f"  {name}: {faster} faster by {abs(time_diff):.2f}s ({abs(time_pct):.0f}%), tok/s diff: {tps_diff:+.1f}")


if __name__ == "__main__":
    main()
