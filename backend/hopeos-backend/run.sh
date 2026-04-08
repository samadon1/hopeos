#!/bin/bash
# Quick start script for HopeOS Backend

set -e

cd "$(dirname "$0")"

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Copy .env.example to .env if .env doesn't exist
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
fi

# Run database migrations / initialize
echo "Initializing database..."
python -c "
import asyncio
from app.database import init_db
asyncio.run(init_db())
print('Database initialized')
"

# Seed admin users
echo "Seeding admin users..."
python -m app.services.seed

# Start server
echo ""
echo "Starting FastAPI server..."
echo "API docs available at: http://localhost:8000/docs"
echo ""
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
