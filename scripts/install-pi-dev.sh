#!/bin/bash
# HopeOS Raspberry Pi Development Setup
# For running with SEPARATE backend (development mode)
# Use this if you're NOT using the bundled release

set -e

echo "=========================================="
echo "HopeOS Dev Setup (Separate Backend)"
echo "=========================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

HOPEOS_DIR="$HOME/HopeOS"
BACKEND_DIR="$HOPEOS_DIR/backend"

if [[ "$(uname -m)" != "aarch64" ]]; then
    echo -e "${YELLOW}Warning: This script is designed for Raspberry Pi (ARM64)${NC}"
fi

# 1. Install system dependencies
echo -e "${GREEN}[1/6] Installing system dependencies...${NC}"
sudo apt-get update
sudo apt-get install -y \
    python3-full python3-venv python3-pip \
    tesseract-ocr tesseract-ocr-eng \
    libwebkit2gtk-4.1-0 libgtk-3-0 \
    libopenblas-dev cmake build-essential

# 2. Create directory structure
echo -e "${GREEN}[2/6] Creating directory structure...${NC}"
mkdir -p "$HOPEOS_DIR"
mkdir -p "$BACKEND_DIR"
mkdir -p "$HOME/.local/share/hopeos"

# 3. Check for backend
echo -e "${GREEN}[3/6] Checking for backend...${NC}"
if [[ ! -d "$BACKEND_DIR/app" ]]; then
    echo -e "${YELLOW}Backend not found at $BACKEND_DIR${NC}"
    echo "Please copy the backend directory from your development machine:"
    echo "  scp -r backend/hopeos-backend/* pi@<pi-ip>:~/HopeOS/backend/"
    echo ""
    read -p "Press Enter after copying, or Ctrl+C to exit..."
fi

# 4. Setup Python environment
echo -e "${GREEN}[4/6] Setting up Python environment...${NC}"
cd "$BACKEND_DIR"

if [[ ! -d "venv" ]]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip

echo "Installing Python dependencies..."
pip install fastapi uvicorn sqlalchemy aiosqlite pydantic pydantic-settings \
    email-validator python-jose bcrypt python-multipart httpx alembic greenlet

echo "Installing llama-cpp-python for AI features..."
CMAKE_ARGS="-DGGML_BLAS=ON -DGGML_BLAS_VENDOR=OpenBLAS" \
    pip install llama-cpp-python --no-cache-dir 2>/dev/null || \
    pip install llama-cpp-python --no-cache-dir || \
    echo -e "${YELLOW}llama-cpp-python failed - AI features will be limited${NC}"

pip install huggingface_hub || true

# 5. Create startup script
echo -e "${GREEN}[5/6] Creating startup script...${NC}"
cat > "$HOPEOS_DIR/start-hopeos.sh" << 'STARTUP_EOF'
#!/bin/bash
# HopeOS Startup Script (Development Mode)

BACKEND_DIR="$HOME/HopeOS/backend"

# Kill any existing backend
pkill -f "uvicorn app.main:app" 2>/dev/null || true
sleep 1

# Start backend
cd "$BACKEND_DIR"
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080 &
BACKEND_PID=$!

echo "Starting HopeOS backend..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8080/health > /dev/null 2>&1; then
        echo "Backend ready!"
        break
    fi
    sleep 1
done

# Launch Tauri app
export WEBKIT_DISABLE_COMPOSITING_MODE=1
/usr/bin/hopeos 2>/dev/null || ~/HopeOS/hopeos.AppImage

# Cleanup
kill $BACKEND_PID 2>/dev/null || true
STARTUP_EOF
chmod +x "$HOPEOS_DIR/start-hopeos.sh"

# 6. Create desktop launcher
echo -e "${GREEN}[6/6] Creating desktop launcher...${NC}"
mkdir -p "$HOME/Desktop" "$HOME/.local/share/applications"

cat > "$HOME/Desktop/hopeos.desktop" << DESKTOP_EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=HopeOS (Dev)
Comment=AI-Powered EHR - Development Mode
Exec=$HOPEOS_DIR/start-hopeos.sh
Icon=hopeos
Terminal=false
Categories=Medical;Office;
DESKTOP_EOF
chmod +x "$HOME/Desktop/hopeos.desktop"
cp "$HOME/Desktop/hopeos.desktop" "$HOME/.local/share/applications/"

echo ""
echo -e "${GREEN}=========================================="
echo "HopeOS dev setup complete!"
echo "=========================================="
echo ""
echo "To start: $HOPEOS_DIR/start-hopeos.sh"
echo "Default login: admin / admin123"
echo "==========================================${NC}"
