from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from app.database import get_db
from app.models.pharmacy_order import PharmacyOrder
from app.models.user import User
from app.schemas.pharmacy_order import PharmacyOrderCreate, PharmacyOrderUpdate, PharmacyOrderResponse
from app.auth.dependencies import get_current_user, require_roles

router = APIRouter()


@router.get("")
async def list_pharmacy_orders(
    patient_id: str | None = None,
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List pharmacy orders with optional filters."""
    query = select(PharmacyOrder).order_by(PharmacyOrder.ordered_date.desc())
    if patient_id:
        query = query.where(PharmacyOrder.patient_id == patient_id)
    if status_filter:
        query = query.where(PharmacyOrder.status == status_filter)
    query = query.limit(100)

    result = await db.execute(query)
    orders = result.scalars().all()
    return [PharmacyOrderResponse.model_validate(o) for o in orders]


@router.get("/{order_id}", response_model=PharmacyOrderResponse)
async def get_pharmacy_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a pharmacy order by ID."""
    result = await db.execute(select(PharmacyOrder).where(PharmacyOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pharmacy order not found")
    return order


@router.post("", response_model=PharmacyOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_pharmacy_order(
    order_data: PharmacyOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "doctor", "nurse"])),
):
    """Create a new pharmacy order."""
    order = PharmacyOrder(
        patient_id=order_data.patient_id,
        medication_id=order_data.medication_id,
        drug_name=order_data.drug_name,
        dosage=order_data.dosage,
        quantity=order_data.quantity,
        notes=order_data.notes,
        prescribed_by=current_user.id,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


@router.put("/{order_id}", response_model=PharmacyOrderResponse)
async def update_pharmacy_order(
    order_id: str,
    order_data: PharmacyOrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "pharmacy"])),
):
    """Update a pharmacy order (dispense, cancel)."""
    result = await db.execute(select(PharmacyOrder).where(PharmacyOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pharmacy order not found")

    update_data = order_data.model_dump(exclude_unset=True)

    # If dispensing, set dispensed_at and dispensed_by
    if update_data.get("status") == "dispensed":
        update_data["dispensed_at"] = datetime.utcnow()
        update_data["dispensed_by"] = current_user.id

    for field, value in update_data.items():
        setattr(order, field, value)

    await db.commit()
    await db.refresh(order)
    return order


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_pharmacy_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "pharmacy"])),
):
    """Cancel a pharmacy order."""
    result = await db.execute(select(PharmacyOrder).where(PharmacyOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pharmacy order not found")

    order.status = "cancelled"
    await db.commit()
