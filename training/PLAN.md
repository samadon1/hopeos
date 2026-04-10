# NCD Prediction Model Training Plan

> **Living Document** - Last updated: April 10, 2026

Fine-tuning Gemma 4 E2B on synthetic EHR data to predict non-communicable diseases (hypertension, diabetes) for Ghanaian healthcare settings.

---

## Current Status

```
[###############-----] 75% Complete
```

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Data Generation | ✅ Done | 56,610 patients generated |
| 2. Data Transformation | ✅ Done | 49,214 training examples |
| 3. Fine-tuning | 🟡 In Progress | Training on Colab (T4 GPU) |
| 4. Evaluation | ⏳ Pending | |
| 5. Deployment | ⏳ Pending | |

---

## Progress Log

### Session 3 - April 10, 2026 (Current)

**Completed:**
- [x] Installed and built Synthea
- [x] Created Ghana config files (demographics, zipcodes, providers, names)
- [x] Built `synthea_to_instructions.py` transformation script
- [x] Test run: 122 patients → 100 training examples
- [x] Generated 56,610 synthetic patients
- [x] Transformed to 49,214 training examples (39,371 train / 4,921 val / 4,922 test)
- [x] Created HuggingFace dataset README
- [x] Pushed dataset to HuggingFace: `samwell/synthea-ncd-instructions`
- [x] Created Colab fine-tuning notebook
- [x] Fixed multiple issues (formatting, OOM errors)

**In Progress:**
- [ ] Training Gemma 4 E2B on Colab (~11 hours estimated)
  - Step 53/14,766 at last check
  - Loss: 3.30
  - GPU: T4 (15GB VRAM)

**Decisions Made:**
- Using US Synthea defaults (Ghana config had compatibility issues with timezones/payers)
- Dataset is public on HuggingFace: `samwell/synthea-ncd-instructions`
- **Switched from E4B to E2B** - E4B needs 17GB VRAM, T4 only has 15GB
- Using QLoRA (4-bit) with LoRA r=16, alpha=16
- Batch size 2, gradient accumulation 4 (effective batch = 8)
- Max sequence length 1024 (reduced from 2048 for memory)

**Issues Encountered:**
- Ghana Synthea config failed due to missing timezones.csv and payer system incompatibility
- `%%capture` magic not supported in VS Code Jupyter (removed)
- KeyError 'val' - HuggingFace renamed split to 'validation' (fixed)
- formatting_func needed to return list, not string (fixed)
- **OOM with E4B on T4** - switched to E2B which fits in 8-10GB

### Session 2 - Research Phase

**Completed:**
- [x] Researched Synthea capabilities
- [x] Researched Unsloth + Gemma 4 fine-tuning
- [x] Identified MIMIC-Instr format as reference
- [x] Created initial PLAN.md

**Decisions Made:**
- Gemma 4 E4B (not 31B) - runs on T4, sufficient for task
- QLoRA fine-tuning with Unsloth
- Skip MIMIC credentials - not needed, format is simple

### Session 1 - Initial Discussion

**Completed:**
- [x] Discussed NCD prediction problem
- [x] Identified datasets (Synthea, WHO STEPS, MIMIC)
- [x] Chose approach: synthetic data + instruction tuning

---

## Quick Reference

### Key Commands

```bash
# Generate patients
cd training/synthea
./run_synthea -p 50000 --exporter.csv.export=true

# Transform to training format
python scripts/synthea_to_instructions.py --input synthea/output/csv --output data

# Push to HuggingFace
huggingface-cli upload samwell/synthea-ncd-instructions ./data --repo-type dataset
```

### Key Files

| File | Purpose |
|------|---------|
| `scripts/synthea_to_instructions.py` | CSV → JSONL transformation |
| `notebooks/finetune_gemma4_ncd.ipynb` | Colab training notebook |
| `data/train.jsonl` | Training examples (39,371) |
| `data/val.jsonl` | Validation examples (4,921) |
| `data/test.jsonl` | Test examples (4,922) |
| `data/README.md` | HuggingFace dataset card |
| `synthea-ghana/` | Ghana config (partial, not fully working) |

---

