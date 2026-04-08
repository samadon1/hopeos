from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path
import os
import sys


def get_data_dir() -> Path:
    """Get the appropriate data directory for the app."""
    # Check if running as PyInstaller bundle
    if getattr(sys, 'frozen', False):
        # Running as bundled app - use user's local data directory
        if sys.platform == 'linux':
            data_dir = Path.home() / '.local' / 'share' / 'hopeos'
        elif sys.platform == 'darwin':
            data_dir = Path.home() / 'Library' / 'Application Support' / 'HopeOS'
        else:  # Windows
            data_dir = Path(os.environ.get('APPDATA', Path.home())) / 'HopeOS'
    else:
        # Running in development - use current directory
        data_dir = Path('.')

    # Ensure directory exists
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def get_default_database_url() -> str:
    """Get the database URL with proper path for the environment."""
    # Check if DATABASE_URL is set (e.g., from Vercel/Neon)
    url = os.environ.get("DATABASE_URL")
    if url:
        # Convert postgresql:// to postgresql+asyncpg:// for SQLAlchemy async
        if url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        # Remove all SSL/TLS related parameters - we handle SSL via connect_args
        # This avoids asyncpg parameter parsing issues
        import re
        # Remove channel_binding, sslmode, ssl parameters from query string
        url = re.sub(r'[?&]channel_binding=[^&]*', '', url)
        url = re.sub(r'[?&]sslmode=[^&]*', '', url)
        url = re.sub(r'[?&]ssl=[^&]*', '', url)
        # Clean up URL - fix double ? or & and trailing punctuation
        url = url.replace('?&', '?')
        url = url.replace('&&', '&')
        if url.endswith("?") or url.endswith("&"):
            url = url[:-1]
        return url

    # Default to SQLite for local development
    data_dir = get_data_dir()
    db_path = data_dir / 'hopeos.db'
    return f"sqlite+aiosqlite:///{db_path}"


class Settings(BaseSettings):
    # Database
    database_url: str = get_default_database_url()

    # JWT
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # CORS - include Tauri origins for desktop app
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8080",
        "tauri://localhost",
        "http://tauri.localhost",
        "https://tauri.localhost",
    ]

    # OTP
    otp_expiry_minutes: int = 5
    otp_length: int = 6

    # App
    debug: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
