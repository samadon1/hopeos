#!/usr/bin/env bash
# =============================================================================
# HopeOS — Build Desktop Launchers
# Generates a macOS .app bundle and Linux .desktop launcher
# that wrap setup.sh for double-click usage.
#
# Usage:  chmod +x scripts/build-desktop.sh && ./scripts/build-desktop.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$PROJECT_DIR/launchers"

# ── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }

# ── Clean output ─────────────────────────────────────────────────────────────
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# =============================================================================
# macOS .app Bundle
# =============================================================================
build_macos_app() {
    info "Building macOS .app bundle..."

    APP_NAME="HopeOS"
    APP_DIR="$OUTPUT_DIR/$APP_NAME.app"
    CONTENTS="$APP_DIR/Contents"
    MACOS_DIR="$CONTENTS/MacOS"
    RESOURCES="$CONTENTS/Resources"

    mkdir -p "$MACOS_DIR" "$RESOURCES"

    # ── Info.plist ───────────────────────────────────────────────────────────
    cat > "$CONTENTS/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>HopeOS</string>
    <key>CFBundleDisplayName</key>
    <string>HopeOS</string>
    <key>CFBundleIdentifier</key>
    <string>com.hopeos.launcher</string>
    <key>CFBundleVersion</key>
    <string>2.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>2.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>hopeos-launcher</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <false/>
</dict>
</plist>
PLIST

    # ── Launcher script ─────────────────────────────────────────────────────
    cat > "$MACOS_DIR/hopeos-launcher" << 'LAUNCHER'
#!/usr/bin/env bash
# HopeOS macOS Launcher
# Runs setup.sh inside a Terminal window so the user can see progress.

set -euo pipefail

# Resolve the project root (3 levels up from Contents/MacOS/)
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# If the .app is inside the project, use the project's setup.sh
# Otherwise look for setup.sh relative to where the .app was placed
find_project_root() {
    # Check if we're inside the project tree
    local dir="$APP_DIR"
    for _ in 1 2 3 4 5; do
        dir="$(dirname "$dir")"
        if [[ -f "$dir/setup.sh" ]]; then
            echo "$dir"
            return
        fi
    done

    # Check common locations
    if [[ -f "$HOME/HopeOS/setup.sh" ]]; then
        echo "$HOME/HopeOS"
        return
    fi

    # Fallback: same directory as the .app
    local app_parent="$(dirname "$APP_DIR")"
    if [[ -f "$app_parent/setup.sh" ]]; then
        echo "$app_parent"
        return
    fi

    echo ""
}

PROJECT_ROOT="$(find_project_root)"

if [[ -z "$PROJECT_ROOT" || ! -f "$PROJECT_ROOT/setup.sh" ]]; then
    osascript -e 'display alert "HopeOS" message "Could not find setup.sh. Make sure HopeOS.app is inside the HopeOS project folder." as critical'
    exit 1
fi

# Run setup.sh in background, Terminal stays hidden
osascript << EOF
tell application "Terminal"
    do script "cd '$PROJECT_ROOT' && bash setup.sh"
    -- Minimize the terminal window
    delay 1
    try
        set miniaturized of front window to true
    end try
end tell
EOF
LAUNCHER

    chmod +x "$MACOS_DIR/hopeos-launcher"

    # ── Generate a simple icon (blue circle with H) ─────────────────────────
    # If iconutil is available and we have an icon source, use it
    # Otherwise create a minimal placeholder
    if command -v sips &>/dev/null; then
        generate_macos_icon "$RESOURCES"
    fi

    success "macOS app: $APP_DIR"
}

