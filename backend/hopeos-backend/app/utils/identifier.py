from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.patient import Patient


def calculate_luhn_check_digit(identifier: str) -> str:
    """Calculate Luhn check digit for patient identifier."""
    digits = [int(d) for d in identifier]
    total = 0
    is_even = True

    for i in range(len(digits) - 1, -1, -1):
        digit = digits[i]
        if is_even:
            digit *= 2
            if digit > 9:
                digit -= 9
        total += digit
        is_even = not is_even

    check_digit = (10 - (total % 10)) % 10
    return str(check_digit)


async def generate_patient_identifier(db: AsyncSession) -> str:
    """Generate a unique patient identifier with Luhn check digit."""
    # Get the highest current identifier number
    result = await db.execute(
        select(func.max(Patient.identifier))
    )
    max_identifier = result.scalar()

    if max_identifier:
        # Extract number part (remove check digit)
        try:
            next_number = int(max_identifier[:-1]) + 1
        except (ValueError, IndexError):
            next_number = 100000
    else:
        next_number = 100000

    # Calculate check digit
    check_digit = calculate_luhn_check_digit(str(next_number))

    return f"{next_number}{check_digit}"
