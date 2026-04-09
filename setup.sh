#!/usr/bin/env bash
# =============================================================================
# HopeOS — One-Click Setup Script
# Installs all dependencies, downloads the AI model, and starts the system.
# Works on macOS (Intel/Apple Silicon) and Linux (x86_64/aarch64 incl. RPi 4/5)
#
# Usage:  chmod +x setup.sh && ./setup.sh
# =============================================================================

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
BACKEND_PORT=8080
FRONTEND_PORT=3001
OLLAMA_MODEL="hopeos-gemma4-iq2"
HF_MODEL_URL="https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-UD-IQ2_M.gguf"
GGUF_FILENAME="gemma-4-E2B-it-UD-IQ2_M.gguf"

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend/hopeos-backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Status file for splash screen ───────────────────────────────────────────
STATUS_FILE="/tmp/hopeos_status.json"
SPLASH_PORT=3099
SPLASH_PID=""

update_status() {
    local step="$1"
    local detail="${2:-}"
    echo "{\"step\":\"$step\",\"detail\":\"$detail\"}" > "$STATUS_FILE"
}

# ── Helpers ──────────────────────────────────────────────────────────────────
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()    { echo -e "${RED}[FAIL]${NC} $*"; update_status "error" "$*"; exit 1; }

command_exists() { command -v "$1" &>/dev/null; }

# Track background PIDs for cleanup
PIDS=()
cleanup() {
    echo ""
    info "Shutting down..."
    # Stop splash server
    if [[ -n "$SPLASH_PID" ]]; then
        kill "$SPLASH_PID" 2>/dev/null || true
    fi
    for pid in "${PIDS[@]+"${PIDS[@]}"}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
    rm -f "$STATUS_FILE"
    success "All services stopped."
}
trap cleanup EXIT INT TERM

# ── Platform Detection ───────────────────────────────────────────────────────
detect_platform() {
    OS="$(uname -s)"
    ARCH="$(uname -m)"

    case "$OS" in
        Darwin) PLATFORM="macos" ;;
        Linux)  PLATFORM="linux" ;;
        *)      fail "Unsupported OS: $OS" ;;
    esac

    case "$ARCH" in
        x86_64)         ARCH_TYPE="x86_64" ;;
        arm64|aarch64)  ARCH_TYPE="arm64" ;;
        *)              fail "Unsupported architecture: $ARCH" ;;
    esac

    info "Platform: $PLATFORM ($ARCH_TYPE)"
}

