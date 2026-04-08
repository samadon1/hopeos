from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.config import settings
from app.models.base import Base


def get_engine_kwargs():
    """Get additional engine kwargs based on database type."""
    db_url = settings.database_url

    # For PostgreSQL with asyncpg, configure SSL
    if "postgresql" in db_url and "asyncpg" in db_url:
        return {
            "connect_args": {"ssl": "require"}
        }

    return {}


# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    **get_engine_kwargs(),
)

# Session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """Dependency for getting database sessions."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize database tables."""
    # Import all models to register them with Base.metadata
    from app.models import patient, user, visit, encounter, observation
    from app.models import medication, diagnosis, lab_order, pharmacy_order
    from app.models import catalog

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
