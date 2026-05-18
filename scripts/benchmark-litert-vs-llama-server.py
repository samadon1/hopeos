#!/usr/bin/env python3
"""Benchmark: LiteRT-LM vs llama-server comparison.

Usage:
  # Terminal 1: Start llama-server
  llama-server -m backend/hopeos-backend/models/gemma-4-E2B-it-UD-IQ2_M.gguf \
    --port 8080 --ctx-size 2048 --reasoning off

  # Terminal 2: Run benchmark
  python scripts/benchmark-litert-vs-llama-server.py

Compares:
  - LiteRT-LM (Google's optimized runtime, .litertlm format)
  - llama-server (llama.cpp server, .gguf format)
"""

import os
import sys
import time
import json
import subprocess
import httpx

# Config
LLAMA_SERVER_URL = os.getenv("LLAMA_SERVER_URL", "http://localhost:8080")
LITERT_MODEL = os.getenv("LITERT_MODEL", "backend/hopeos-backend/models/gemma-4-E2B-it.litertlm")

# Test prompts
PROMPTS = [
    {
        "name": "Simple (greeting)",
        "prompt": "Hello, how are you?",
        "max_tokens": 50,
    },
    {
        "name": "Medium (clinical)",
        "system": "You are a clinical assistant. Be concise.",
        "prompt": "What are the common symptoms of malaria?",
        "max_tokens": 200,
    },
    {
        "name": "Complex (JSON extraction)",
        "system": "You are a JSON parser. Return ONLY valid JSON, no markdown.",
        "prompt": """Extract patient info from this text:
Patient: Kwame Mensah, Male, DOB: 1985-03-15
Ghana Card: GHA-123456789-1
Vitals: BP 140/90, Pulse 78
Diagnosis: Hypertension, Type 2 Diabetes

Return JSON with fields: name, gender, birthdate, ghana_card, blood_pressure, pulse, diagnoses (array)""",
        "max_tokens": 300,
    },
]

NUM_RUNS = 3


def check_llama_server() -> bool:
    """Check if llama-server is running."""
    try:
        resp = httpx.get(f"{LLAMA_SERVER_URL}/health", timeout=5)
        if resp.status_code == 200:
            print(f"  llama-server: OK ({LLAMA_SERVER_URL})")
            return True
        return False
    except httpx.ConnectError:
        print(f"  llama-server: NOT RUNNING")
        print(f"    Start with: llama-server -m backend/hopeos-backend/models/gemma-4-E2B-it-UD-IQ2_M.gguf --port 8080 --ctx-size 2048 --reasoning off")
        return False


