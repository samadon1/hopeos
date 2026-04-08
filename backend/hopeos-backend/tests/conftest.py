"""Pytest configuration and fixtures."""
import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models.user import User
from app.auth.password import hash_password
from app.auth.jwt import create_access_token


# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def test_db():
    """Create a fresh database for each test."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def client(test_db: AsyncSession):
    """Create a test client with the test database."""

    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_user(test_db: AsyncSession) -> User:
    """Create an admin user for testing."""
    user = User(
        username="testadmin",
        email="admin@test.com",
        password_hash=hash_password("testpass123"),
        display_name="Test Admin",
        role="admin",
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest_asyncio.fixture
async def doctor_user(test_db: AsyncSession) -> User:
    """Create a doctor user for testing."""
    user = User(
        username="testdoctor",
        email="doctor@test.com",
        password_hash=hash_password("testpass123"),
        display_name="Test Doctor",
        role="doctor",
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_token(admin_user: User) -> str:
    """Create an access token for the admin user."""
    return create_access_token({
        "sub": admin_user.id,
        "username": admin_user.username,
        "role": admin_user.role,
    })


@pytest_asyncio.fixture
async def doctor_token(doctor_user: User) -> str:
    """Create an access token for the doctor user."""
    return create_access_token({
        "sub": doctor_user.id,
        "username": doctor_user.username,
        "role": doctor_user.role,
    })


def auth_header(token: str) -> dict:
    """Create authorization header."""
    return {"Authorization": f"Bearer {token}"}
