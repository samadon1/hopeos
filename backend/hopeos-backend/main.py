# Vercel entry point - imports the FastAPI app from the app package
import sys
import os
from pathlib import Path

# Debug: Print current state
print(f"[VERCEL DEBUG] __file__ = {__file__}")
print(f"[VERCEL DEBUG] cwd = {os.getcwd()}")
print(f"[VERCEL DEBUG] sys.path (before) = {sys.path[:5]}...")

# Add this directory to Python path so 'app' package can be found
_this_dir = Path(__file__).resolve().parent
print(f"[VERCEL DEBUG] _this_dir = {_this_dir}")

# Check if app directory exists
_app_dir = _this_dir / "app"
print(f"[VERCEL DEBUG] app dir exists = {_app_dir.exists()}")
if _app_dir.exists():
    print(f"[VERCEL DEBUG] app dir contents = {list(_app_dir.iterdir())[:5]}...")

# Add to sys.path
if str(_this_dir) not in sys.path:
    sys.path.insert(0, str(_this_dir))
    print(f"[VERCEL DEBUG] Added to sys.path: {_this_dir}")

print(f"[VERCEL DEBUG] sys.path (after) = {sys.path[:5]}...")

# Now import the FastAPI app
from app.main import app

# Export app for Vercel
__all__ = ["app"]
