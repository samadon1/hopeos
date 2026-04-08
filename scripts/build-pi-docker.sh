#!/bin/bash
# HopeOS Raspberry Pi Build via Docker (from Mac/Linux x86)
# Cross-compiles ARM64 .deb using Docker ARM64 emulation
#
# Prerequisites:
#   - Docker Desktop with "Use Rosetta for x86_64/amd64 emulation" DISABLED
#   - Docker buildx (included in Docker Desktop)
#
# Usage: ./scripts/build-pi-docker.sh

set -e

echo "============================================"
echo "   HopeOS Raspberry Pi Docker Build"
echo "============================================"
echo ""

cd "$(dirname "$0")/.."
PROJECT_DIR=$(pwd)

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker not found. Install Docker Desktop first."
    exit 1
fi

# Check/setup buildx for ARM64 emulation
echo "[1/3] Setting up Docker ARM64 builder..."
if ! docker buildx ls | grep -q "arm64"; then
    # Create a new builder with ARM64 support
    docker buildx create --name arm64builder --platform linux/arm64 --use 2>/dev/null || true
fi

# Enable QEMU for ARM64 if needed
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes 2>/dev/null || true

echo "[2/3] Building ARM64 image (this takes 30-60 minutes first time)..."
echo "       Using QEMU emulation for ARM64 on your Mac."
echo ""

# Create output directory
mkdir -p "$PROJECT_DIR/dist-pi"

# Build using Docker buildx with ARM64 platform
docker buildx build \
    --platform linux/arm64 \
    --file scripts/Dockerfile.pi-build \
    --target export \
    --output type=local,dest=dist-pi \
    . 2>&1 || {
    # If export target doesn't exist, build normally and extract
    echo ""
    echo "Building complete image..."

    docker buildx build \
        --platform linux/arm64 \
        --file scripts/Dockerfile.pi-build \
        --tag hopeos-pi-builder:latest \
        --load \
        .

    echo ""
    echo "[3/3] Extracting .deb from container..."

    # Create container and copy out the .deb
    CONTAINER_ID=$(docker create hopeos-pi-builder:latest)
    docker cp "$CONTAINER_ID:/build/src-tauri/target/release/bundle/deb/" "$PROJECT_DIR/dist-pi/" 2>/dev/null || true
    docker cp "$CONTAINER_ID:/build/src-tauri/target/release/bundle/appimage/" "$PROJECT_DIR/dist-pi/" 2>/dev/null || true
    docker rm "$CONTAINER_ID"
}

echo ""
echo "============================================"
echo "   Build Complete!"
echo "============================================"
echo ""
echo "Output files in: $PROJECT_DIR/dist-pi/"
ls -la "$PROJECT_DIR/dist-pi/" 2>/dev/null || echo "Check dist-pi/deb/ for .deb file"
echo ""
echo "Transfer to Pi:"
echo "  scp dist-pi/deb/*.deb user@hopeos.local:~/"
echo ""
echo "Install on Pi:"
echo "  sudo dpkg -i ~/HopeOS*.deb"
echo ""