def check_litert() -> bool:
    """Check if litert-lm is installed and model exists."""
    try:
        result = subprocess.run(["litert-lm", "--version"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            if os.path.exists(LITERT_MODEL):
                print(f"  LiteRT-LM: OK (model: {LITERT_MODEL})")
                return True
            else:
                print(f"  LiteRT-LM: Model not found: {LITERT_MODEL}")
                return False
        return False
    except FileNotFoundError:
        print("  LiteRT-LM: NOT INSTALLED (pip install litert-lm)")
        return False
    except Exception as e:
        print(f"  LiteRT-LM: Error: {e}")
        return False


def run_llama_server(prompt: str, system: str = None, max_tokens: int = 512) -> dict:
    """Run inference via llama-server API."""
    t0 = time.time()
    try:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        client = httpx.Client(base_url=LLAMA_SERVER_URL, timeout=120.0)
        resp = client.post("/v1/chat/completions", json={
            "model": "gemma-4",
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


def run_litert(prompt: str, system: str = None, max_tokens: int = 512, backend: str = "gpu") -> dict:
    """Run inference via litert-lm CLI."""
    t0 = time.time()
    try:
        # LiteRT-LM doesn't have system prompt in CLI, prepend to prompt
        full_prompt = prompt
        if system:
            full_prompt = f"{system}\n\n{prompt}"

        result = subprocess.run(
            ["litert-lm", "run", LITERT_MODEL, "--prompt", full_prompt, "-b", backend],
            capture_output=True,
            text=True,
            timeout=120,
        )
        t1 = time.time()

        output = result.stdout.strip()
        # Estimate tokens (rough: ~4 chars per token)
        tokens = len(output) // 4
        tok_per_sec = tokens / (t1 - t0) if (t1 - t0) > 0 else 0

        return {
            "success": result.returncode == 0,
            "time_s": round(t1 - t0, 3),
            "output": output,
            "tokens": tokens,
            "tok_per_sec": round(tok_per_sec, 1),
            "error": result.stderr if result.returncode != 0 else None,
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Timeout", "time_s": 120}
    except Exception as e:
        return {"success": False, "error": str(e), "time_s": round(time.time() - t0, 3)}


def check_json_quality(output: str) -> tuple:
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
        match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
                fields = len([v for v in data.values() if v and v != [] and v != ""])
                return True, fields
            except:
                pass
    return False, 0


def main():
    print("=" * 70)
    print("LiteRT-LM vs llama-server Benchmark")
    print("=" * 70)
    print("\nChecking servers...")

    llama_ok = check_llama_server()
    litert_ok = check_litert()

    if not llama_ok and not litert_ok:
        print("\nNo backends available. Please start at least one.")
        sys.exit(1)

    results = {"llama_server": [], "litert_cpu": [], "litert_gpu": []}

    print("\n" + "=" * 70)
    print("Running benchmarks...")
    print("=" * 70)

    for prompt_info in PROMPTS:
        name = prompt_info["name"]
        prompt = prompt_info["prompt"]
        system = prompt_info.get("system")
        max_tokens = prompt_info["max_tokens"]

        print(f"\n--- {name} (max_tokens={max_tokens}) ---")

        # Test llama-server
        if llama_ok:
            print(f"  llama-server:")
            times = []
            for i in range(NUM_RUNS):
                r = run_llama_server(prompt, system, max_tokens)
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
                    "warm_time": times[-1]["time_s"],
                    "json_ok": json_ok,
                    "json_fields": fields,
                })

        # Test LiteRT-LM GPU
        if litert_ok:
            print(f"  LiteRT-LM (GPU):")
            times = []
            for i in range(NUM_RUNS):
                r = run_litert(prompt, system, max_tokens, backend="gpu")
                times.append(r)
                status = "OK" if r["success"] else f"FAIL: {r.get('error', '')[:50]}"
                print(f"    Run {i+1}: {r['time_s']:.2f}s, {r.get('tok_per_sec', 0):.1f} tok/s - {status}")

            if times and times[0]["success"]:
                avg_time = sum(t["time_s"] for t in times if t["success"]) / len([t for t in times if t["success"]])
                avg_tps = sum(t.get("tok_per_sec", 0) for t in times if t["success"]) / len([t for t in times if t["success"]])
                json_ok, fields = check_json_quality(times[-1].get("output", "")) if "JSON" in name else (None, None)
                results["litert_gpu"].append({
                    "prompt": name,
                    "avg_time": round(avg_time, 3),
                    "avg_tok_per_sec": round(avg_tps, 1),
                    "cold_time": times[0]["time_s"],
                    "warm_time": times[-1]["time_s"],
                    "json_ok": json_ok,
                    "json_fields": fields,
                })

            # Test LiteRT-LM CPU
            print(f"  LiteRT-LM (CPU):")
            times = []
            for i in range(NUM_RUNS):
                r = run_litert(prompt, system, max_tokens, backend="cpu")
                times.append(r)
                status = "OK" if r["success"] else f"FAIL: {r.get('error', '')[:50]}"
                print(f"    Run {i+1}: {r['time_s']:.2f}s, {r.get('tok_per_sec', 0):.1f} tok/s - {status}")

            if times and times[0]["success"]:
                avg_time = sum(t["time_s"] for t in times if t["success"]) / len([t for t in times if t["success"]])
                avg_tps = sum(t.get("tok_per_sec", 0) for t in times if t["success"]) / len([t for t in times if t["success"]])
                json_ok, fields = check_json_quality(times[-1].get("output", "")) if "JSON" in name else (None, None)
                results["litert_cpu"].append({
                    "prompt": name,
                    "avg_time": round(avg_time, 3),
                    "avg_tok_per_sec": round(avg_tps, 1),
                    "cold_time": times[0]["time_s"],
                    "warm_time": times[-1]["time_s"],
                    "json_ok": json_ok,
                    "json_fields": fields,
                })

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    print(f"\n{'Prompt':<25} {'Backend':<18} {'Avg Time':>10} {'Avg tok/s':>12} {'Cold':>8} {'Warm':>8} {'JSON':>8}")
    print("-" * 95)

    for prompt_info in PROMPTS:
        name = prompt_info["name"]
        for backend, data in results.items():
            matching = [r for r in data if r["prompt"] == name]
            if matching:
                r = matching[0]
                json_str = ""
                if r["json_ok"] is not None:
                    json_str = f"{'OK' if r['json_ok'] else 'FAIL'}({r['json_fields']})"
                print(f"{name:<25} {backend:<18} {r['avg_time']:>9.2f}s {r['avg_tok_per_sec']:>11.1f} {r['cold_time']:>7.2f}s {r['warm_time']:>7.2f}s {json_str:>8}")

    # Winner analysis
    if results["llama_server"] and results["litert_gpu"]:
        print("\n--- Speed Comparison ---")
        for prompt_info in PROMPTS:
            name = prompt_info["name"]
            llama_r = next((r for r in results["llama_server"] if r["prompt"] == name), None)
            litert_r = next((r for r in results["litert_gpu"] if r["prompt"] == name), None)
            if llama_r and litert_r:
                speedup = llama_r["avg_time"] / litert_r["avg_time"] if litert_r["avg_time"] > 0 else 0
                winner = "LiteRT-GPU" if speedup > 1 else "llama-server"
                print(f"  {name}: {winner} wins ({speedup:.2f}x {'faster' if speedup > 1 else 'slower'})")


if __name__ == "__main__":
    main()
