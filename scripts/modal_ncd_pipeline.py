"""End-to-end Modal pipeline to ship the NCD fine-tune to Ollama-ready GGUFs.

Pipeline (single H200 job, ~30-45 minutes):
    1. Pull the LoRA adapter (samwell/ncd-gemma4-e4b-lora) from HF.
    2. Merge it into base Gemma 4 E4B-it via Unsloth (`save_pretrained_merged`).
    3. Convert the merged HF model to GGUF f16.
    4. Quantize to IQ2_M, Q3_K_S, and Q4_K_M.
    5. (Optional eval) Run all 4 models — base + 3 quants — over N test patients
       from training/data/test.jsonl and print a comparison table.
    6. Push all 3 GGUFs to HF (samwell/ncd-gemma4-e4b-gguf).
    7. Also persist them on a Modal volume so they can be pulled via `modal volume get`.

Run:
    modal run scripts/modal_ncd_pipeline.py

To skip the eval pass (faster, cheaper):
    modal run scripts/modal_ncd_pipeline.py --no-eval

Edit ADAPTER_REPO / GGUF_REPO / BASE_MODEL at the top of this file if the
HF namespaces or model versions differ from defaults.
"""
from __future__ import annotations

import modal

# ---------------------------------------------------------------------------
# Configuration — edit these if your HF repo names differ.
# ---------------------------------------------------------------------------
ADAPTER_REPO = "samwell/ncd-gemma4-e4b-lora"          # source LoRA adapter on HF
BASE_MODEL = "google/gemma-4-E4B-it"                   # base model the adapter was trained on (per adapter_config.json)
GGUF_REPO = "samwell/ncd-gemma4-e4b-gguf"             # target HF repo for the GGUFs
HF_SECRET_NAME = "huggingface-secret"                  # Modal secret holding HF_TOKEN
QUANT_TYPES = ["Q3_K_S", "Q4_K_M", "Q5_K_M"]          # K-quants are robust to imatrix gaps; IQ2_M was dropped because it needs imatrix on every tensor
EVAL_SAMPLE_SIZE = 20                                  # how many test patients to score per model

# ---------------------------------------------------------------------------
# Modal app + image. Unsloth + llama.cpp + HF hub in one container.
# Note: llama.cpp is built inside the image so we always have `llama-quantize`.
# ---------------------------------------------------------------------------
app = modal.App("hopeos-ncd-pipeline")

image = (
    modal.Image.from_registry("nvidia/cuda:12.4.1-devel-ubuntu22.04", add_python="3.11")
    .apt_install("git", "build-essential", "cmake", "curl", "wget")
    .pip_install(
        "unsloth",
        "transformers>=4.46",
        "accelerate",
        "huggingface_hub[cli]",
        "sentencepiece",
        "protobuf",
        "datasets",
        # gguf: required by convert_hf_to_gguf.py. Installed explicitly so we
        # don't pull the llama.cpp requirements file, which downgrades torch
        # and transformers and breaks the Unsloth merge step.
        "gguf",
    )
    .run_commands(
        # Build llama.cpp CPU-only. CUDA build fails at image-build time because
        # libcuda.so.1 (the driver runtime) is only present on GPU machines.
        # llama-imatrix: generates the importance matrix required by I-quants (IQ2_M).
        # llama-quantize: applies quantization with or without imatrix.
        "git clone --depth 1 https://github.com/ggerganov/llama.cpp /opt/llama.cpp",
        "cd /opt/llama.cpp && cmake -B build && cmake --build build --config Release -j --target llama-quantize llama-imatrix",
    )
)

# Persistent volume so we can pull the artifacts back to local with `modal volume get`.
vol = modal.Volume.from_name("hopeos-ncd-artifacts", create_if_missing=True)

VOLUME_PATH = "/artifacts"


