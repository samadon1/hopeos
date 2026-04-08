"""AI Router - Clinical Decision Support endpoints."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
import json

# Thread pool for running CPU-bound AI inference without blocking the event loop
_ai_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="ai_inference")

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.auth.dependencies import get_current_user
from app.database import get_db
from app.services.ai_service import ai_service
from app.services.ehr_agent import ehr_agent

router = APIRouter()


class ChatRequest(BaseModel):
    """Chat request model."""
    prompt: str
    system_prompt: Optional[str] = None
    max_tokens: int = 512
    temperature: float = 0.7
    stream: bool = False


class ChatResponse(BaseModel):
    """Chat response model."""
    response: str
    model_loaded: bool


class SymptomAnalysisRequest(BaseModel):
    """Symptom analysis request."""
    symptoms: List[str]
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None


class LabAnalysisRequest(BaseModel):
    """Lab results analysis request."""
    results: dict  # e.g., {"hemoglobin": "8.5 g/dL", "WBC": "12,000"}
    reference_ranges: Optional[dict] = None


class ImageAnalysisRequest(BaseModel):
    """Medical image analysis request."""
    image_base64: str
    image_type: str = "X-ray"  # X-ray, CT, MRI, Ultrasound, etc.
    clinical_context: Optional[str] = None


class TreatmentRequest(BaseModel):
    """Treatment suggestion request."""
    diagnosis: str
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    allergies: Optional[List[str]] = None


class PatientSummaryRequest(BaseModel):
    """Patient summary request - accepts patient data for AI summarization."""
    patient: Dict[str, Any]  # name, age, gender
    vitals: Optional[List[Dict[str, Any]]] = []
    medications: Optional[List[Dict[str, Any]]] = []
    labResults: Optional[List[Dict[str, Any]]] = []
    diagnoses: Optional[List[Dict[str, Any]]] = []
    encounters: Optional[List[Dict[str, Any]]] = []
    allergies: Optional[List[Dict[str, Any]]] = []


class PatientSummaryResponse(BaseModel):
    """Patient summary response."""
    summary: str
    generated_at: str
    disclaimer: str


class ModelStatusResponse(BaseModel):
    """Model status response."""
    model_loaded: bool
    is_multimodal: bool
    model_path: str
    mmproj_path: str


class AnalyticsQueryRequest(BaseModel):
    """Analytics query request."""
    question: str  # Natural language question


class ChartConfig(BaseModel):
    """Chart configuration for visualization."""
    type: str  # bar, line, pie, area, table
    title: str
    xKey: Optional[str] = None
    yKey: Optional[str] = None
    nameKey: Optional[str] = None
    valueKey: Optional[str] = None


class AnalyticsQueryResponse(BaseModel):
    """Analytics query response."""
    question: str
    sql: str
    data: List[Dict[str, Any]]
    chart: Optional[Dict[str, Any]] = None
    explanation: Optional[str] = None
    row_count: int


@router.get("/status", response_model=ModelStatusResponse)
async def get_ai_status(current_user: User = Depends(get_current_user)):
    """Get AI model status."""
    return ModelStatusResponse(
        model_loaded=ai_service.model_loaded,
        is_multimodal=ai_service.is_multimodal,
        model_path=str(ai_service.MODEL_PATH),
        mmproj_path=str(ai_service.MMPROJ_PATH),
    )


@router.post("/download")
async def download_models(
    background_tasks: BackgroundTasks,
    force: bool = False,
    current_user: User = Depends(get_current_user),
):
    """Download AI models from Hugging Face (can be slow, runs in background)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if ai_service.download_in_progress:
        return {"message": "Download already in progress", "success": False}

    # Check if already exists
    model_exists = ai_service.MODEL_PATH.exists()
    mmproj_exists = ai_service.MMPROJ_PATH.exists()

    if model_exists and mmproj_exists and not force:
        return {
            "message": "Models already downloaded",
            "model_path": str(ai_service.MODEL_PATH),
            "mmproj_path": str(ai_service.MMPROJ_PATH),
            "success": True,
        }

    # Download in background
    def download():
        ai_service.download_models(force=force)

    background_tasks.add_task(download)
    return {"message": "Model download started", "success": True}


