from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: str | None = None
    username: str | None = None
    role: str | None = None
    token_type: str | None = None  # access, refresh


class PatientVerify(BaseModel):
    """Verify patient identity before OTP."""
    first_name: str
    last_name: str
    birthdate: str  # YYYY-MM-DD


class OTPRequest(BaseModel):
    """Request OTP after patient verification."""
    verification_id: str
    phone_number: str | None = None
    email: str | None = None


class OTPVerify(BaseModel):
    """Verify OTP to get token."""
    verification_id: str
    otp: str


class PatientTokenResponse(BaseModel):
    """Response after successful patient OTP verification."""
    access_token: str
    token_type: str = "bearer"
    patient_id: str
    patient_name: str