@app.function(
    image=image,
    gpu="H200",
    timeout=60 * 60 * 2,  # 2h ceiling — typical run is 30-45 min
    secrets=[modal.Secret.from_name(HF_SECRET_NAME)],
    volumes={VOLUME_PATH: vol},
)
def merge_quantize_and_upload(run_eval: bool = False) -> dict:
    """Merge LoRA → GGUF → quantize → (eval) → upload."""
    import json
    import os
    import shutil
    import subprocess
    import time
    from pathlib import Path

    from huggingface_hub import HfApi, login

    # Tolerate common env var names — different Modal secrets use different keys.
    hf_token = (
        os.environ.get("HF_TOKEN")
        or os.environ.get("HUGGINGFACE_TOKEN")
        or os.environ.get("HUGGING_FACE_TOKEN")
        or os.environ.get("HUGGINGFACE_HUB_TOKEN")
    )
    if not hf_token:
        raise RuntimeError(
            f"No HF token found in env. The Modal secret '{HF_SECRET_NAME}' must "
            "export HF_TOKEN (or HUGGINGFACE_TOKEN). Inspect with: "
            f"modal secret list  and recreate with: modal secret create {HF_SECRET_NAME} HF_TOKEN=hf_..."
        )
    login(token=hf_token)

    work = Path("/work")
    work.mkdir(exist_ok=True)
    artifacts = Path(VOLUME_PATH)
    artifacts.mkdir(exist_ok=True)

    timings: dict[str, float] = {}

    # -----------------------------------------------------------------------
    # 1. Merge adapter into base
    # -----------------------------------------------------------------------
    print(f"\n[1/5] Merging {ADAPTER_REPO} into {BASE_MODEL} ...")
    t0 = time.time()
    from unsloth import FastModel

    model, tokenizer = FastModel.from_pretrained(
        model_name=ADAPTER_REPO,
        max_seq_length=2048,
        load_in_4bit=False,
        dtype=None,
    )
    merged_dir = work / "merged"
    model.save_pretrained_merged(str(merged_dir), tokenizer, save_method="merged_16bit")
    timings["merge_s"] = round(time.time() - t0, 1)
    print(f"   merged in {timings['merge_s']}s -> {merged_dir}")

    # Free GPU memory before CPU-bound conversion/quantize steps
    del model
    import gc; gc.collect()
    try:
        import torch; torch.cuda.empty_cache()
    except Exception:
        pass

    # -----------------------------------------------------------------------
    # 2. Convert merged HF model -> GGUF f16
    # -----------------------------------------------------------------------
    print("\n[2/5] Converting merged model to GGUF f16 ...")
    t0 = time.time()
    f16_path = work / "hopeos-ncd-gemma4-f16.gguf"
    subprocess.run(
        [
            "python", "/opt/llama.cpp/convert_hf_to_gguf.py",
            str(merged_dir),
            "--outfile", str(f16_path),
            "--outtype", "f16",
        ],
        check=True,
    )
    timings["convert_s"] = round(time.time() - t0, 1)
    print(f"   converted in {timings['convert_s']}s -> {f16_path} ({f16_path.stat().st_size / 1e9:.2f} GB)")

    # -----------------------------------------------------------------------
    # 3a. Generate a domain-specific importance matrix on NCD clinical text.
    # Required by I-quants (IQ2_M). Also improves K-quant quality. Calibration
    # text is pulled from the published NCD training set so the imatrix
    # preserves the weights our actual task cares about.
    # -----------------------------------------------------------------------
    print("\n[3a/5] Building NCD-calibrated imatrix ...")
    t0 = time.time()

    from huggingface_hub import hf_hub_download

    train_path = hf_hub_download(
        repo_id="samwell/synthea-ncd-instructions",
        repo_type="dataset",
        filename="train.jsonl",
    )
    cal_path = work / "imatrix-calibration.txt"
    n_cal = 0
    # Larger corpus = more chunks = better imatrix coverage across all tensors.
    # 300 NCD samples × ~600 tokens each ≈ 180k tokens, comfortably enough for
    # ~250+ chunks at the default 512-token chunk size.
    with open(cal_path, "w") as out, open(train_path) as f:
        for line in f:
            if n_cal >= 300:
                break
            sample = json.loads(line)
            out.write(
                f"{sample['instruction']}\n\n{sample['input']}\n\n{sample['output']}\n\n"
            )
            n_cal += 1

    imatrix_path = work / "imatrix.dat"
    # Let llama-imatrix consume the whole corpus (no --chunks cap) so every
    # tensor gets enough activation signal for low-bit quantization.
    subprocess.run(
        [
            "/opt/llama.cpp/build/bin/llama-imatrix",
            "-m", str(f16_path),
            "-f", str(cal_path),
            "-o", str(imatrix_path),
        ],
        check=True,
    )
    timings["imatrix_s"] = round(time.time() - t0, 1)
    print(f"   imatrix built in {timings['imatrix_s']}s from {n_cal} NCD samples")

    # -----------------------------------------------------------------------
    # 3b. Quantize each requested format using the NCD-calibrated imatrix.
    # -----------------------------------------------------------------------
    print("\n[3b/5] Quantizing with NCD imatrix ...")
    quantize_bin = "/opt/llama.cpp/build/bin/llama-quantize"
    quant_paths: dict[str, Path] = {}
    failed_quants: list[str] = []
    for qt in QUANT_TYPES:
        out_path = work / f"hopeos-ncd-gemma4-{qt}.gguf"
        t0 = time.time()
        try:
            subprocess.run(
                [
                    quantize_bin,
                    "--imatrix", str(imatrix_path),
                    str(f16_path), str(out_path), qt,
                ],
                check=True,
            )
            timings[f"quant_{qt}_s"] = round(time.time() - t0, 1)
            size_gb = out_path.stat().st_size / 1e9
            print(f"   {qt}: {timings[f'quant_{qt}_s']}s, {size_gb:.2f} GB -> {out_path.name}")
            quant_paths[qt] = out_path
        except subprocess.CalledProcessError as e:
            # Don't abort the whole job if one quant fails. Log and move on
            # so the other quants still get produced and uploaded.
            print(f"   {qt}: FAILED ({e}). Skipping and continuing.")
            failed_quants.append(qt)

    if not quant_paths:
        raise RuntimeError(f"All quantizations failed: {failed_quants}")

    # -----------------------------------------------------------------------
    # 4. Optional eval pass — score each quant vs base on real test patients
    # -----------------------------------------------------------------------
    eval_results = {}
    if run_eval:
        print(f"\n[4/5] Eval pass — {EVAL_SAMPLE_SIZE} test patients per model ...")
        eval_results = _run_eval(
            quant_paths=quant_paths,
            sample_size=EVAL_SAMPLE_SIZE,
        )
        with open(work / "eval_results.json", "w") as f:
            json.dump(eval_results, f, indent=2)
        _print_eval_table(eval_results)
    else:
        print("\n[4/5] Eval pass skipped (--no-eval)")

    # -----------------------------------------------------------------------
    # 5. Push GGUFs to HF + persist on Modal volume
    # -----------------------------------------------------------------------
    print(f"\n[5/5] Uploading to HF ({GGUF_REPO}) and persisting to volume ...")
    api = HfApi()
    api.create_repo(repo_id=GGUF_REPO, repo_type="model", exist_ok=True)

    # README so the HF repo isn't bare
    readme = _make_readme(timings, eval_results, run_eval)
    (work / "README.md").write_text(readme)
    api.upload_file(
        path_or_fileobj=str(work / "README.md"),
        path_in_repo="README.md",
        repo_id=GGUF_REPO,
        repo_type="model",
    )

    uploaded = []
    # Upload the NCD-calibrated imatrix alongside the GGUFs so anyone can
    # re-quantize from f16 with the same domain calibration.
    if imatrix_path.exists():
        api.upload_file(
            path_or_fileobj=str(imatrix_path),
            path_in_repo="imatrix-ncd.dat",
            repo_id=GGUF_REPO,
            repo_type="model",
        )
        shutil.copy(imatrix_path, artifacts / "imatrix-ncd.dat")
        uploaded.append("imatrix-ncd.dat")

    for qt, path in quant_paths.items():
        print(f"   uploading {path.name} ...")
        api.upload_file(
            path_or_fileobj=str(path),
            path_in_repo=path.name,
            repo_id=GGUF_REPO,
            repo_type="model",
        )
        uploaded.append(path.name)
        # Also copy into the Modal volume for `modal volume get`
        shutil.copy(path, artifacts / path.name)

    # Drop a Modelfile template next to the GGUFs for quick Ollama registration
    modelfile = _make_modelfile(QUANT_TYPES[0])  # default to first quant (IQ2_M)
    (artifacts / "Modelfile.ncd").write_text(modelfile)
    api.upload_file(
        path_or_fileobj=str(artifacts / "Modelfile.ncd"),
        path_in_repo="Modelfile.ncd",
        repo_id=GGUF_REPO,
        repo_type="model",
    )

    vol.commit()  # persist volume changes

    print("\n✅ Done.")
    print(f"   HF repo:     https://huggingface.co/{GGUF_REPO}")
    print(f"   Volume:      modal volume get hopeos-ncd-artifacts /")
    print(f"   Files:       {', '.join(uploaded)}")

    return {
        "hf_repo": GGUF_REPO,
        "uploaded": uploaded,
        "timings_s": timings,
        "eval_results": eval_results,
    }


