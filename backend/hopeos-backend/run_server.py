#!/usr/bin/env python3
"""
HopeOS Backend Server Entry Point
This is the entry point for PyInstaller bundling.
"""

import os
import sys
import uvicorn

# Ensure the app module is importable
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    application_path = sys._MEIPASS
else:
    # Running as script
    application_path = os.path.dirname(os.path.abspath(__file__))

# Add to path
sys.path.insert(0, application_path)

def main():
    """Run the HopeOS backend server."""
    # Get port from environment or use default
    port = int(os.environ.get('PORT', 8080))
    host = os.environ.get('HOST', '127.0.0.1')

    print(f"Starting HopeOS Backend on {host}:{port}")
    print(f"Application path: {application_path}")

    # Run uvicorn
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        log_level="info",
        reload=False,  # No reload in production/bundled mode
    )

if __name__ == "__main__":
    main()