@router.post("/load")
async def load_model(
    background_tasks: BackgroundTasks,
    force: bool = False,
    auto_download: bool = False,
    current_user: User = Depends(get_current_user),
):
    """Load the AI model (can be slow, runs in background).

    Args:
        force: Force reload even if already loaded
        auto_download: Download model if not present
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if ai_service.model_loaded and not force:
        return {"message": "Model already loaded", "success": True}

    # Load in background to not block the request
    def load():
        ai_service.load_model(force_reload=force, auto_download=auto_download)

    background_tasks.add_task(load)
    return {"message": "Model loading started", "success": True}


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Chat with the AI assistant."""
    if request.stream:
        raise HTTPException(
            status_code=400,
            detail="Use /chat/stream endpoint for streaming responses"
        )

    # Run AI inference in thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        _ai_executor,
        partial(
            ai_service.generate,
            prompt=request.prompt,
            system_prompt=request.system_prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
        )
    )

    return ChatResponse(
        response=response,
        model_loaded=ai_service.model_loaded,
    )


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Stream chat response from AI."""

    async def generate():
        async for chunk in ai_service.generate_stream(
            prompt=request.prompt,
            system_prompt=request.system_prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
        ):
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/analyze/symptoms")
async def analyze_symptoms(
    request: SymptomAnalysisRequest,
    current_user: User = Depends(get_current_user),
):
    """Analyze symptoms and suggest differential diagnoses."""
    if current_user.role not in ["admin", "doctor", "nurse"]:
        raise HTTPException(
            status_code=403,
            detail="Clinical staff access required"
        )

    patient_info = {}
    if request.patient_age:
        patient_info["age"] = request.patient_age
    if request.patient_gender:
        patient_info["gender"] = request.patient_gender

    # Run in thread pool to avoid blocking
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        _ai_executor,
        partial(
            ai_service.analyze_symptoms,
            symptoms=request.symptoms,
            patient_info=patient_info if patient_info else None,
        )
    )

    return {
        "analysis": response,
        "symptoms": request.symptoms,
        "disclaimer": "AI-assisted analysis. Clinical judgment required for diagnosis.",
    }


@router.post("/analyze/lab-results")
async def analyze_lab_results(
    request: LabAnalysisRequest,
    current_user: User = Depends(get_current_user),
):
    """Analyze laboratory results."""
    if current_user.role not in ["admin", "doctor", "nurse", "lab"]:
        raise HTTPException(
            status_code=403,
            detail="Clinical/lab staff access required"
        )

    # Run in thread pool to avoid blocking
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        _ai_executor,
        partial(
            ai_service.analyze_lab_results,
            results=request.results,
            reference_ranges=request.reference_ranges,
        )
    )

    return {
        "analysis": response,
        "results": request.results,
        "disclaimer": "AI-assisted interpretation. Confirm with clinical context.",
    }


@router.post("/analyze/image")
async def analyze_medical_image(
    request: ImageAnalysisRequest,
    current_user: User = Depends(get_current_user),
):
    """Analyze a medical image (X-ray, CT, etc.)."""
    if current_user.role not in ["admin", "doctor"]:
        raise HTTPException(
            status_code=403,
            detail="Physician access required for image analysis"
        )

    if not ai_service.is_multimodal:
        raise HTTPException(
            status_code=503,
            detail="Multimodal model not loaded. Image analysis unavailable."
        )

    # Run in thread pool to avoid blocking (vision inference is slow)
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        _ai_executor,
        partial(
            ai_service.analyze_medical_image,
            image_base64=request.image_base64,
            image_type=request.image_type,
        )
    )

    return {
        "analysis": response,
        "image_type": request.image_type,
        "disclaimer": "AI-assisted analysis. Definitive interpretation requires qualified radiologist.",
    }


@router.post("/suggest/treatment")
async def suggest_treatment(
    request: TreatmentRequest,
    current_user: User = Depends(get_current_user),
):
    """Suggest treatment options for a diagnosis."""
    if current_user.role not in ["admin", "doctor"]:
        raise HTTPException(
            status_code=403,
            detail="Physician access required"
        )

    patient_info = {}
    if request.patient_age:
        patient_info["age"] = request.patient_age
    if request.patient_gender:
        patient_info["gender"] = request.patient_gender
    if request.allergies:
        patient_info["allergies"] = request.allergies

    # Run in thread pool to avoid blocking
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        _ai_executor,
        partial(
            ai_service.suggest_treatment,
            diagnosis=request.diagnosis,
            patient_info=patient_info if patient_info else None,
        )
    )

    return {
        "suggestions": response,
        "diagnosis": request.diagnosis,
        "disclaimer": "AI-generated suggestions. Final treatment decisions by treating physician.",
    }


@router.post("/clinical-note/summarize")
async def summarize_clinical_note(
    note: str,
    current_user: User = Depends(get_current_user),
):
    """Summarize a clinical note."""
    prompt = f"""
