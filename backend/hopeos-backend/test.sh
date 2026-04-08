#!/bin/bash
# Run tests for HopeOS Backend

set -e

cd "$(dirname "$0")"

# Activate virtual environment if it exists
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Install test dependencies
pip install -q pytest pytest-asyncio httpx

# Run tests
echo "Running tests..."
python -m pytest tests/ "$@"
