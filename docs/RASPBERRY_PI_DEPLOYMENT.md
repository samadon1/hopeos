# HopeOS Raspberry Pi Deployment Guide

This guide covers deploying HopeOS as a desktop application on Raspberry Pi 4 (ARM64).

## Overview

HopeOS is an AI-powered Electronic Health Records system that runs as a Tauri desktop app with a FastAPI backend. On Raspberry Pi, it uses:

- **Frontend**: Tauri v2 with WebKitGTK
- **Backend**: Python FastAPI with SQLite
- **AI**: Gemma 4 via llama-cpp-python with GPU acceleration

## Prerequisites

- Raspberry Pi 4 (4GB+ RAM recommended, 8GB for AI features)
- Raspberry Pi OS (64-bit) - Bookworm or newer
- At least 16GB storage (32GB+ recommended for AI models)
- Display connected (HDMI)

## Quick Install (Pre-built Package)

### 1. Install the .deb Package

```bash
# Download the package (replace with actual URL)
wget https://github.com/hopeos/releases/download/v1.0.0/hopeos_1.0.0_arm64.deb

# Install
sudo dpkg -i hopeos_1.0.0_arm64.deb
sudo apt-get install -f  # Fix any missing dependencies
```

### 2. Run the Setup Script

```bash
# Run the automated installer
bash /usr/share/hopeos/scripts/install-pi.sh

# Or if you have the source:
bash ~/HopeOS/scripts/install-pi.sh
```

This script will:
- Install system dependencies (Python, Tesseract, WebKit, etc.)
- Create a Python virtual environment
- Install all Python packages (including llama-cpp-python)
- Create startup scripts and desktop launcher
- Initialize the database with admin user

### 3. Launch HopeOS

Double-click "HopeOS" on your desktop, or run:

```bash
~/HopeOS/start-hopeos.sh
```

### 4. Login

- **Username**: `admin`
- **Password**: `admin123`

---

## Manual Installation (From Source)

### 1. Install System Dependencies

```bash
sudo apt-get update
sudo apt-get install -y \
    python3-full \
    python3-venv \
    python3-pip \
    tesseract-ocr \
    tesseract-ocr-eng \
    libwebkit2gtk-4.1-0 \
    libgtk-3-0 \
    libopenblas-dev \
    cmake \
    build-essential \
    curl
```

### 2. Set Up Directory Structure

```bash
mkdir -p ~/HopeOS/backend
mkdir -p ~/.local/share/hopeos
```

### 3. Copy Backend Files

Copy the backend source code to `~/HopeOS/backend/`:

```bash
# If you have the source tarball
tar -xzf hopeos-backend.tar.gz -C ~/HopeOS/backend/

# Or copy from mounted drive/network
cp -r /path/to/hopeos-backend/* ~/HopeOS/backend/
```

### 4. Set Up Python Environment

```bash
cd ~/HopeOS/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip

# Install core dependencies
pip install fastapi uvicorn sqlalchemy aiosqlite pydantic pydantic-settings \
    email-validator python-jose bcrypt python-multipart httpx alembic greenlet

# Install llama-cpp-python (takes 10-20 minutes on Pi)
CMAKE_ARGS="-DGGML_BLAS=ON -DGGML_BLAS_VENDOR=OpenBLAS" \
    pip install llama-cpp-python --no-cache-dir

# Install model downloader
pip install huggingface_hub
```

### 5. Create Startup Script

```bash
cat > ~/HopeOS/start-hopeos.sh << 'EOF'
#!/bin/bash
BACKEND_DIR="$HOME/HopeOS/backend"

# Kill any existing backend
pkill -f "uvicorn app.main:app" 2>/dev/null || true
sleep 1

# Start backend
cd "$BACKEND_DIR"
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080 &
BACKEND_PID=$!

# Wait for backend
echo "Starting HopeOS backend..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8080/health > /dev/null 2>&1; then
        echo "Backend ready!"
        break
    fi
    sleep 1
done

# Launch app with WebKit fix
export WEBKIT_DISABLE_COMPOSITING_MODE=1
/usr/bin/hopeos

# Cleanup
kill $BACKEND_PID 2>/dev/null || true
EOF

chmod +x ~/HopeOS/start-hopeos.sh
```

### 6. Create Desktop Launcher

