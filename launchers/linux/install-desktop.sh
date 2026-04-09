#!/usr/bin/env bash
# Install HopeOS desktop launcher on Linux
# Usage: Run from the HopeOS project root
#   bash launchers/linux/install-desktop.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

if [[ ! -f "$PROJECT_DIR/setup.sh" ]]; then
    echo "Error: Run this from the HopeOS project directory."
    exit 1
fi

DESKTOP_FILE="$HOME/.local/share/applications/hopeos.desktop"
mkdir -p "$HOME/.local/share/applications"

cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Version=2.0.0
Type=Application
Name=HopeOS
Comment=AI-Powered EHR for Rural Healthcare
Exec=bash -c 'cd "$PROJECT_DIR" && bash setup.sh'
Icon=$PROJECT_DIR/launchers/linux/hopeos-icon.png
Terminal=true
Categories=Science;MedicalSoftware;
StartupNotify=true
EOF

chmod +x "$DESKTOP_FILE"

# Update desktop database if available
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

echo "HopeOS installed! Look for it in your application menu."