# ---------------------------------------------------------------------------
# Eval helpers — load each GGUF with llama-cli and score against test.jsonl.
# ---------------------------------------------------------------------------
def _run_eval(quant_paths, sample_size: int) -> dict:
    """Eval each quant using Ollama (resolves CUDA libs at runtime, unlike a
    build-time CUDA llama.cpp). Starts ollama serve, registers each GGUF,
    runs N test patients through each, scores against gold output."""
    import json
    import os
    import re
    import subprocess
    import time
    from pathlib import Path

    import httpx
    from huggingface_hub import hf_hub_download

    print("   fetching test set ...")
    test_path = hf_hub_download(
        repo_id="samwell/synthea-ncd-instructions",
        repo_type="dataset",
        filename="test.jsonl",
    )
    samples = []
    with open(test_path) as f:
        for line in f:
            samples.append(json.loads(line))
            if len(samples) >= sample_size:
                break

    # Boot ollama serve as a background process
    print("   starting ollama serve ...")
    os.environ["OLLAMA_MODELS"] = "/root/.ollama/models"
    ollama_proc = subprocess.Popen(
        ["ollama", "serve"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    # Wait for ollama to come up
    client = httpx.Client(base_url="http://localhost:11434", timeout=300.0)
    for _ in range(30):
        try:
            client.get("/api/tags")
            break
        except Exception:
            time.sleep(1)
    else:
        ollama_proc.terminate()
        raise RuntimeError("ollama serve never came up")

    def extract_risks(text: str) -> dict:
        out = {}
        for m in re.finditer(r"\*\*([^:*]+):\s*(LOW|MODERATE|HIGH|DIAGNOSED)\*\*", text, re.I):
            disease = m.group(1).strip().lower()
            if "diabetes" in disease:
                out["diabetes"] = m.group(2).upper()
            elif "hypertension" in disease or "blood pressure" in disease:
                out["hypertension"] = m.group(2).upper()
        return out

    results: dict = {}
    try:
        for qt, gguf in quant_paths.items():
            print(f"   registering {qt} with ollama ...")
            mf_path = gguf.parent / f"Modelfile.{qt}"
            mf_path.write_text(f"FROM {gguf}\nPARAMETER temperature 0.2\n")
            model_name = f"hopeos-ncd-{qt.lower().replace('_', '-')}"
            subprocess.run(["ollama", "create", model_name, "-f", str(mf_path)], check=True)

            print(f"   evaluating {qt} on {len(samples)} patients ...")
            correct = {"diabetes": 0, "hypertension": 0}
            present = {"diabetes": 0, "hypertension": 0}
            any_format = 0
            latencies = []

            for sample in samples:
                prompt = f"{sample['instruction']}\n\n{sample['input']}"
                gold = extract_risks(sample["output"])

                t0 = time.time()
                resp = client.post("/api/chat", json={
                    "model": model_name,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                    "options": {"temperature": 0.2, "num_predict": 400},
                    "keep_alive": "5m",
                })
                latencies.append(time.time() - t0)
                output = resp.json().get("message", {}).get("content", "")

                if "Risk Assessment" in output:
                    any_format += 1
                predicted = extract_risks(output)
                for disease in ("diabetes", "hypertension"):
                    if disease in gold:
                        present[disease] += 1
                        if predicted.get(disease) == gold[disease]:
                            correct[disease] += 1

            results[qt] = {
                "size_gb": round(Path(gguf).stat().st_size / 1e9, 2),
                "samples": len(samples),
                "format_compliance_pct": round(100 * any_format / len(samples), 1),
                "diabetes_accuracy_pct": round(100 * correct["diabetes"] / max(present["diabetes"], 1), 1),
                "hypertension_accuracy_pct": round(100 * correct["hypertension"] / max(present["hypertension"], 1), 1),
                "diabetes_n": present["diabetes"],
                "hypertension_n": present["hypertension"],
                "mean_latency_s": round(sum(latencies) / len(latencies), 1),
            }
            # Free memory between models
            client.post("/api/generate", json={"model": model_name, "keep_alive": 0})
    finally:
        ollama_proc.terminate()

    return results


def _print_eval_table(results: dict) -> None:
    if not results:
        return
    print("\n   --- Quant Comparison ---")
    cols = ["quant", "size_gb", "format%", "dx%", "htn%", "latency_s"]
    print("   " + " | ".join(f"{c:>12}" for c in cols))
    print("   " + "-+-".join("-" * 12 for _ in cols))
    for qt, r in results.items():
        row = [
            qt,
            f"{r['size_gb']:.2f}",
            f"{r['format_compliance_pct']:.0f}",
            f"{r['diabetes_accuracy_pct']:.0f} (n={r['diabetes_n']})",
            f"{r['hypertension_accuracy_pct']:.0f} (n={r['hypertension_n']})",
            f"{r['mean_latency_s']:.1f}",
        ]
        print("   " + " | ".join(f"{c:>12}" for c in row))


def _make_modelfile(default_quant: str) -> str:
    return f"""# Ollama Modelfile for the fine-tuned HopeOS NCD model.
# Register with: ollama create hopeos-ncd-gemma4 -f Modelfile.ncd
FROM ./hopeos-ncd-gemma4-{default_quant}.gguf

PARAMETER temperature 0.2
PARAMETER num_predict 600
"""


def _make_readme(timings: dict, eval_results: dict, ran_eval: bool) -> str:
    eval_md = ""
    if ran_eval and eval_results:
        eval_md = "\n## Eval Results\n\n"
        eval_md += "| Quant | Size | Format Compliance | T2DM Accuracy | HTN Accuracy | Latency |\n"
        eval_md += "|-------|------|-------------------|---------------|--------------|----------|\n"
        for qt, r in eval_results.items():
            eval_md += (
                f"| {qt} | {r['size_gb']:.2f} GB | {r['format_compliance_pct']:.0f}% | "
                f"{r['diabetes_accuracy_pct']:.0f}% (n={r['diabetes_n']}) | "
                f"{r['hypertension_accuracy_pct']:.0f}% (n={r['hypertension_n']}) | "
                f"{r['mean_latency_s']:.1f}s |\n"
            )

    return f"""---
license: apache-2.0
base_model: {BASE_MODEL}
tags:
  - gemma
  - gguf
  - quantized
  - ncd
  - clinical
  - hopeos
---

# HopeOS NCD Gemma 4 — Quantized GGUF

Merged + quantized builds of [`{ADAPTER_REPO}`]({"https://huggingface.co/" + ADAPTER_REPO})
for offline edge deployment via [Ollama](https://ollama.com) and [llama.cpp](https://github.com/ggerganov/llama.cpp).

This model is task-specific: **NCD risk assessment for Type 2 diabetes and hypertension**
from a structured patient snapshot. It is used by the HopeOS EHR's clinical decision
support accordion on the patient chart.

## Files

{chr(10).join(f"- `hopeos-ncd-gemma4-{qt}.gguf`" for qt in QUANT_TYPES)}
- `Modelfile.ncd` — Ollama Modelfile (points at the IQ2_M quant by default)

## Usage with Ollama

```bash
# Download a quant (e.g. IQ2_M)
huggingface-cli download {GGUF_REPO} hopeos-ncd-gemma4-IQ2_M.gguf --local-dir .
huggingface-cli download {GGUF_REPO} Modelfile.ncd --local-dir .

# Register with Ollama
ollama create hopeos-ncd-gemma4 -f Modelfile.ncd
```

## Pipeline Timings

```
{chr(10).join(f"{k}: {v}s" for k, v in timings.items())}
```
{eval_md}
## Built by

Modal pipeline in [HopeOS](https://github.com/samadon1/hopeos): `scripts/modal_ncd_pipeline.py`.
"""


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
@app.local_entrypoint()
def main(eval: bool = False) -> None:
    """Run the full pipeline. Pass --eval to also run the quant comparison pass."""
    result = merge_quantize_and_upload.remote(run_eval=eval)
    print("\nFinal result:")
    print(result)
