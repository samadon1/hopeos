#!/bin/bash
# HopeOS Pi 4 Build Setup Script
# Run this on your Raspberry Pi 4 after copying the project

set -e

echo "============================================"
echo "   HopeOS Pi 4 Build Setup"
echo "============================================"
echo ""

# Check RAM and setup swap if needed
RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
echo "Detected RAM: ${RAM_MB}MB"

if [ "$RAM_MB" -lt 3500 ]; then
    echo "Low RAM detected. Setting up 4GB swap..."
    if [ ! -f /swapfile ]; then
        sudo fallocate -l 4G /swapfile
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
        echo "Swap configured."
    else
        echo "Swap already exists."
    fi
else
    echo "RAM is sufficient."
fi

echo ""
echo "[1/5] Updating system packages..."
sudo apt update
sudo apt upgrade -y

echo ""
echo "[2/5] Installing build dependencies..."
sudo apt install -y \
    curl \
    wget \
    git \
    build-essential \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libwebkit2gtk-4.1-dev \
    python3-pip \
    python3-venv \
    python3-dev

echo ""
echo "[3/5] Installing Node.js 20..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "Node.js $(node -v) already installed."
fi

echo ""
echo "[4/5] Installing Rust..."
if ! command -v rustc &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo "Rust $(rustc --version) already installed."
fi

# Ensure cargo is in path for current session
export PATH="$HOME/.cargo/bin:$PATH"

echo ""
echo "[5/5] Installing Tauri CLI..."
if ! command -v cargo-tauri &> /dev/null; then
    cargo install tauri-cli
else
    echo "Tauri CLI already installed."
fi

echo ""
echo "============================================"
echo "   Setup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. Make sure HopeOS project is in ~/HopeOS"
echo ""
echo "  2. Build the desktop app:"
echo "     cd ~/HopeOS"
echo "     npm install"
echo "     ./scripts/build-desktop.sh"
echo ""
echo "  3. Install the .deb:"
echo "     sudo dpkg -i src-tauri/target/release/bundle/deb/*.deb"
echo ""
echo "  4. Launch HopeOS from your app menu!"
echo ""
echo "Note: First Rust build takes 30-60 minutes on Pi 4."
echo "      Grab a coffee ☕"
echo ""
