import secrets
import hashlib
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.config import settings
from app.models.otp_session import OTPSession


class OTPService:
    """Service for generating and verifying OTPs using database storage."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_otp(self, verification_id: str, patient_id: str | None = None, phone_number: str | None = None) -> str:
        """Generate a new OTP and store it in the database."""
        # Delete any existing OTP for this verification ID
        await self.db.execute(
            delete(OTPSession).where(OTPSession.verification_id == verification_id)
        )

        # Generate OTP
        otp = ''.join([str(secrets.randbelow(10)) for _ in range(settings.otp_length)])

        # Hash OTP for storage
        otp_hash = hashlib.sha256(otp.encode()).hexdigest()

        # Create session
        session = OTPSession(
            verification_id=verification_id,
            otp_hash=otp_hash,
            patient_id=patient_id,
            phone_number=phone_number,
            expires_at=datetime.utcnow() + timedelta(minutes=settings.otp_expiry_minutes),
        )
        self.db.add(session)
        await self.db.commit()

        return otp

    async def verify_otp(self, verification_id: str, otp: str) -> tuple[bool, str | None]:
        """Verify an OTP. Returns (success, patient_id)."""
        result = await self.db.execute(
            select(OTPSession).where(OTPSession.verification_id == verification_id)
        )
        session = result.scalar_one_or_none()

        if not session:
            return False, None

        # Check expiry
        if datetime.utcnow() > session.expires_at:
            await self.db.delete(session)
            await self.db.commit()
            return False, None

        # Check attempts (max 3)
        if session.attempts >= 3:
            await self.db.delete(session)
            await self.db.commit()
            return False, None

        # Verify OTP
        otp_hash = hashlib.sha256(otp.encode()).hexdigest()
        if otp_hash != session.otp_hash:
            session.attempts += 1
            await self.db.commit()
            return False, None

        # Success - delete session and return patient_id
        patient_id = session.patient_id
        await self.db.delete(session)
        await self.db.commit()

        return True, patient_id

    async def cleanup_expired(self) -> int:
        """Clean up expired OTP sessions. Returns count of deleted sessions."""
        result = await self.db.execute(
            delete(OTPSession).where(OTPSession.expires_at < datetime.utcnow())
        )
        await self.db.commit()
        return result.rowcount
