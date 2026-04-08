# Vercel entry point - imports the FastAPI app from the app package
import sys
import os
from pathlib import Path

# Add this directory to Python path so 'app' package can be found
_this_dir = Path(__file__).resolve().parent
if str(_this_dir) not in sys.path:
    sys.path.insert(0, str(_this_dir))

# Import the FastAPI app
from app.main import app

__all__ = ["app"]
