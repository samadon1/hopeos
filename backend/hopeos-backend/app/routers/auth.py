from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.database import get_db
from app.models.user import User
from app.models.patient import Patient
from app.schemas.auth import Token, OTPRequest, OTPVerify, PatientVerify, PatientTokenResponse
from app.schemas.user import UserLogin, UserResponse
from app.auth.jwt import create_access_token, create_refresh_token, verify_token
from app.auth.password import verify_password
from app.auth.otp import OTPService
from app.auth.dependencies import get_current_user

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login with username and password (for staff)."""
    result = await db.execute(
        select(User).where(User.username == credentials.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    token_data = {
        "sub": user.id,
        "username": user.username,
        "role": user.role,
    }

    return Token(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_db)):
    """Refresh access token using refresh token."""
    token_data = verify_token(refresh_token)

    if not token_data or token_data.token_type != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    result = await db.execute(select(User).where(User.id == token_data.user_id))
    user = result.scalar_one_or_none()

    if not user or not user.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or disabled",
        )

    new_token_data = {
        "sub": user.id,
        "username": user.username,
        "role": user.role,
    }

    return Token(
        access_token=create_access_token(new_token_data),
        refresh_token=create_refresh_token(new_token_data),
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    return current_user


# Patient OTP Authentication

@router.post("/patient/verify")
async def verify_patient_identity(
    data: PatientVerify,
    db: AsyncSession = Depends(get_db),
):
    """Verify patient identity before sending OTP."""
    result = await db.execute(
        select(Patient).where(
            Patient.first_name.ilike(data.first_name),
            Patient.last_name.ilike(data.last_name),
        )
    )
    patients = result.scalars().all()

    # Filter by birthdate (stored as date)
    matching_patient = None
    for patient in patients:
        if str(patient.birthdate) == data.birthdate:
            matching_patient = patient
            break

    if not matching_patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found. Please check your details.",
        )

    # Generate verification ID
    verification_id = str(uuid.uuid4())

    return {
        "verification_id": verification_id,
        "patient_id": matching_patient.id,
        "phone_number": matching_patient.phone_number,
        "message": "Patient verified. Please request OTP.",
    }


@router.post("/patient/otp/send")
async def send_otp(
    data: OTPRequest,
    db: AsyncSession = Depends(get_db),
):
    """Send OTP to patient's phone/email."""
    otp_service = OTPService(db)

    # Get patient ID from verification
    # In production, you'd look up the verification_id from a temp store
    otp = await otp_service.generate_otp(
        verification_id=data.verification_id,
        phone_number=data.phone_number,
    )

    # In production, send OTP via SMS/email
    # For now, return it in response (DEV ONLY)
    return {
        "message": "OTP sent successfully",
        "verification_id": data.verification_id,
        # DEV ONLY - remove in production
        "otp": otp,
    }


@router.post("/patient/otp/verify", response_model=PatientTokenResponse)
async def verify_otp(
    data: OTPVerify,
    db: AsyncSession = Depends(get_db),
):
    """Verify OTP and return patient token."""
    otp_service = OTPService(db)
    success, patient_id = await otp_service.verify_otp(data.verification_id, data.otp)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP",
        )

    # Get patient details
    if patient_id:
        result = await db.execute(select(Patient).where(Patient.id == patient_id))
        patient = result.scalar_one_or_none()
    else:
        patient = None

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )

    # Create patient access token
    token_data = {
        "sub": patient.id,
        "type": "patient",
        "identifier": patient.identifier,
    }

    return PatientTokenResponse(
        access_token=create_access_token(token_data),
        patient_id=patient.id,
        patient_name=patient.full_name,
    )