```bash
sudo tee /usr/share/applications/hopeos.desktop << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=HopeOS
Comment=AI-Powered Electronic Health Records
Exec=$HOME/HopeOS/start-hopeos.sh
Icon=hopeos
Terminal=false
Categories=Medical;Office;
EOF

# Copy to desktop
cp /usr/share/applications/hopeos.desktop ~/Desktop/
chmod +x ~/Desktop/hopeos.desktop
```

### 7. Create Admin User

Start the backend first, then create the admin user:

```bash
cd ~/HopeOS/backend
source venv/bin/activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8080 &
sleep 10

python3 << 'EOF'
import sqlite3
import bcrypt
from pathlib import Path

db_path = Path.home() / '.local' / 'share' / 'hopeos' / 'hopeos.db'
conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

password_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode('utf-8')
cursor.execute("SELECT id FROM users WHERE username = 'admin'")
if cursor.fetchone():
    cursor.execute("UPDATE users SET password_hash = ? WHERE username = 'admin'", (password_hash,))
else:
    cursor.execute("""
        INSERT INTO users (username, password_hash, email, full_name, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
    """, ('admin', password_hash, 'admin@hopeos.local', 'System Administrator', 'admin', 1))
conn.commit()
conn.close()
print("Admin user ready: admin / admin123")
EOF

pkill -f uvicorn
```

---

## Building from Source on Raspberry Pi

If you need to build the Tauri app on the Pi itself:

### 1. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source ~/.cargo/env
```

### 2. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Install Tauri Dependencies

```bash
sudo apt-get install -y \
    libwebkit2gtk-4.1-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf
```

### 4. Build

```bash
cd ~/HopeOS
npm install
npm run build
npm run tauri build
```

The output will be in `src-tauri/target/release/bundle/deb/`.

---

## Troubleshooting

### Login Failed: "Load failed"

**Cause**: CORS issue - backend rejecting requests from WebKitGTK.

**Fix**: Ensure `backend/app/main.py` has:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Must be False with wildcard
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Garbled/Glitchy Display

**Cause**: WebKitGTK compositing issue on Raspberry Pi.

**Fix**: Set environment variable before launching:
```bash
export WEBKIT_DISABLE_COMPOSITING_MODE=1
```

This is already included in the startup script.

### "Invalid username or password"

**Cause**: Admin user doesn't exist or password hash is incorrect.

**Fix**: Re-run the admin user creation script:
```bash
cd ~/HopeOS/backend
source venv/bin/activate
python3 /path/to/create-admin.py
```

### Backend won't start: "Address already in use"

**Cause**: Previous backend process still running.

**Fix**:
```bash
sudo fuser -k 8080/tcp
# or
pkill -f "uvicorn app.main:app"
```

### llama-cpp-python installation fails

**Cause**: Missing build dependencies or memory issues.

**Fix**:
```bash
# Ensure dependencies are installed
sudo apt-get install -y libopenblas-dev cmake build-essential

# Try without BLAS optimization
pip install llama-cpp-python --no-cache-dir

# If still failing, increase swap
sudo dphys-swapfile swapoff
sudo sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### AI model not loading

**Cause**: Model files not downloaded or insufficient memory.

**Fix**:
```bash
# Check if model exists
ls -la ~/HopeOS/backend/models/

# Download manually if needed
cd ~/HopeOS/backend
source venv/bin/activate
python -c "from app.services.ai_service import ai_service; ai_service.download_models()"
```

---

## File Locations

| Item | Path |
|------|------|
| Application binary | `/usr/bin/hopeos` |
| Backend code | `~/HopeOS/backend/` |
| Python venv | `~/HopeOS/backend/venv/` |
| Database | `~/.local/share/hopeos/hopeos.db` |
| AI models | `~/HopeOS/backend/models/` |
| Startup script | `~/HopeOS/start-hopeos.sh` |
| Desktop launcher | `/usr/share/applications/hopeos.desktop` |

---

## Performance Tips

1. **Use USB 3.0 SSD** instead of SD card for better I/O performance
2. **Allocate 256MB GPU memory** in `raspi-config` for AI acceleration
3. **Enable zram** for better memory management:
   ```bash
   sudo apt-get install zram-tools
   ```
4. **Disable unnecessary services** to free up RAM:
   ```bash
   sudo systemctl disable bluetooth
   sudo systemctl disable cups
   ```

---

## Security Notes

- Change the default admin password after first login
- The JWT secret key in `config.py` should be changed for production
- Consider enabling HTTPS if accessing over network
- Database is stored unencrypted - use disk encryption for sensitive data

---

## Support

For issues and feature requests, visit:
https://github.com/hopeos/hopeos/issues
