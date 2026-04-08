# EHR Agent Architecture

## Overview

The EHR Agent is an AI-powered clinical assistant that enables healthcare providers to ask natural language questions about patient data and scan documents for automatic patient registration. It uses local Gemma 4 models from Unsloth with native vision capabilities.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HopeOS AI Features                            │
├─────────────────────────────────┬───────────────────────────────────────┤
│       Ask Hope (Chat)           │       Document Scanner                │
│   Natural Language EHR Query    │   Tesseract OCR + AI Parsing          │
└─────────────────────────────────┴───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (port 8000)                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  AI Service (llama-cpp-python)                                   │  │
│  │  Gemma 4 E2B-IT Q8 (4.7 GB) preloaded at startup                │  │
│  │  + Tesseract OCR for document text extraction                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Document Scanner Architecture

### Two-Stage Pipeline (Tesseract OCR + Gemma)

The document scanner uses a **two-stage pipeline** that separates OCR from AI parsing:

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 1. Image     │───►│ 2. Tesseract │───►│ 3. Gemma 4   │───►│ 4. FHIR      │
│    Input     │    │    OCR       │    │    Parsing   │    │    Output    │
│              │    │    (~1s)     │    │    (~10s)    │    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
     Base64              Text              Structured          Patient
     Encoded           Extraction           JSON               Resource
```

**Why Two Stages?**

| Approach | Pros | Cons |
|----------|------|------|
| **Native Vision (single-stage)** | Single step, no OCR dependency | Confused hospital headers with patient names |
| **Tesseract + LLM (two-stage)** | Accurate field extraction, reliable parsing | Two steps, requires Tesseract |

**Decision**: Two-stage pipeline with Tesseract OCR + Gemma text parsing.

Native vision was tested but consistently confused document headers (e.g., "KUMASI TEACHING HOSPITAL") with patient names. Tesseract OCR provides reliable text extraction, and Gemma excels at parsing labeled fields from structured text.

### Document Types Supported

| Document | Fields Extracted | Confidence |
|----------|------------------|------------|
| **Ghana Card** | Name, DOB, Gender, GHA-XXXXXXXXX-X | High |
| **Paper Medical Record** | Name, DOB, Phone, Address, Conditions | Medium-High |
| **Referral Letter** | Name, Referring diagnosis | Medium |

### FHIR R4 Output

Document scanning returns a FHIR R4 Patient resource with confidence scores:

```json
{
  "success": true,
  "document_type": "paper_record",
  "fhir_patient": {
    "resourceType": "Patient",
    "name": [{"family": "Aboagye", "given": ["Kwame", "K."], "_confidence": 0.95}],
    "gender": "male",
    "birthDate": "1982-12-05",
    "telecom": [{"system": "phone", "value": "+233244555199", "_confidence": 0.9}],
    "address": [{"city": "Kumasi", "state": "Ashanti", "_confidence": 0.85}]
  },
  "extracted_data": { /* Legacy format for UI */ }
}
```

---

## Technical Decisions

### 1. Model Selection: Unsloth Gemma 4 E2B-IT Q8

**Decision**: Use Unsloth-optimized Gemma 4 Extended 2B Instruction-Tuned with Q8 quantization.

**Model Details**:
- **E2B** = Extended 2 Billion parameters
- **IT** = Instruction-Tuned (not a reasoning/thinking model by default)
- **Q8_0** = 8-bit quantization (best quality for vision tasks)
- **Size**: 4.7 GB model + 941 MB vision projector
- **Source**: `unsloth/gemma-4-E2B-it-GGUF` (optimized for 2x faster inference)

**Why Q8 over Q4?**

| Quantization | Size | Quality | Use Case |
|--------------|------|---------|----------|
| **Q8_0** | 4.7 GB | **Best** | Vision/OCR tasks (recommended) |
| Q4_K_M | 3.2 GB | Good | Text-only chat |
| Q3_K_M | 3.0 GB | Acceptable | Memory-constrained |

**Decision**: Q8 provides best quality for document reading. Vision tasks benefit from higher precision.

### 2. Direct llama-cpp-python Integration

**Decision**: Use llama-cpp-python directly instead of llama-server sidecar.

**Why direct integration?**

| Approach | Pros | Cons |
|----------|------|------|
| llama-server sidecar | OpenAI-compatible API | Extra process, complexity |
| **llama-cpp-python** | Simple, single process | Direct Python API |

Since we use Tesseract for OCR (not native vision), we don't need the multimodal projector or llama-server. The text model is loaded directly via llama-cpp-python at startup.

**Architecture**:
```
FastAPI (port 8000)
      │
      ├──► Tesseract OCR (text extraction)
      │
      └──► llama-cpp-python (text parsing)
              │
              └── Gemma 4 E2B-IT Q8 (preloaded at startup)