Summarize this clinical note concisely, highlighting:
1. Chief complaint
2. Key findings
3. Diagnosis/Assessment
4. Plan

Clinical Note:
{note}
"""
    # Run in thread pool to avoid blocking
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        _ai_executor,
        partial(ai_service.generate, prompt, max_tokens=400)
    )
    return {"summary": response}


@router.post("/patient/summary", response_model=PatientSummaryResponse)
async def generate_patient_summary(
    request: PatientSummaryRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate an AI-powered clinical summary of patient history.

    This endpoint synthesizes patient data into a concise summary for physicians,
    highlighting key concerns, active problems, and recent trends.

    Requires clinical staff access (doctor, nurse, admin).
    """
    if current_user.role not in ["admin", "doctor", "nurse"]:
        raise HTTPException(
            status_code=403,
            detail="Clinical staff access required"
        )

    from datetime import datetime

    # Build patient data dict for the AI service
    patient_data = {
        "patient": request.patient,
        "vitals": request.vitals or [],
        "medications": request.medications or [],
        "labResults": request.labResults or [],
        "diagnoses": request.diagnoses or [],
        "encounters": request.encounters or [],
        "allergies": request.allergies or [],
    }

    # Run in thread pool to avoid blocking
    loop = asyncio.get_event_loop()
    summary = await loop.run_in_executor(
        _ai_executor,
        partial(ai_service.generate_patient_summary, patient_data)
    )

    return PatientSummaryResponse(
        summary=summary,
        generated_at=datetime.utcnow().isoformat(),
        disclaimer="AI-generated summary for clinical decision support. Verify all information before making treatment decisions.",
    )


@router.post("/prescription/check")
async def check_prescription(
    medication: str,
    patient_age: int,
    patient_weight: Optional[float] = None,
    allergies: Optional[List[str]] = None,
    current_medications: Optional[List[str]] = None,
    current_user: User = Depends(get_current_user),
):
    """Check a prescription for interactions and dosing."""
    if current_user.role not in ["admin", "doctor", "pharmacy"]:
        raise HTTPException(status_code=403, detail="Access denied")

    context = f"Patient: {patient_age} years old"
    if patient_weight:
        context += f", {patient_weight} kg"
    if allergies:
        context += f"\nAllergies: {', '.join(allergies)}"
    if current_medications:
        context += f"\nCurrent medications: {', '.join(current_medications)}"

    prompt = f"""
{context}

Proposed medication: {medication}

Please check:
1. Appropriateness for this patient
2. Potential drug interactions with current medications
3. Allergy concerns
4. Standard dosing recommendations
5. Important precautions or monitoring
"""
    # Run in thread pool to avoid blocking
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        _ai_executor,
        partial(ai_service.generate, prompt, max_tokens=500)
    )
    return {
        "check_results": response,
        "medication": medication,
        "disclaimer": "AI-assisted check. Pharmacist/physician verification required.",
    }


@router.post("/analytics/query", response_model=AnalyticsQueryResponse)
async def analytics_query(
    request: AnalyticsQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute natural language analytics query.

    Converts natural language question to SQL, executes it, and returns
    data with chart configuration for visualization.

    Admin access required.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required for analytics queries"
        )

    # Run AI call in thread pool to avoid blocking event loop
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor() as executor:
        result = await loop.run_in_executor(
            executor,
            ai_service.generate_analytics_query,
            request.question
        )

    if "error" in result:
        raise HTTPException(
            status_code=400,
            detail=result.get("error"),
        )

    sql = result.get("sql", "")
    if not sql:
        raise HTTPException(
            status_code=400,
            detail="Failed to generate SQL query"
        )

    # Execute the SQL query
    try:
        query_result = await db.execute(text(sql))
        rows = query_result.fetchall()
        columns = query_result.keys()

        # Convert to list of dicts
        data = [dict(zip(columns, row)) for row in rows]

        # Handle UUID and other non-serializable types
        for row in data:
            for key, value in row.items():
                if hasattr(value, 'hex'):  # UUID
                    row[key] = str(value)
                elif hasattr(value, 'isoformat'):  # datetime
                    row[key] = value.isoformat()

        return AnalyticsQueryResponse(
            question=request.question,
            sql=sql,
            data=data,
            chart=result.get("chart"),
            explanation=result.get("explanation"),
            row_count=len(data),
        )

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"SQL execution error: {str(e)}. Query: {sql}"
        )


