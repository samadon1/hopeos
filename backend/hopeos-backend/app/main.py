# FastAPI application
import os
import traceback
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Store startup errors for debugging
_startup_error = None

# AI loading state - tracks background loading progress
_ai_loading_state = {
    "loading": False,
    "loaded": False,
    "error": None,
    "progress": "Not started"
}

try:
    from app.config import settings
    print(f"[STARTUP] Config loaded, DATABASE_URL: {'postgres' if 'postgresql' in settings.database_url else 'sqlite'}")
except Exception as e:
    _startup_error = f"Config import error: {e}"
    print(f"[STARTUP ERROR] {_startup_error}")
    traceback.print_exc()
    settings = None

try:
    from app.database import init_db
    print("[STARTUP] Database module loaded")
except Exception as e:
    _startup_error = f"Database import error: {e}"
    print(f"[STARTUP ERROR] {_startup_error}")
    traceback.print_exc()
    init_db = None

try:
    from app.routers import auth, patients, visits, encounters, observations
    from app.routers import medications, diagnoses, lab_orders, pharmacy_orders
    from app.routers import users, analytics, catalogs
    print("[STARTUP] Core routers loaded")
except Exception as e:
    _startup_error = f"Core routers import error: {e}"
    print(f"[STARTUP ERROR] {_startup_error}")
    traceback.print_exc()
    auth = patients = visits = encounters = observations = None
    medications = diagnoses = lab_orders = pharmacy_orders = None
    users = analytics = catalogs = None

# AI router is optional
ai = None
try:
    from app.routers import ai
    print("[STARTUP] AI router loaded")
except Exception as e:
    print(f"[STARTUP WARNING] AI router failed to load (non-fatal): {e}")


def download_ai_models_background():
    """Check Ollama model availability (models are managed by Ollama, not downloaded directly)."""
    try:
        from app.services.ai_service import ai_service
        if ai_service.load_model():
            print("[STARTUP] AI model available via Ollama.")
        else:
            print("[STARTUP WARNING] AI model not available. Run: ollama create hopeos-gemma4 -f models/Modelfile")
    except Exception as e:
        print(f"[STARTUP WARNING] AI check failed: {e}")


def preload_ai_model():
    """Pre-load AI model into memory on startup (runs in background thread)."""
    global _ai_loading_state

    _ai_loading_state["loading"] = True
    _ai_loading_state["progress"] = "Starting AI model load..."
    print("[AI] Starting background model loading...")

    try:
        from app.services.ai_service import ai_service

        _ai_loading_state["progress"] = "Loading 2.3GB model into memory..."
        success = ai_service.load_model(auto_download=False, preload_multimodal=False)

        if success:
            _ai_loading_state["loaded"] = True
            _ai_loading_state["progress"] = "AI model ready"
            print("[AI] Model loaded successfully!")
        else:
            _ai_loading_state["error"] = "Model loading failed"
            _ai_loading_state["progress"] = "Failed to load model"
            print("[AI] Model pre-loading failed.")
    except ImportError as e:
        _ai_loading_state["error"] = str(e)
        _ai_loading_state["progress"] = f"Import error: {e}"
        print(f"[AI] Module not available: {e}")
    except Exception as e:
        _ai_loading_state["error"] = str(e)
        _ai_loading_state["progress"] = f"Error: {e}"
        print(f"[AI] Error loading model: {e}")
    finally:
        _ai_loading_state["loading"] = False


@asynccontextmanager
async def lifespan(fastapi_app: FastAPI):
    """Application lifespan events."""
    global _startup_error

    try:
        if init_db:
            print("[STARTUP] Initializing database...")
            await init_db()
            print("[STARTUP] Database initialized successfully")
    except Exception as e:
        _startup_error = f"Database init error: {e}"
        print(f"[STARTUP ERROR] {_startup_error}")
        traceback.print_exc()

    if os.getenv("AI_AUTO_DOWNLOAD", "true").lower() != "false":
        try:
            download_ai_models_background()
        except Exception as e:
            print(f"[STARTUP WARNING] AI download failed: {e}")

    if os.getenv("AI_PRELOAD", "true").lower() != "false":
        # Run AI model loading in background thread so it doesn't block server startup
        ai_thread = threading.Thread(target=preload_ai_model, daemon=True)
        ai_thread.start()
        print("[STARTUP] AI model loading started in background thread")
    else:
        print("[STARTUP] AI preload disabled (AI_PRELOAD=false)")

    yield


app = FastAPI(
    title="HopeOS EHR API",
    description="Healthcare EHR System API with FHIR-compliant data models",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
if auth:
    app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
if patients:
    app.include_router(patients.router, prefix="/patients", tags=["Patients"])
if visits:
    app.include_router(visits.router, prefix="/visits", tags=["Visits"])
if encounters:
    app.include_router(encounters.router, prefix="/encounters", tags=["Encounters"])
if observations:
    app.include_router(observations.router, prefix="/observations", tags=["Observations"])
if medications:
    app.include_router(medications.router, prefix="/medications", tags=["Medications"])
if diagnoses:
    app.include_router(diagnoses.router, prefix="/diagnoses", tags=["Diagnoses"])
if lab_orders:
    app.include_router(lab_orders.router, prefix="/lab-orders", tags=["Lab Orders"])
if pharmacy_orders:
    app.include_router(pharmacy_orders.router, prefix="/pharmacy-orders", tags=["Pharmacy Orders"])
if users:
    app.include_router(users.router, prefix="/users", tags=["Users"])
if analytics:
    app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
if catalogs:
    app.include_router(catalogs.router, prefix="/catalogs", tags=["Catalogs"])
if ai:
    app.include_router(ai.router, prefix="/ai", tags=["AI Clinical Support"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    import sys
    return {
        "status": "healthy" if not _startup_error else "degraded",
        "version": "2.0.0",
        "startup_error": _startup_error,
        "routers_loaded": {
            "auth": auth is not None,
            "patients": patients is not None,
            "ai": ai is not None,
        },
        "ai_status": {
            "loading": _ai_loading_state["loading"],
            "loaded": _ai_loading_state["loaded"],
            "error": _ai_loading_state["error"],
            "progress": _ai_loading_state["progress"],
        },
        "debug": {
            "sys_path": sys.path[:5],
            "cwd": os.getcwd(),
        }
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "HopeOS EHR API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/ai-loading-status")
async def ai_loading_status():
    """AI loading status endpoint (no auth required, for loading screen)."""
    return {
        "loading": _ai_loading_state["loading"],
        "loaded": _ai_loading_state["loaded"],
        "error": _ai_loading_state["error"],
        "progress": _ai_loading_state["progress"],
    }
