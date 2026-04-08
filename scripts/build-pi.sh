#!/bin/bash
# HopeOS Raspberry Pi Build Script
# Run this ON the Raspberry Pi to build a complete bundled release
# Prerequisites: Node.js 18+, Rust, Python 3.11+

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=========================================="
echo "HopeOS Raspberry Pi Build"
echo -e "==========================================${NC}"

# Check we're on ARM64
if [[ "$(uname -m)" != "aarch64" ]]; then
    echo -e "${YELLOW}Warning: This script is designed for Raspberry Pi (ARM64)${NC}"
    echo "Current architecture: $(uname -m)"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check prerequisites
echo ""
echo "Checking prerequisites..."

command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js not found. Install with: sudo apt install nodejs npm${NC}"; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo -e "${RED}Rust not found. Install with: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh${NC}"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo -e "${RED}Python3 not found. Install with: sudo apt install python3 python3-venv${NC}"; exit 1; }

echo "Node.js: $(node --version)"
echo "Rust: $(cargo --version)"
echo "Python: $(python3 --version)"

# Install system dependencies for Tauri on Linux
echo ""
echo -e "${GREEN}[1/5] Installing system dependencies...${NC}"
sudo apt-get update
sudo apt-get install -y \
    libwebkit2gtk-4.1-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libopenblas-dev \
    cmake \
    build-essential \
    tesseract-ocr

# Build backend
echo ""
echo -e "${GREEN}[2/5] Building Python backend...${NC}"
cd "$PROJECT_ROOT/backend/hopeos-backend"

if [[ ! -d "venv" ]]; then
    python3 -m venv venv
fi
source venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt
pip install pyinstaller

# Build llama-cpp-python with OpenBLAS
echo "Building llama-cpp-python for ARM64 (this may take a while)..."
CMAKE_ARGS="-DGGML_BLAS=ON -DGGML_BLAS_VENDOR=OpenBLAS" \
    pip install llama-cpp-python --no-cache-dir 2>/dev/null || \
    pip install llama-cpp-python --no-cache-dir

# Run PyInstaller
echo "Running PyInstaller..."
pyinstaller --clean --noconfirm hopeos-backend.spec

# Copy to Tauri resources
echo ""
echo -e "${GREEN}[3/5] Copying backend to Tauri...${NC}"
mkdir -p "$PROJECT_ROOT/src-tauri/backend"
cp dist/hopeos-backend "$PROJECT_ROOT/src-tauri/backend/"
chmod +x "$PROJECT_ROOT/src-tauri/backend/hopeos-backend"

# Build frontend
echo ""
echo -e "${GREEN}[4/5] Building frontend...${NC}"
cd "$PROJECT_ROOT"
npm install
npm run build

# Build Tauri
echo ""
echo -e "${GREEN}[5/5] Building Tauri application...${NC}"

# Set environment for WebKitGTK on Pi
export WEBKIT_DISABLE_COMPOSITING_MODE=1

npm run tauri build

# Done
echo ""
echo -e "${GREEN}=========================================="
echo "Build Complete!"
echo -e "==========================================${NC}"
echo ""
echo "Output files:"
ls -la "$PROJECT_ROOT/src-tauri/target/release/bundle/appimage/" 2>/dev/null || true
ls -la "$PROJECT_ROOT/src-tauri/target/release/bundle/deb/" 2>/dev/null || true
echo ""
echo "Install with:"
echo "  sudo dpkg -i src-tauri/target/release/bundle/deb/*.deb"
echo ""
echo "Or run AppImage directly:"
echo "  WEBKIT_DISABLE_COMPOSITING_MODE=1 ./src-tauri/target/release/bundle/appimage/*.AppImage"