@router.get("/analytics/schema")
async def get_analytics_schema(
    current_user: User = Depends(get_current_user),
):
    """Get the database schema used for analytics queries.

    Useful for understanding what data is available for querying.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    return {
        "schema": ai_service.DATABASE_SCHEMA,
        "supported_chart_types": ["bar", "line", "pie", "area", "table"],
        "example_questions": [
            "How many patients visited last month?",
            "Show patient visits by gender",
            "Top 10 diagnoses this year",
            "Lab orders by status",
            "Prescriptions by drug name this week",
            "Average visits per day last 30 days",
        ]
    }


# ============================================================================
# Document Scanning / OCR Endpoints
# ============================================================================

class DocumentScanRequest(BaseModel):
    """Request to scan a document and extract patient data."""
    image_base64: str  # Base64-encoded image
    document_type: str = "auto"  # "ghana_card", "paper_record", or "auto"


class ExtractedField(BaseModel):
    """Extracted field with confidence score."""
    value: Optional[Any] = None
    confidence: float = 0.0


class ExtractedPatientData(BaseModel):
    """Extracted patient data from document."""
    first_name: Optional[ExtractedField] = None
    middle_name: Optional[ExtractedField] = None
    last_name: Optional[ExtractedField] = None
    gender: Optional[ExtractedField] = None
    birthdate: Optional[ExtractedField] = None
    phone_number: Optional[ExtractedField] = None
    ghana_card_number: Optional[ExtractedField] = None
    nhis_number: Optional[ExtractedField] = None
    city: Optional[ExtractedField] = None
    community: Optional[ExtractedField] = None
    region: Optional[ExtractedField] = None
    address: Optional[ExtractedField] = None
    emergency_contact: Optional[ExtractedField] = None
    medical_conditions: Optional[ExtractedField] = None
    allergies: Optional[ExtractedField] = None


class DocumentScanResponse(BaseModel):
    """Response from document scanning."""
    success: bool
    document_type: Optional[str] = None
    confidence: Optional[float] = None
    fhir_patient: Optional[Dict[str, Any]] = None  # FHIR R4 Patient resource
    extracted_data: Optional[Dict[str, Any]] = None  # Legacy format for UI compatibility
    raw_text: Optional[str] = None
    notes: Optional[str] = None
    error: Optional[str] = None


@router.post("/scan-document", response_model=DocumentScanResponse)
async def scan_document(
    request: DocumentScanRequest,
    current_user: User = Depends(get_current_user),
):
    """Scan a document (Ghana Card or paper record) and extract patient data.

    This endpoint uses Tesseract OCR + Gemma 4 to:
    1. Extract text from the document image using OCR
    2. Parse the text to detect document type and extract patient data
    3. Return structured FHIR data with confidence scores for each field

    Supports:
    - Ghana Card (national ID): Extracts name, DOB, card number, gender
    - Paper records: Extracts demographics, contact info, medical history
    - Referral letters: Extracts patient info and referring diagnosis

    The extracted data can be used to auto-fill patient registration forms.

    Requires: Any authenticated staff member
    """
    # Allow all staff to use document scanning (registration clerks need this)
    if current_user.role not in ["admin", "doctor", "nurse", "registrar", "pharmacy", "lab"]:
        raise HTTPException(
            status_code=403,
            detail="Staff access required"
        )

    if not ai_service.model_loaded:
        raise HTTPException(
            status_code=503,
            detail="AI model not loaded. Document scanning unavailable."
        )

    # Validate document type
    valid_types = ["auto", "ghana_card", "paper_record"]
    if request.document_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid document_type. Must be one of: {valid_types}"
        )

    # Call the AI service to extract data (run in thread pool - vision inference is slow)
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        _ai_executor,
        partial(
            ai_service.extract_patient_data_from_document,
            image_base64=request.image_base64,
            document_type=request.document_type,
        )
    )

    if not result.get("success"):
        return DocumentScanResponse(
            success=False,
            error=result.get("error", "Unknown error during extraction"),
        )

    # Get overall confidence, with fallback calculation from field confidences
    overall_conf = result.get("overall_confidence")
    print(f"[DEBUG] AI returned overall_confidence: {overall_conf} (type: {type(overall_conf).__name__})")

    if not overall_conf or overall_conf == 0:
        # Calculate from individual field confidences
        extracted = result.get("extracted_data", {})
        confidences = []
        for field in extracted.values():
            if isinstance(field, dict) and "confidence" in field:
                confidences.append(field["confidence"])
        print(f"[DEBUG] Field confidences: {confidences}")
        if confidences:
            overall_conf = sum(confidences) / len(confidences)
            print(f"[DEBUG] Calculated overall_conf: {overall_conf}")

    return DocumentScanResponse(
        success=True,
        document_type=result.get("document_type"),
        confidence=overall_conf,
        fhir_patient=result.get("fhir_patient"),  # FHIR R4 Patient resource
        extracted_data=result.get("extracted_data"),  # Legacy format for UI
        raw_text=result.get("raw_text"),
        notes=result.get("notes"),
    )


# ============================================================================
# EHR Agent Navigator Endpoints
# ============================================================================

class EHRAgentQueryRequest(BaseModel):
    """Request for EHR Agent query."""
    question: str  # Natural language question about the patient
    patient_id: str  # UUID of the patient
    conversation_history: Optional[List[Dict[str, str]]] = None  # For multi-turn


class EHRAgentToolCall(BaseModel):
    """Tool call made by the agent."""
    tool: str
    arguments: Dict[str, Any]
    result_summary: Optional[str] = None


class EHRAgentResponse(BaseModel):
    """Response from EHR Agent query."""
    response: str
    tool_calls: List[Dict[str, Any]] = []
    iterations: int = 0
    patient_id: str
    timestamp: str
    disclaimer: str = "AI-assisted analysis. Clinical judgment required."
    error: Optional[bool] = None


@router.post("/agent/query", response_model=EHRAgentResponse)
async def ehr_agent_query(
    request: EHRAgentQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query the EHR Agent Navigator.

    This endpoint allows natural language queries about patient data.
    The AI agent will:
    1. Understand your question
    2. Query the appropriate EHR data (vitals, labs, medications, etc.)
    3. Synthesize a clinical response

    Example questions:
    - "How is this patient's diabetes control?"
    - "What medications is this patient taking?"
    - "Show me the blood pressure trend"
    - "Are there any concerning lab values?"
    - "When was the last visit and what was done?"

    Requires clinical staff access (doctor, nurse, admin).
    """
    if current_user.role not in ["admin", "doctor", "nurse"]:
        raise HTTPException(
            status_code=403,
            detail="Clinical staff access required"
        )

    result = await ehr_agent.query(
        question=request.question,
        patient_id=request.patient_id,
        db=db,
        conversation_history=request.conversation_history,
    )

    if result.get("error"):
        raise HTTPException(
            status_code=500,
            detail=result.get("response", "Agent error")
        )

    return EHRAgentResponse(
        response=result.get("response", ""),
        tool_calls=result.get("tool_calls", []),
        iterations=result.get("iterations", 0),
        patient_id=request.patient_id,
        timestamp=result.get("timestamp", ""),
        disclaimer=result.get("disclaimer", "AI-assisted analysis. Clinical judgment required."),
    )