## Overview

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Base Model | Gemma 4 E2B | 2B effective params, fits on T4 (15GB), 128K context |
| Fine-tuning | Unsloth + QLoRA | 8-10GB VRAM, 2x faster training |
| Synthetic Data | Synthea | Open-source patient generator with disease modules |
| Target NCDs | Type 2 Diabetes, Hypertension | Most common NCDs in Ghana |
| Dataset Host | HuggingFace | `samwell/synthea-ncd-instructions` |
| Training Hardware | Google Colab Free (T4) | 15GB VRAM, ~11 hours for full training |

---

## Phase 1: Data Generation

### 1.1 Synthea Setup ✅

```bash
# Clone and build
git clone https://github.com/synthetichealth/synthea.git --depth 1
cd synthea
./gradlew build -x test
```

### 1.2 Ghana Config (Partial) ⚠️

Created but not fully functional due to Synthea's US-centric payer system:

```
training/synthea-ghana/
├── demographics.csv      ✅ Created (10 regions)
├── zipcodes.csv          ✅ Created (24 locations)
├── providers.csv         ✅ Created (25 facilities)
├── names/
│   ├── female_first.txt  ✅ Created (90 names)
│   └── male_first.txt    ✅ Created (80 names)
├── timezones.csv         ✅ Created
└── synthea.properties    ⚠️ Partial (payer issues)
```

**Workaround:** Using US defaults. Disease progression (diabetes, hypertension) is universal.

### 1.3 Generate Patients ✅

```bash
./run_synthea -p 50000 --exporter.csv.export=true --exporter.fhir.export=false
```

**Result:** 56,610 patients generated → 49,214 training examples after filtering

---

## Phase 2: Data Transformation ✅

### 2.1 Transformation Script

`scripts/synthea_to_instructions.py` - Converts Synthea CSV to instruction format.

**Features:**
- Extracts vitals (BP, BMI, HR, weight)
- Extracts labs (glucose, HbA1c, lipids, creatinine)
- Identifies NCD conditions (diabetes, hypertension, prediabetes)
- Generates risk assessments based on clinical guidelines
- Creates train/val/test splits (80/10/10)

### 2.2 Final Results ✅

```
Input:  56,610 patients
Output: 49,214 training examples
  - train.jsonl: 39,371 examples
  - val.jsonl:    4,921 examples
  - test.jsonl:   4,922 examples
```

### 2.3 Example Output

```json
{
  "instruction": "Based on the following patient record, assess the risk of Type 2 diabetes and hypertension...",
  "input": "Patient: 64yo Male\nVitals: BP 103/83 mmHg, BMI 27.4\nLabs: Glucose 80.2 mg/dL, HbA1c 6.2%\nActive conditions: Prediabetes, Essential Hypertension",
  "output": "## Risk Assessment\n\n**Type 2 Diabetes: MODERATE**\n- HbA1c 6.2% (prediabetes range)..."
}
```

---

## Phase 3: Fine-Tuning 🟡

### 3.1 Environment (Colab)

```python
!pip install -q unsloth
!pip install -q --no-deps trl peft accelerate bitsandbytes
```

### 3.2 Training Configuration (Working)

```python
# Model
MODEL_NAME = "google/gemma-4-E2B-it"  # E2B fits on T4, E4B does NOT
MAX_SEQ_LENGTH = 1024
LOAD_IN_4BIT = True  # QLoRA

# LoRA
LORA_R = 16
LORA_ALPHA = 16
TARGET_MODULES = ["q_proj", "k_proj", "v_proj", "o_proj",
                  "gate_proj", "up_proj", "down_proj"]

# Training
BATCH_SIZE = 2
GRADIENT_ACCUMULATION = 4  # Effective batch = 8
LEARNING_RATE = 2e-4
NUM_EPOCHS = 3
```

### 3.3 Training Progress

```
==((====))==  Unsloth - 2x faster free finetuning | Num GPUs used = 1
   \\   /|    Num examples = 39,371 | Num Epochs = 3 | Total steps = 14,766
O^O/ \_/ \    Batch size per device = 2 | Gradient accumulation steps = 4
\        /    Data Parallel GPUs = 1 | Total batch size (2 x 4 x 1) = 8
 "-____-"     Trainable parameters = 31,039,488 of 5,154,217,504 (0.60% trained)
```

