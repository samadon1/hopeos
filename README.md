# HopeOS

An offline-first Electronic Health Record system with AI-powered clinical decision support.

## Features

- **Patient Management** - Demographics, visits, encounters, observations
- **Clinical Assistant** - AI-powered patient summaries and risk assessment
- **Document Capture** - OCR for paper records with structured data extraction
- **Analytics** - Natural language queries for clinical insights
- **Offline-First** - Works without internet, syncs when connected

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Python/FastAPI + SQLite
- **AI**: Ollama + Gemma 4 (local inference)
- **Desktop**: Tauri (lightweight native wrapper)

## Quick Start

```bash
# Install dependencies
npm install
cd backend/hopeos-backend && pip install -r requirements.txt

# Start development
./setup.sh
```

## Deployment

- **Desktop**: `npm run desktop:build`
- **Raspberry Pi**: `./scripts/build-pi.sh --install`

## Links

- [HuggingFace Model](https://huggingface.co/samwell/ncd-gemma4-e4b-lora) - Fine-tuned NCD risk assessment
- [Training Dataset](https://huggingface.co/datasets/samwell/synthea-ncd-instructions) - Synthetic patient data

## License

MIT