# Generate a basic app icon using macOS built-in tools
generate_macos_icon() {
    local resources_dir="$1"
    local iconset_dir="$resources_dir/AppIcon.iconset"
    mkdir -p "$iconset_dir"

    # Create a simple SVG-like icon using Python (available on macOS)
    python3 << 'PYICON' - "$iconset_dir"
import sys, struct, zlib

iconset_dir = sys.argv[1]

def create_png(size, filepath):
    """Create a simple blue square PNG with 'H+' text-like pattern."""
    # Simple solid blue icon with a lighter cross/plus shape
    pixels = []
    for y in range(size):
        row = []
        for x in range(size):
            # Blue background
            r, g, b = 37, 99, 235  # Blue-600

            # Draw a simple "H" shape in white
            margin = size // 5
            bar_w = max(size // 8, 2)
            mid_y = size // 2

            in_left_bar = (margin <= x < margin + bar_w) and (margin <= y < size - margin)
            in_right_bar = (size - margin - bar_w <= x < size - margin) and (margin <= y < size - margin)
            in_cross_bar = (margin <= x < size - margin) and (mid_y - bar_w // 2 <= y < mid_y + bar_w // 2 + 1)

            # Small plus/cross in bottom right for "health"
            plus_cx = size - margin - bar_w // 2
            plus_cy = size - margin - bar_w // 2
            plus_size = max(size // 10, 2)

            in_plus_h = (plus_cx - plus_size <= x <= plus_cx + plus_size) and (plus_cy - 1 <= y <= plus_cy + 1)
            in_plus_v = (plus_cx - 1 <= x <= plus_cx + 1) and (plus_cy - plus_size <= y <= plus_cy + plus_size)

            if in_left_bar or in_right_bar or in_cross_bar:
                r, g, b = 255, 255, 255
            elif in_plus_h or in_plus_v:
                r, g, b = 134, 239, 172  # Green-300

            # Round corners
            corner_r = size // 5
            for cx, cy in [(corner_r, corner_r), (size - corner_r - 1, corner_r),
                           (corner_r, size - corner_r - 1), (size - corner_r - 1, size - corner_r - 1)]:
                dx, dy = x - cx, y - cy
                in_corner_zone = (
                    (x < corner_r or x >= size - corner_r) and
                    (y < corner_r or y >= size - corner_r)
                )
                if in_corner_zone and (dx * dx + dy * dy) > corner_r * corner_r:
                    r, g, b = 0, 0, 0
                    row.append(bytes([r, g, b, 0]))  # Transparent
                    break
            else:
                row.append(bytes([r, g, b, 255]))
                continue
            continue

        pixels.append(b''.join(row))

    # Build PNG
    def make_png(width, height, rows):
        def chunk(ctype, data):
            c = ctype + data
            return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

        raw = b''
        for row in rows:
            raw += b'\x00' + row  # filter byte

        return (b'\x89PNG\r\n\x1a\n' +
                chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)) +
                chunk(b'IDAT', zlib.compress(raw)) +
                chunk(b'IEND', b''))

    with open(filepath, 'wb') as f:
        f.write(make_png(size, size, pixels))

sizes = {
    'icon_16x16.png': 16,
    'icon_16x16@2x.png': 32,
    'icon_32x32.png': 32,
    'icon_32x32@2x.png': 64,
    'icon_128x128.png': 128,
    'icon_128x128@2x.png': 256,
    'icon_256x256.png': 256,
    'icon_256x256@2x.png': 512,
    'icon_512x512.png': 512,
    'icon_512x512@2x.png': 1024,
}

import os
for name, sz in sizes.items():
    create_png(sz, os.path.join(iconset_dir, name))

print(f"Generated {len(sizes)} icon sizes")
PYICON

    # Convert iconset to icns
    if command -v iconutil &>/dev/null; then
        iconutil -c icns "$iconset_dir" -o "$resources_dir/AppIcon.icns" 2>/dev/null && {
            rm -rf "$iconset_dir"
            success "App icon generated."
        } || {
            info "Icon conversion failed (non-fatal), app will use default icon."
            rm -rf "$iconset_dir"
        }
    fi
}

# =============================================================================
# Linux .desktop Launcher
# =============================================================================
build_linux_launcher() {
    info "Building Linux .desktop launcher..."

    local linux_dir="$OUTPUT_DIR/linux"
    mkdir -p "$linux_dir"

    # ── Desktop entry ────────────────────────────────────────────────────────
    cat > "$linux_dir/hopeos.desktop" << 'DESKTOP'
[Desktop Entry]
Version=2.0.0
Type=Application
Name=HopeOS
Comment=AI-Powered EHR for Rural Healthcare
Exec=bash -c 'PROJECT_DIR="$(dirname "$(readlink -f "%k")")"; if [ -f "$PROJECT_DIR/setup.sh" ]; then cd "$PROJECT_DIR" && x-terminal-emulator -e bash setup.sh 2>/dev/null || gnome-terminal -- bash setup.sh 2>/dev/null || xterm -e bash setup.sh; else echo "Error: setup.sh not found. Place hopeos.desktop in the HopeOS project root."; read -p "Press Enter..."; fi'
Icon=hopeos
Terminal=false
Categories=Science;MedicalSoftware;
StartupNotify=true
DESKTOP

    chmod +x "$linux_dir/hopeos.desktop"

    # ── Install script for Linux ─────────────────────────────────────────────
    cat > "$linux_dir/install-desktop.sh" << 'INSTALL'
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
INSTALL

    chmod +x "$linux_dir/install-desktop.sh"

    # Generate a simple PNG icon for Linux
    python3 << 'PYICON' - "$linux_dir/hopeos-icon.png"
import sys, struct, zlib

filepath = sys.argv[1]
size = 256

pixels = []
for y in range(size):
    row = []
    for x in range(size):
        r, g, b, a = 37, 99, 235, 255
        margin = size // 5
        bar_w = max(size // 8, 2)
        mid_y = size // 2

        in_left = (margin <= x < margin + bar_w) and (margin <= y < size - margin)
        in_right = (size - margin - bar_w <= x < size - margin) and (margin <= y < size - margin)
        in_cross = (margin <= x < size - margin) and (mid_y - bar_w // 2 <= y < mid_y + bar_w // 2 + 1)

        if in_left or in_right or in_cross:
            r, g, b = 255, 255, 255

        # Round corners
        corner_r = size // 5
        for cx, cy in [(corner_r, corner_r), (size - corner_r - 1, corner_r),
                       (corner_r, size - corner_r - 1), (size - corner_r - 1, size - corner_r - 1)]:
            dx, dy = x - cx, y - cy
            in_zone = (x < corner_r or x >= size - corner_r) and (y < corner_r or y >= size - corner_r)
            if in_zone and (dx * dx + dy * dy) > corner_r * corner_r:
                a = 0
                break

        row.append(bytes([r, g, b, a]))
    pixels.append(b''.join(row))

def chunk(ctype, data):
    c = ctype + data
    return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

raw = b''
for row in pixels:
    raw += b'\x00' + row

png = (b'\x89PNG\r\n\x1a\n' +
       chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)) +
       chunk(b'IDAT', zlib.compress(raw)) +
       chunk(b'IEND', b''))

with open(filepath, 'wb') as f:
    f.write(png)
print(f"Generated {size}x{size} icon")
PYICON

    success "Linux launcher: $linux_dir/"
}

# =============================================================================
# Main
# =============================================================================
echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  HopeOS Desktop Launcher Builder${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""

# Always build both platforms so the repo has everything ready
build_macos_app
build_linux_launcher

echo ""
echo -e "${BOLD}macOS:${NC}"
echo "  Double-click ${BOLD}launchers/HopeOS.app${NC}"
echo "  (First launch: right-click > Open to bypass Gatekeeper)"
echo ""
echo -e "${BOLD}Linux/RPi:${NC}"
echo "  Option A: Copy ${BOLD}launchers/linux/hopeos.desktop${NC} to project root, double-click"
echo "  Option B: Run ${BOLD}bash launchers/linux/install-desktop.sh${NC} to add to app menu"

echo ""
success "Done!"
