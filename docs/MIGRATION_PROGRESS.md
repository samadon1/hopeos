# HopeOS: Firebase to FastAPI Migration

## Overview

Migration of HopeOS EHR system from Firebase (Firestore, Auth, Cloud Functions) to a Python/FastAPI backend with Synthea-generated FHIR patient data.

---

## Architecture

### Before (Firebase)
```
Frontend (Vite + React) → Firebase Auth → Firestore → Cloud Functions
```

### After (FastAPI + Vercel Services)
```
Frontend (Vite + React) → FastAPI Backend → SQLite/Postgres
                       ↓
              Vercel Services (single domain)
```

### Directory Structure
```
HopeOS/
├── backend/                    # NEW: Python/FastAPI
│   ├── app/
│   │   ├── main.py            # FastAPI entry point
│   │   ├── config.py          # Environment settings
│   │   ├── database.py        # SQLAlchemy async setup
│   │   ├── models/            # SQLAlchemy models (14 tables)
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── routers/           # API endpoints
│   │   ├── auth/              # JWT + RBAC
│   │   └── fhir/              # Synthea data loader
│   ├── synthea/               # FHIR data generation
│   │   ├── generate.sh        # Synthea runner script
│   │   └── output/fhir/       # Generated patient bundles
│   ├── tests/                 # Pytest tests
│   └── requirements.txt
├── src/                       # Existing React frontend
│   └── services/
│       ├── api.service.ts     # NEW: replaces firestore.service.ts
│       └── firestore.service.ts # OLD: to be removed
└── vercel.json                # Vercel Services config
```

---

## Progress

### Completed

| Task | Status | Notes |
|------|--------|-------|
| Create backend directory structure | ✅ | `backend/app/` with all subdirs |
| SQLAlchemy models (14 tables) | ✅ | FHIR-aligned schema |
| Pydantic schemas | ✅ | Request/response validation |
| FastAPI routers | ✅ | All endpoints implemented |
| JWT authentication | ✅ | With role-based access control |
| Password hashing | ✅ | Using bcrypt directly |
| Synthea data generation | ✅ | 111 patients generated |
| FHIR data loader | ✅ | Loads bundles into database |
| Database initialization | ✅ | All tables created |
| Sample users created | ✅ | admin, doctor, nurse, pharmacist, lab |
| Frontend API service | ✅ | Drop-in replacement for Firebase |
| Vercel Services config | ✅ | `vercel.json` configured |

### Data Loaded

| Resource | Count |
|----------|-------|
| Patients | 111 |
| Encounters | 5,809 |
| Observations | 58,260 |
| Medications | 4,993 |
| Diagnoses | 4,262 |

### Tested and Verified

| Task | Status | Notes |
|------|--------|-------|
| Backend server startup | ✅ | Works with multiprocessing fork on macOS |
| API endpoints (manual) | ✅ | Health, login, patients, observations all work |
| Pytest test suite | ✅ | **26/26 tests pass** |

### Pending

| Task | Status | Notes |
|------|--------|-------|
| Update frontend imports | ⏳ | Replace firestoreService → apiService |
| Deploy to Vercel | ⏳ | Ready for deployment |
| Remove Firebase dependencies | ⏳ | After migration validated |

---

## Technical Decisions

### AI/EHR Agent Architecture
- **Approach**: Table classification + predefined queries (not text-to-SQL)
- **Model**: Gemma 4 E2B-IT Q4_K_M (local, via llama-cpp-python)
- **Streaming**: True token-level SSE streaming for responsive UX
- **Rationale**: Safety over flexibility - no SQL injection, auditable, HIPAA-friendly

> See [EHR_AGENT_ARCHITECTURE.md](EHR_AGENT_ARCHITECTURE.md) for full technical details.

### Database
- **Local**: SQLite with aiosqlite (async driver)
- **Production**: Neon Postgres via Vercel Marketplace
- **Rationale**: Zero-config local dev, serverless-friendly production

### OTP Storage
- **Choice**: Database-based with TTL cleanup
- **Rationale**: Simpler than Redis, works with existing Postgres

### Authentication
- **JWT tokens** for staff (username/password)
- **OTP via SMS** for patients (phone number verification)
- **5 roles**: admin, doctor, nurse, pharmacist, lab_technician

### Synthea Data
- **100 patients** generated (111 bundles including deceased)
- **FHIR R4** format
- **Massachusetts demographics** (can customize for Ghana later)

---

## Lessons Learned

### 1. Vercel Services Routing
**Issue**: Initial attempt included `/api` prefix in router definitions.

**Solution**: Vercel Services strips the `routePrefix` before forwarding, so routes should NOT include the prefix.
```python
# Wrong
app.include_router(auth.router, prefix="/api/auth")

# Correct
app.include_router(auth.router, prefix="/auth")
```

### 2. SQLAlchemy Reserved Attributes
**Issue**: `metadata` is a reserved attribute in SQLAlchemy's Declarative API.

**Error**: `InvalidRequestError: Attribute name 'metadata' is reserved`