**Status:** Training in progress (~11 hours total)

### 3.4 Hardware Requirements

| Option | GPU | VRAM | Model | Est. Time |
|--------|-----|------|-------|-----------|
| Colab Free | T4 | 15GB | E2B only | ~11 hrs |
| Colab Pro | A100 | 40GB | E2B or E4B | ~2-3 hrs |
| Local RTX 3090 | 24GB | E2B or E4B | ~4-6 hrs |

**Note:** Gemma 4 E4B requires ~17GB VRAM with QLoRA. T4 (15GB) can only run E2B.

---

## Phase 4: Evaluation ⏳

### 4.1 Metrics

- [ ] Risk classification accuracy (HIGH/MODERATE/LOW)
- [ ] Recommendation appropriateness
- [ ] Hallucination rate
- [ ] Clinical validity (expert review)

### 4.2 Validation Checklist

- [ ] Model correctly identifies high-risk patients
- [ ] No over-diagnosis (false positives)
- [ ] Recommendations align with guidelines
- [ ] No hallucinated medications or values
- [ ] **Validated by clinician** (CRITICAL)

---

## Phase 5: Deployment ⏳

### 5.1 Export Options

| Target | Format | Notes |
|--------|--------|-------|
| HuggingFace | LoRA adapters | For fine-tuning |
| Mobile (HopeOS) | GGUF (Q4_K_M) | llama.cpp compatible |
| Server | vLLM / TGI | API endpoint |

### 5.2 Integration with HopeOS

TBD - depends on inference requirements.

---

## Directory Structure

```
training/
├── PLAN.md                    # This file (living document)
├── synthea/                   # Synthea installation
│   └── output/csv/            # Generated patient data
├── synthea-ghana/             # Ghana config (partial)
│   ├── demographics.csv
│   ├── zipcodes.csv
│   ├── providers.csv
│   └── names/
├── scripts/
│   └── synthea_to_instructions.py
├── data/                      # Training data
│   ├── README.md              # HuggingFace dataset card
│   ├── train.jsonl
│   ├── val.jsonl
│   └── test.jsonl
├── checkpoints/               # (future) Training checkpoints
└── models/                    # (future) Final models
```

---

## Open Questions

1. **Ghana demographics**: Should we create a custom Synthea fork with proper Ghana support?
2. **Multilingual**: Add Twi/French translations for West African deployment?
3. **Additional NCDs**: Expand to CKD, CVD, obesity?
4. **Longitudinal**: Multi-visit patient trajectories?

---

## Resources

### Documentation
- [Gemma 4 E2B](https://huggingface.co/google/gemma-4-E2B-it) (what we're using)
- [Gemma 4 E4B](https://huggingface.co/google/gemma-4-E4B-it) (needs >15GB VRAM)
- [Unsloth Docs](https://unsloth.ai/docs/models/gemma-4/train)
- [Synthea Wiki](https://github.com/synthetichealth/synthea/wiki)

### Clinical Guidelines
- [ADA Diabetes Standards](https://diabetesjournals.org/care)
- [ACC/AHA Hypertension Guidelines](https://www.acc.org/guidelines)
- [WHO STEPS Ghana](https://www.who.int/ncds/surveillance/steps/Ghana_2006.pdf)

### Dataset
- HuggingFace: [`samwell/synthea-ncd-instructions`](https://huggingface.co/datasets/samwell/synthea-ncd-instructions) ✅ Live

### Training Notebook
- `training/notebooks/finetune_gemma4_ncd.ipynb` - Google Colab compatible

---

## Next Actions

1. [x] ~~Generate 50K patients~~ ✅ Done (56,610 patients)
2. [x] ~~Transform to instruction format~~ ✅ Done (49,214 examples)
3. [x] ~~Upload to HuggingFace~~ ✅ Done
4. [x] ~~Create Colab notebook~~ ✅ Done
5. [ ] **Wait for training to complete** (~11 hours, running on Colab)
6. [ ] Save trained model (LoRA adapters)
7. [ ] Test inference on test set
8. [ ] Evaluate accuracy and clinical validity
9. [ ] Export to GGUF for mobile deployment (optional)

---

*This is a living document. Update as progress is made.*
