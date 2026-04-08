#!/bin/bash
# HopeOS Raspberry Pi Quick Setup
# Run this on a fresh Raspberry Pi to install HopeOS
#
# Usage: curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/scripts/setup-pi.sh | bash
# Or:    ./scripts/setup-pi.sh

set -e

echo "============================================"
echo "   HopeOS Raspberry Pi Setup"
echo "============================================"
echo ""

# Install prerequisites
echo "[1/4] Installing system dependencies..."
sudo apt update
sudo apt install -y \
    git curl wget \
    libwebkit2gtk-4.1-0 libgtk-3-0 \
    python3 python3-venv

# Setup swap if low RAM
RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
if [ "$RAM_MB" -lt 3500 ] && [ ! -f /swapfile ]; then
    echo "[2/4] Setting up swap for low RAM system..."
    sudo fallocate -l 4G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
else
    echo "[2/4] RAM OK or swap already configured"
fi

# Clone repository
echo "[3/4] Cloning HopeOS..."
if [ -d "$HOME/HopeOS" ]; then
    cd "$HOME/HopeOS"
    git pull
else
    git clone https://github.com/YOUR_ORG/HopeOS.git "$HOME/HopeOS"
    cd "$HOME/HopeOS"
fi

# Build and install
echo "[4/4] Building HopeOS (this takes 30-60 minutes)..."
./scripts/build-pi.sh --install

echo ""
echo "============================================"
echo "   Setup Complete!"
echo "============================================"
echo ""
echo "Launch HopeOS from the application menu or run: hopeos"
echo ""
echo "Data is stored at: ~/.local/share/hopeos/"
echo ""
