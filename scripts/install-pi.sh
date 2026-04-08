#!/bin/bash
# HopeOS Raspberry Pi Installer
# For BUNDLED release (backend included in app)
# Usage: sudo dpkg -i hopeos.deb && ./install-pi.sh

set -e

echo "=========================================="
echo "HopeOS Raspberry Pi Setup"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running on Raspberry Pi (ARM64)
if [[ "$(uname -m)" != "aarch64" ]]; then
    echo -e "${YELLOW}Warning: This script is designed for Raspberry Pi (ARM64)${NC}"
fi

# 1. Install minimal system dependencies
echo -e "${GREEN}[1/3] Installing system dependencies...${NC}"
sudo apt-get update
sudo apt-get install -y \
    libwebkit2gtk-4.1-0 \
    libgtk-3-0 \
    tesseract-ocr \
    tesseract-ocr-eng

# 2. Create data directory for database and models
echo -e "${GREEN}[2/3] Creating data directories...${NC}"
mkdir -p "$HOME/.local/share/hopeos/models"

# 3. Update desktop launcher to include WebKit fix
echo -e "${GREEN}[3/3] Configuring desktop launcher...${NC}"

# The bundled app auto-starts the backend, but we need the WebKit env var
# Update the system .desktop file if it exists
if [[ -f "/usr/share/applications/hopeos.desktop" ]]; then
    # Create a wrapper script that sets the environment
    sudo tee /usr/local/bin/hopeos-launch > /dev/null << 'LAUNCHER_EOF'
#!/bin/bash
export WEBKIT_DISABLE_COMPOSITING_MODE=1
exec /usr/bin/hopeos "$@"
LAUNCHER_EOF
    sudo chmod +x /usr/local/bin/hopeos-launch

    # Update the desktop file to use the wrapper
    sudo sed -i 's|Exec=/usr/bin/hopeos|Exec=/usr/local/bin/hopeos-launch|g' \
        /usr/share/applications/hopeos.desktop 2>/dev/null || true
fi

# Create user desktop shortcut
mkdir -p "$HOME/Desktop"
cat > "$HOME/Desktop/hopeos.desktop" << 'DESKTOP_EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=HopeOS
Comment=AI-Powered Electronic Health Records
Exec=env WEBKIT_DISABLE_COMPOSITING_MODE=1 /usr/bin/hopeos
Icon=hopeos
Terminal=false
Categories=Medical;Office;
StartupNotify=true
DESKTOP_EOF
chmod +x "$HOME/Desktop/hopeos.desktop"

# Also create in .local/share/applications for menu
mkdir -p "$HOME/.local/share/applications"
cp "$HOME/Desktop/hopeos.desktop" "$HOME/.local/share/applications/"

echo ""
echo -e "${GREEN}=========================================="
echo "HopeOS setup complete!"
echo "=========================================="
echo ""
echo "To start HopeOS:"
echo "  1. Double-click 'HopeOS' on your desktop"
echo "  2. Or run: WEBKIT_DISABLE_COMPOSITING_MODE=1 /usr/bin/hopeos"
echo ""
echo "The bundled app includes the backend - no separate setup needed!"
echo ""
echo "First launch will:"
echo "  - Initialize the database"
echo "  - Download the AI model (~2.3GB) if enabled"
echo ""
echo "Default login: admin / admin123"
echo "==========================================${NC}"