**Solution**: Renamed `metadata` → `extra_data` in Observation model.

### 3. Python 3.14 + passlib Compatibility
**Issue**: passlib has compatibility issues with Python 3.14 and newer bcrypt.

**Error**: `AttributeError: module 'bcrypt' has no attribute '__about__'`

**Solution**: Use bcrypt directly instead of passlib:
```python
# Instead of passlib
import bcrypt

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
```

### 4. Missing Dependencies
**Issue**: Pydantic EmailStr requires email-validator package.

**Solution**: Added `email-validator>=2.1.0` to requirements.txt

### 5. Database Initialization Order
**Issue**: `init_db()` used wrong Base class (from database.py instead of models/base.py).

**Solution**: Import Base from models.base and import all models before creating tables:
```python
async def init_db():
    from app.models import patient, user, visit, encounter, observation
    from app.models import medication, diagnosis, lab_order, pharmacy_order
    from app.models import catalog

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

### 6. greenlet Dependency
**Issue**: SQLAlchemy async requires greenlet but it's not auto-installed.

**Solution**: Added `greenlet>=3.0.0` to requirements.txt

### 7. macOS Server Startup in Background
**Issue**: Running uvicorn in background with `&` doesn't work reliably on macOS due to process spawning differences.

**Solution**: Use `multiprocessing.set_start_method('fork')` for testing, or run server in a subprocess with proper output handling:
```bash
# Start server
nohup uvicorn app.main:app --host 127.0.0.1 --port 8012 > /tmp/server.log 2>&1 &

# Wait for ready
for i in {1..20}; do curl -s http://127.0.0.1:8012/health && break; sleep 0.5; done
```

---

## API Endpoints

### Authentication
```
POST /auth/login              # Staff login (username/password)
POST /auth/patient/otp/send   # Request OTP for patient
POST /auth/patient/otp/verify # Verify OTP and get token
```

### Resources
```
GET/POST   /patients          # List/create patients
GET/PUT    /patients/{id}     # Get/update patient
GET        /patients/search   # Search patients

GET/POST   /visits            # Patient visits
GET/POST   /encounters        # Clinical encounters
GET/POST   /observations      # Vitals and lab results
GET/POST   /medications       # Prescriptions
GET/POST   /diagnoses         # Conditions

GET/POST/PUT /lab-orders      # Lab order workflow
GET/POST/PUT /pharmacy-orders # Pharmacy dispensing

GET/POST   /users             # User management (admin)
GET        /analytics         # Dashboard stats
GET        /catalogs/*        # Reference data
```

### Health Check
```
GET /health                   # Server health status
```

---

## Test Users

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | admin |
| doctor | doctor123 | doctor |
| nurse | nurse123 | nurse |
| pharmacist | pharma123 | pharmacist |
| lab | lab123 | lab_technician |

---

## Next Steps

1. **Debug server startup** - Investigate port binding issue on macOS
2. **Run test suite** - Validate all endpoints work correctly
3. **Update frontend** - Switch imports from Firebase to API service
4. **Test E2E flow** - Login → Create patient → Add vitals → Prescribe → Dispense
5. **Deploy to Vercel** - Test with Neon Postgres
6. **Remove Firebase** - Clean up old dependencies

---

## Commands Reference

### Backend Development
```bash
cd backend

# Setup
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Initialize database
python -c "import asyncio; from app.database import init_db; asyncio.run(init_db())"

# Generate Synthea data
cd synthea && ./generate.sh

# Load Synthea data
python -m app.fhir.synthea_loader

# Run server
uvicorn app.main:app --reload --port 8000

# Run tests
pytest tests/
```

### Frontend Development
```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

### Vercel Deployment
```bash
# Link project
vercel link

# Deploy preview
vercel

# Deploy production
vercel --prod
```

---

## Files Modified/Created

### New Files (Backend)
- `backend/app/main.py` - FastAPI application
- `backend/app/config.py` - Settings
- `backend/app/database.py` - SQLAlchemy setup
- `backend/app/models/*.py` - 14 database models
- `backend/app/schemas/*.py` - Pydantic schemas
- `backend/app/routers/*.py` - API endpoints
- `backend/app/auth/*.py` - JWT + password utilities
- `backend/app/fhir/synthea_loader.py` - FHIR importer
- `backend/synthea/generate.sh` - Synthea runner
- `backend/requirements.txt` - Python dependencies
- `backend/tests/conftest.py` - Test fixtures

### New Files (Frontend)
- `src/services/api.service.ts` - API client

### Modified Files
- `vercel.json` - Added experimentalServices config

---

## Environment Variables

### Local Development (.env)
```bash
DATABASE_URL=sqlite+aiosqlite:///./hopeos.db
JWT_SECRET_KEY=your-secret-key-here
DEBUG=true
```

### Production (Vercel)
```bash
DATABASE_URL=postgresql+asyncpg://user:pass@host/db
JWT_SECRET_KEY=<secure-random-key>
CORS_ORIGINS=https://hopeos.vercel.app
DEBUG=false
```