@router.post("/agent/query/stream")
async def ehr_agent_query_stream(
    request: EHRAgentQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream EHR Agent Navigator response.

    Returns a stream of JSON events:
    - {"type": "tool_call", "tool": "...", "status": "executing"}
    - {"type": "tool_result", "tool": "...", "success": true}
    - {"type": "response_start"}
    - {"type": "content", "content": "..."}
    - {"type": "done", "tool_calls": [...], "iterations": N}
    - {"type": "error", "content": "..."}

    Requires clinical staff access.
    """
    print(f"\n🔵 [HOPE AI REQUEST] User: {current_user.username}, Question: {request.question[:100]}, Patient: {request.patient_id}\n")

    if current_user.role not in ["admin", "doctor", "nurse"]:
        raise HTTPException(
            status_code=403,
            detail="Clinical staff access required"
        )

    async def generate():
        async for chunk in ehr_agent.query_stream(
            question=request.question,
            patient_id=request.patient_id,
            db=db,
            conversation_history=request.conversation_history,
        ):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.get("/agent/tools")
async def get_agent_tools(
    current_user: User = Depends(get_current_user),
):
    """Get list of tools available to the EHR Agent.

    Returns the tool definitions that the agent can use to query patient data.
    Useful for understanding what the agent can do.
    """
    if current_user.role not in ["admin", "doctor", "nurse"]:
        raise HTTPException(status_code=403, detail="Clinical staff access required")

    from app.services.ehr_tools import EHR_TOOLS

    return {
        "tools": [
            {
                "name": tool["function"]["name"],
                "description": tool["function"]["description"],
                "parameters": tool["function"]["parameters"]["properties"],
            }
            for tool in EHR_TOOLS
        ],
        "example_queries": [
            "How is this patient's diabetes control?",
            "What are the current medications?",
            "Show me the blood pressure trend over the last 3 months",
            "Are there any abnormal lab values?",
            "When was the last HbA1c test and what was the result?",
            "Is this patient overdue for any screenings?",
            "Summarize this patient's kidney function",
            "What conditions has this patient been diagnosed with?",
        ]
    }
