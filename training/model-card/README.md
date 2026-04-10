---
license: gemma
base_model: google/gemma-4-E4B-it
tags:
  - healthcare
  - clinical-decision-support
  - ncd
  - diabetes
  - hypertension
  - medical
  - unsloth
  - lora
  - gguf
datasets:
  - samwell/synthea-ncd-instructions
language:
  - en
pipeline_tag: text-generation
library_name: transformers
---

# NCD Risk Assessment Model (Gemma 4 E4B Fine-tuned)

A fine-tuned Gemma 4 E4B model for predicting **Non-Communicable Disease (NCD) risk** - specifically Type 2 Diabetes and Hypertension - from patient clinical data.

## Model Description

This model was fine-tuned on 49,214 synthetic patient records to provide clinical decision support for NCD screening in resource-limited settings, particularly designed for deployment in Ghana and similar healthcare contexts.

| Attribute | Value |
|-----------|-------|
| Base Model | `google/gemma-4-E4B-it` |
| Fine-tuning Method | QLoRA (4-bit) with Unsloth |
| LoRA Rank | 32 |
| Training Data | 39,371 examples |
| Final Loss | 0.1842 |
| Training Time | 100 minutes (H200 GPU) |

## Intended Use

**Primary Use Case:** Clinical Decision Support (CDS) for NCD risk screening

**Target Users:**
- Healthcare workers in primary care settings
- Community health workers conducting NCD screenings
- EHR systems (e.g., OpenMRS/HopeOS) for automated risk assessment

**Input:** Patient demographics, vitals, and lab values
**Output:** Structured risk assessment with clinical reasoning

## Model Files

| File | Format | Size | Use Case |
|------|--------|------|----------|
| `adapter_model.safetensors` | LoRA | ~340MB | Fine-tuning, merging |
| `ncd-gemma4-q4_k_m.gguf` | GGUF | ~2.5GB | Local inference (llama.cpp, Ollama) |

## How to Use

### With Transformers + PEFT (LoRA)

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

# Load base model
base_model = AutoModelForCausalLM.from_pretrained("google/gemma-4-E4B-it")
tokenizer = AutoTokenizer.from_pretrained("google/gemma-4-E4B-it")

# Load LoRA adapter
model = PeftModel.from_pretrained(base_model, "samwell/ncd-gemma4-e4b-lora")

# Inference
prompt = """Based on the following patient record, assess the risk of Type 2 diabetes and hypertension.

Patient: 55yo Male
Vitals: BP 152/94 mmHg, BMI 31.2
Labs: Glucose 126 mg/dL, HbA1c 6.4%
Active conditions: Prediabetes"""

inputs = tokenizer(prompt, return_tensors="pt")
outputs = model.generate(**inputs, max_new_tokens=512)
print(tokenizer.decode(outputs[0]))
```

### With llama.cpp (GGUF)

```bash
# Download GGUF
huggingface-cli download samwell/ncd-gemma4-e4b-lora ncd-gemma4-q4_k_m.gguf

# Run inference
./llama-cli -m ncd-gemma4-q4_k_m.gguf -p "Patient: 45yo Female, BP 140/90..."
```

### With Ollama

```bash
# Create model
echo 'FROM ./ncd-gemma4-q4_k_m.gguf' > Modelfile
ollama create ncd-cds -f Modelfile

# Run
ollama run ncd-cds "Patient: 45yo Female, BP 140/90..."
```

## Example Output

**Input:**
```
Patient: 55yo Male
Vitals: BP 152/94 mmHg, BMI 31.2
Labs: Glucose 126 mg/dL, HbA1c 6.4%
Active conditions: Prediabetes
```

**Output:**
```
## Risk Assessment

**Type 2 Diabetes: MODERATE**
- HbA1c 6.4% (prediabetes range 5.7-6.4%)
- BMI 31.2 (obese)
- Age 55 years (≥45 increases risk)

**Hypertension: HIGH**
- BP 152/94 mmHg (Stage 2 Hypertension)
- Systolic ≥140 or Diastolic ≥90 confirms diagnosis

## Recommendations

1. **Lifestyle modifications**: Weight loss, DASH diet, sodium reduction
2. **Blood pressure monitoring**: Home BP monitoring recommended
3. **Lab follow-up**: Repeat HbA1c in 3 months
4. **Consider referral**: If BP remains elevated, initiate antihypertensive therapy
```

## Training Details

### Dataset

- **Source:** Synthea synthetic patient generator
- **Size:** 49,214 examples (39,371 train / 4,921 val / 4,922 test)
- **Format:** Instruction-tuning (instruction/input/output)
- **Dataset:** [`samwell/synthea-ncd-instructions`](https://huggingface.co/datasets/samwell/synthea-ncd-instructions)

### Training Configuration

```python
# Model
MODEL_NAME = "google/gemma-4-E4B-it"
MAX_SEQ_LENGTH = 2048
LOAD_IN_4BIT = True  # QLoRA

# LoRA
LORA_R = 32
LORA_ALPHA = 32
TARGET_MODULES = ["q_proj", "k_proj", "v_proj", "o_proj",
                  "gate_proj", "up_proj", "down_proj"]

# Training
BATCH_SIZE = 8
GRADIENT_ACCUMULATION = 2  # Effective batch = 16
LEARNING_RATE = 2e-4
NUM_EPOCHS = 3
```

### Training Curve

- Initial loss: 1.71
- Final loss: 0.1842
- Training time: 100 minutes on NVIDIA H200 (80GB)

## Limitations

1. **Synthetic data only:** Trained on Synthea-generated data, not real patient records
2. **Limited NCDs:** Currently only assesses diabetes and hypertension
3. **Not a diagnostic tool:** Intended for screening support, not clinical diagnosis
4. **Requires clinical validation:** Must be validated by healthcare professionals before clinical use

## Ethical Considerations

- **Not FDA/CE approved** for clinical diagnosis
- Should be used as **decision support**, not replacement for clinical judgment
- Predictions should be **reviewed by qualified healthcare providers**
- Model may reflect biases in training data

## Citation

```bibtex
@misc{ncd-gemma4-2026,
  author = {HopeOS Team},
  title = {NCD Risk Assessment Model: Fine-tuned Gemma 4 for Diabetes and Hypertension Prediction},
  year = {2026},
  publisher = {HuggingFace},
  url = {https://huggingface.co/samwell/ncd-gemma4-e4b-lora}
}
```

## Related Resources

- **Dataset:** [samwell/synthea-ncd-instructions](https://huggingface.co/datasets/samwell/synthea-ncd-instructions)
- **Base Model:** [google/gemma-4-E4B-it](https://huggingface.co/google/gemma-4-E4B-it)
- **Training Library:** [Unsloth](https://github.com/unslothai/unsloth)

## License

This model is released under the [Gemma license](https://ai.google.dev/gemma/terms).