```

**Benefits**:
- Single process (no sidecar management)
- Model preloaded at startup for fast inference
- Simpler deployment

### 4. Table Classification vs. Text-to-SQL (EHR Agent)

**Decision**: Use table classification instead of text-to-SQL for clinical queries.

**Rationale**:

| Approach | Pros | Cons |
|----------|------|------|
| **Text-to-SQL** | Flexible | SQL injection risk, hallucinated columns |
| **Table Classification** | Safe, reliable | Limited to known patterns |

For healthcare, **reliability trumps flexibility**. The AI only classifies which tables to query; actual SQL is predefined and parameterized.

### 5. Software Agent vs. LLM Agent

**Decision**: Python-orchestrated software agent, not LLM-native tool-calling.

**Rationale**:
- Gemma 4 doesn't support native tool-calling
- Python orchestration provides deterministic, auditable flow
- Full control over execution steps

---

## Performance Benchmarks

### Document Scanning (Tesseract OCR + Gemma)

| Configuration | Average | Notes |
|---------------|---------|-------|
| Cold start (model loading) | ~30-60s | First request only |
| **Warm (preloaded model)** | **~12-18s** | Typical extraction time |

Breakdown:
- Tesseract OCR: ~1s
- Gemma text parsing: ~10-15s
- JSON parsing: <1s

### EHR Agent Queries

| Metric | Value | Notes |
|--------|-------|-------|
| Classification latency | 2-5s | Simple JSON output task |
| Data fetch latency | 50-200ms | Indexed SQLite queries |
| Summarization latency | 20-45s | With optimizations |
| Token streaming rate | ~10-15 tokens/sec | Q4_K_M optimized |

---

## GPU Hosting Options

For production deployment, consider GPU hosting for faster inference:

| GPU | VRAM | Expected Time | Cost |
|-----|------|---------------|------|
| Mac M-series (local) | ~8GB shared | ~25s | Free |
| RTX 3090 | 24GB | ~8-12s | ~$0.30-0.40/hr |
| RTX 4090 | 24GB | ~5-8s | ~$0.40-0.50/hr |
| A100 (40GB) | 40GB | ~3-5s | ~$1.10/hr |
| H100 | 80GB | ~2-3s | ~$2-3/hr |

**Serverless Options**:
- **Modal**: ~$0.001-0.01 per inference
- **Replicate**: Host custom models
- **RunPod**: GPU instances on demand

---

## Data Tables (EHR Agent)

The agent can query these EHR tables:

| Table | Data | Example Questions |
|-------|------|-------------------|
| `demographics` | Name, gender, birthdate | "How old is the patient?" |
| `diagnoses` | ICD codes, conditions | "Does the patient have diabetes?" |
| `labs` | Lab results, values | "What's the latest HbA1c?" |
| `vitals` | BP, HR, glucose | "Show me recent blood pressure readings" |
| `medications` | Prescriptions | "What medications is the patient on?" |
| `allergies` | Known allergies | "Any drug allergies?" |
| `encounters` | Visit history | "When was the last visit?" |

---

## Security Considerations

### SQL Injection Prevention
- **No dynamic SQL generation**: All queries use predefined templates
- **Parameterized patient_id**: Only the patient UUID is interpolated
- **Table whitelist**: Only known tables can be queried

### Data Privacy
- **Local inference**: Patient data processed on-device
- **No external API calls**: Model runs via local llama-server
- **Session isolation**: Each query is scoped to a single patient

### Document Scanner Security
- **Base64 validation**: Image data validated before processing
- **No file persistence**: Scanned images not stored on disk
- **Staff-only access**: Requires authentication with staff role

### AI Safety
- **Disclaimer**: All responses include "AI-assisted analysis. Clinical judgment required."
- **No treatment recommendations**: Agent provides summaries, not medical advice
- **Audit trail**: Tool calls and AI responses are logged

---

## File Structure

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI entry + llama-server lifecycle management |
| `backend/app/services/ai_service.py` | LLM wrapper, vision extraction via llama-server |
| `backend/app/services/ehr_agent.py` | Agent orchestration, table classification |
| `backend/app/routers/ai.py` | API endpoints (chat, scan-document, agent) |
| `backend/models/` | GGUF model files (Q8 + mmproj-BF16) |
| `src/services/api.service.ts` | Frontend API client |
| `src/components/common/DocumentScanner.tsx` | Document scanning UI |
| `src/components/admin/AskHope.tsx` | EHR chat interface |

---

## Model Files

Located in `backend/models/`:

| File | Size | Purpose |
|------|------|---------|
| `gemma-4-E2B-it-Q8_0.gguf` | 4.7 GB | **Main model (active)** - Unsloth optimized |
| `google_gemma-4-E2B-it-Q4_K_M.gguf` | 3.2 GB | Smaller alternative (optional) |

**Download from**: `unsloth/gemma-4-E2B-it-GGUF` on Hugging Face

Note: Vision projector (mmproj) not needed since we use Tesseract OCR for text extraction.

---

## Environment Variables

```bash
# Model configuration
MODEL_DIR=./models
LLM_MODEL=gemma-4-E2B-it-Q8_0.gguf          # Unsloth Q8 model

# Startup behavior
AI_AUTO_DOWNLOAD=true                       # Auto-download models if missing
AI_PRELOAD=true                             # Pre-load model at startup
```

---

## Future Enhancements

### Near-term
- [ ] Conversation memory (multi-turn context)
- [ ] Query caching for repeated questions
- [ ] Batch table fetches (parallel queries)
- [ ] Fine-tuned prompts for Ghana Card ID extraction

### Long-term
- [ ] GPU server deployment for <5s inference
- [ ] Larger model (Gemma 7B/12B) for better vision quality
- [ ] RAG with clinical guidelines
- [ ] Cloud model option with proper HIPAA BAA
- [ ] Speculative decoding for faster generation

---

## References

- [llama.cpp](https://github.com/ggerganov/llama.cpp) - C++ inference engine (includes llama-server)
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) - Open source OCR engine
- [Unsloth](https://unsloth.ai/) - Optimized GGUF model provider
- [Gemma](https://ai.google.dev/gemma) - Google's open model family
- [GGUF Format](https://github.com/ggerganov/ggml/blob/master/docs/gguf.md) - Quantized model format
- [FHIR R4 Patient](https://www.hl7.org/fhir/patient.html) - Healthcare interoperability standard
