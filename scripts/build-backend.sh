#!/bin/bash
# Build the HopeOS backend as a standalone executable
set -e

echo "Building HopeOS Backend..."

cd "$(dirname "$0")/../backend"

# Activate virtual environment if it exists
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Install PyInstaller if not present
pip install pyinstaller

# Build the executable
pyinstaller hopeos-backend.spec --distpath dist --noconfirm

echo ""
echo "Build complete! Executable is at: backend/dist/hopeos-backend"
echo ""
echo "To build the full desktop app, run:"
echo "  npm run desktop:build"
