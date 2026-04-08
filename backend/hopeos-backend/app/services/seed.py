"""Seed database with initial data."""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import async_session
from app.models.user import User
from app.auth.password import hash_password


async def seed_admin_users(db: AsyncSession):
    """Create default admin users."""
    default_users = [
        {
            "username": "admin",
            "email": "admin@hopeos.example.com",
            "password": "Admin123!",
            "display_name": "System Administrator",
            "role": "admin",
            "description": "System administrator with full access",
        },
        {
            "username": "doctor",
            "email": "doctor@hopeos.example.com",
            "password": "doctor123",
            "display_name": "Dr. Kwame Asante",
            "role": "doctor",
            "description": "General Practitioner",
        },
        {
            "username": "nurse",
            "email": "nurse@hopeos.example.com",
            "password": "nurse123",
            "display_name": "Nurse Akua Mensah",
            "role": "nurse",
            "description": "Registered Nurse",
        },
        {
            "username": "pharmacist",
            "email": "pharmacist@hopeos.example.com",
            "password": "pharmacy123",
            "display_name": "Pharmacist Kofi Boateng",
            "role": "pharmacy",
            "description": "Licensed Pharmacist",
        },
        {
            "username": "labtech",
            "email": "labtech@hopeos.example.com",
            "password": "lab123",
            "display_name": "Lab Tech Ama Owusu",
            "role": "lab",
            "description": "Laboratory Technician",
        },
    ]

    created_count = 0
    for user_data in default_users:
        # Check if user exists
        result = await db.execute(
            select(User).where(User.username == user_data["username"])
        )
        if result.scalar_one_or_none():
            continue

        user = User(
            username=user_data["username"],
            email=user_data["email"],
            password_hash=hash_password(user_data["password"]),
            display_name=user_data["display_name"],
            role=user_data["role"],
            description=user_data["description"],
        )
        db.add(user)
        created_count += 1

    await db.commit()
    return created_count


async def run_seed():
    """Run all seed functions."""
    async with async_session() as db:
        print("Seeding admin users...")
        users_created = await seed_admin_users(db)
        print(f"Created {users_created} users")


if __name__ == "__main__":
    asyncio.run(run_seed())
