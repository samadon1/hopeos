from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from app.database import get_db
from app.models.lab_order import LabOrder
from app.models.user import User
from app.schemas.lab_order import LabOrderCreate, LabOrderUpdate, LabOrderResponse
from app.auth.dependencies import get_current_user, require_roles

router = APIRouter()


@router.get("")
async def list_lab_orders(
    patient_id: str | None = None,
    status_filter: str | None = None,
    priority: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List lab orders with optional filters."""
    query = select(LabOrder).order_by(LabOrder.ordered_date.desc())
    if patient_id:
        query = query.where(LabOrder.patient_id == patient_id)
    if status_filter:
        query = query.where(LabOrder.status == status_filter)
    if priority:
        query = query.where(LabOrder.priority == priority)
    query = query.limit(100)

    result = await db.execute(query)
    orders = result.scalars().all()
    return [LabOrderResponse.model_validate(o) for o in orders]


@router.get("/{order_id}", response_model=LabOrderResponse)
async def get_lab_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a lab order by ID."""
    result = await db.execute(select(LabOrder).where(LabOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Lab order not found")
    return order


@router.post("", response_model=LabOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_lab_order(
    order_data: LabOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "doctor", "nurse"])),
):
    """Create a new lab order."""
    order = LabOrder(
        patient_id=order_data.patient_id,
        test_type=order_data.test_type,
        test_code=order_data.test_code,
        priority=order_data.priority,
        notes=order_data.notes,
        ordered_by=current_user.id,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


@router.put("/{order_id}", response_model=LabOrderResponse)
async def update_lab_order(
    order_id: str,
    order_data: LabOrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "doctor", "nurse", "lab"])),
):
    """Update a lab order (add results, change status)."""
    result = await db.execute(select(LabOrder).where(LabOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Lab order not found")

    update_data = order_data.model_dump(exclude_unset=True)

    # If completing the order, set completed_at and completed_by
    if update_data.get("status") == "completed":
        update_data["completed_at"] = datetime.utcnow()
        update_data["completed_by"] = current_user.id
        update_data["results_available"] = True

    for field, value in update_data.items():
        setattr(order, field, value)

    await db.commit()
    await db.refresh(order)
    return order


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_lab_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "doctor", "lab"])),
):
    """Cancel a lab order."""
    result = await db.execute(select(LabOrder).where(LabOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Lab order not found")

    order.status = "cancelled"
    await db.commit()