# ── Install Prerequisites ────────────────────────────────────────────────────
install_homebrew() {
    if ! command_exists brew; then
        info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        # Add to PATH for Apple Silicon
        if [[ -f /opt/homebrew/bin/brew ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
        success "Homebrew installed."
    fi
}

install_python() {
    if command_exists python3; then
        PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
        PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
        if [[ "$PY_MAJOR" -ge 3 && "$PY_MINOR" -ge 11 ]]; then
            success "Python $PY_VER found."
            return
        fi
        warn "Python $PY_VER found but 3.11+ required."
    fi

    info "Installing Python 3.11+..."
    if [[ "$PLATFORM" == "macos" ]]; then
        brew install python@3.11
    else
        sudo apt-get update -qq
        sudo apt-get install -y -qq python3 python3-venv python3-pip
    fi
    success "Python installed."
}

install_node() {
    if command_exists node; then
        NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
        if [[ "$NODE_VER" -ge 18 ]]; then
            success "Node.js v$(node -v | sed 's/v//') found."
            return
        fi
        warn "Node.js v$(node -v) found but 18+ required."
    fi

    info "Installing Node.js 18+..."
    if [[ "$PLATFORM" == "macos" ]]; then
        brew install node
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y -qq nodejs
    fi
    success "Node.js installed."
}

install_ollama() {
    if command_exists ollama; then
        success "Ollama found."
        return
    fi

    info "Installing Ollama..."
    if [[ "$PLATFORM" == "macos" ]]; then
        brew install ollama
    else
        curl -fsSL https://ollama.com/install.sh | sh
    fi
    success "Ollama installed."
}

# ── Start Ollama ─────────────────────────────────────────────────────────────
start_ollama() {
    # Check if Ollama is already serving
    if curl -sf http://localhost:11434/api/tags &>/dev/null; then
        success "Ollama already running."
        return
    fi

    info "Starting Ollama..."
    if [[ "$PLATFORM" == "macos" ]]; then
        brew services start ollama 2>/dev/null || true
    else
        sudo systemctl start ollama 2>/dev/null || ollama serve &>/dev/null &
    fi

    # Wait for Ollama to be ready
    for i in $(seq 1 30); do
        if curl -sf http://localhost:11434/api/tags &>/dev/null; then
            success "Ollama started."
            return
        fi
        sleep 1
    done
    fail "Ollama failed to start after 30 seconds."
}

# ── Download & Import Model ──────────────────────────────────────────────────
setup_model() {
    # Check if model already exists in Ollama
    # Note: use a variable to avoid pipefail + SIGPIPE issue with grep -q
    local model_list
    model_list="$(ollama list 2>/dev/null || true)"
    if echo "$model_list" | grep -q "$OLLAMA_MODEL"; then
        success "Model '$OLLAMA_MODEL' already loaded in Ollama."
        return
    fi

    info "Downloading Gemma 4 E2B model (~2.3 GB)... This may take a few minutes."

    TEMP_DIR=$(mktemp -d)
    GGUF_PATH="$TEMP_DIR/$GGUF_FILENAME"

    # Download with progress
    if command_exists wget; then
        wget -q --show-progress -O "$GGUF_PATH" "$HF_MODEL_URL"
    else
        curl -L --progress-bar -o "$GGUF_PATH" "$HF_MODEL_URL"
    fi

    # Create Modelfile and import
    echo "FROM ./$GGUF_FILENAME" > "$TEMP_DIR/Modelfile"
    info "Importing model into Ollama..."
    cd "$TEMP_DIR"
    ollama create "$OLLAMA_MODEL" -f Modelfile
    cd "$SCRIPT_DIR"

    # Clean up temp files
    rm -rf "$TEMP_DIR"
    success "Model '$OLLAMA_MODEL' ready."
}

# ── Backend Setup ────────────────────────────────────────────────────────────
setup_backend() {
    info "Setting up backend..."
    cd "$BACKEND_DIR"

    # Create venv if needed
    if [[ ! -d "$VENV_DIR" ]]; then
        python3 -m venv "$VENV_DIR"
    fi

    # Activate and install
    source "$VENV_DIR/bin/activate"
    pip install -q -r requirements.txt

    # Create .env if needed
    if [[ ! -f .env ]]; then
        cp .env.example .env
    fi

    # Initialize database
    python -c "
import asyncio
from app.database import init_db
asyncio.run(init_db())
" 2>/dev/null

    # Seed admin users
    python -m app.services.seed 2>/dev/null || true

    deactivate
    cd "$SCRIPT_DIR"
    success "Backend ready."
}

# ── Frontend Setup ───────────────────────────────────────────────────────────
setup_frontend() {
    info "Setting up frontend..."
    cd "$FRONTEND_DIR"

    if [[ ! -d node_modules ]]; then
        npm install --silent
    else
        success "Node modules already installed."
    fi

    cd "$SCRIPT_DIR"
    success "Frontend ready."
}

# ── Launch Services ──────────────────────────────────────────────────────────
launch() {
    echo ""
    echo -e "${BOLD}========================================${NC}"
    echo -e "${BOLD}  Starting HopeOS...${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo ""

    # Start backend
    info "Starting backend on port $BACKEND_PORT..."
    cd "$BACKEND_DIR"
    source "$VENV_DIR/bin/activate"
    uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" &
    PIDS+=($!)
    cd "$SCRIPT_DIR"

    # Start frontend
    info "Starting frontend on port $FRONTEND_PORT..."
    cd "$FRONTEND_DIR"
    npm run dev &
    PIDS+=($!)
    cd "$SCRIPT_DIR"

    # Wait for frontend to be ready
    info "Waiting for services to start..."
    for i in $(seq 1 30); do
        if curl -sf "http://localhost:$FRONTEND_PORT" &>/dev/null; then
            break
        fi
        sleep 1
    done

    # Signal ready — splash page will auto-redirect
    update_status "ready" ""

    echo ""
    echo -e "${GREEN}${BOLD}========================================${NC}"
    echo -e "${GREEN}${BOLD}  HopeOS is running!${NC}"
    echo -e "${GREEN}${BOLD}========================================${NC}"
    echo ""
    echo -e "  Frontend:  ${BOLD}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "  Backend:   ${BOLD}http://localhost:$BACKEND_PORT${NC}"
    echo -e "  API Docs:  ${BOLD}http://localhost:$BACKEND_PORT/docs${NC}"
    echo ""
    echo -e "  Press ${BOLD}Ctrl+C${NC} to stop all services."
    echo ""

    # If no splash server was running, open browser directly
    if [[ -z "$SPLASH_PID" ]]; then
        if [[ "$PLATFORM" == "macos" ]]; then
            open "http://localhost:$FRONTEND_PORT" 2>/dev/null || true
        elif command_exists xdg-open; then
            xdg-open "http://localhost:$FRONTEND_PORT" 2>/dev/null || true
        fi
    fi

    # Stop splash server after redirect delay
    sleep 3
    if [[ -n "$SPLASH_PID" ]]; then
        kill "$SPLASH_PID" 2>/dev/null || true
        SPLASH_PID=""
    fi

    # Keep running until Ctrl+C
    wait
}

# ── Main ─────────────────────────────────────────────────────────────────────
main() {
    echo ""
    echo -e "${BOLD}========================================${NC}"
    echo -e "${BOLD}  HopeOS Setup${NC}"
    echo -e "${BOLD}  AI-Powered EHR for Rural Healthcare${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo ""

    # Start splash screen server and open browser
    update_status "platform" "Starting..."
    if [[ -f "$SCRIPT_DIR/launchers/splash_server.py" ]]; then
        # Kill any existing splash server
        local existing_pid
        existing_pid=$(lsof -ti:$SPLASH_PORT 2>/dev/null || true)
        if [[ -n "$existing_pid" ]]; then
            kill $existing_pid 2>/dev/null || true
            sleep 0.5
        fi
        python3 "$SCRIPT_DIR/launchers/splash_server.py" &
        SPLASH_PID=$!
        sleep 1
        # Open browser to splash screen
        if [[ "${HOPEOS_NO_BROWSER:-}" != "1" ]]; then
            if [[ "$(uname -s)" == "Darwin" ]]; then
                open "http://localhost:$SPLASH_PORT" 2>/dev/null || true
            elif command_exists xdg-open; then
                xdg-open "http://localhost:$SPLASH_PORT" 2>/dev/null || true
            fi
        fi
    fi

    update_status "platform" "Detecting hardware..."
    detect_platform

    # Step 1: Prerequisites
    update_status "prerequisites" "Checking Python, Node.js, Ollama..."
    info "Checking prerequisites..."
    [[ "$PLATFORM" == "macos" ]] && install_homebrew
    install_python
    update_status "prerequisites" "Installing Node.js..."
    install_node
    update_status "prerequisites" "Installing Ollama..."
    install_ollama

    # Step 2: Ollama + Model
    update_status "ollama" "Starting Ollama..."
    start_ollama
    update_status "model" "Loading AI model (~2.3 GB)..."
    setup_model

    # Step 3: Backend
    update_status "backend" "Installing Python dependencies..."
    setup_backend

    # Step 4: Frontend
    update_status "frontend" "Installing frontend dependencies..."
    setup_frontend

    # Step 5: Launch
    launch
}

main "$@"
