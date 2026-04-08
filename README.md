# OKB Patient Portal

A modern, secure patient portal built with React and TypeScript that integrates with OpenMRS 3.x to provide patients access to their medical information.

## 🏥 Features

### Current Features (MVP)
- ✅ **Secure Authentication** - Login using OpenMRS credentials
- ✅ **Patient Dashboard** - Overview of health information
- ✅ **Medical Records Access** - View visit history and encounters
- ✅ **Lab Results** - Access to laboratory test results
- ✅ **Medication Information** - Current and past medications
- ✅ **Vital Signs** - Latest vital signs and measurements
- ✅ **Responsive Design** - Works on desktop, tablet, and mobile
- ✅ **OKB Branding** - Consistent with clinic branding

### AI Clinical Assistant (Ask Hope)
- 🤖 **Natural Language Queries** - Ask questions about patient data in plain English
- 📊 **Clinical Summaries** - AI-generated patient status overviews
- 🔒 **Local AI Processing** - Patient data never leaves the server (Gemma 4)
- ⚡ **Streaming Responses** - Real-time token streaming for responsive UX

> See [EHR_AGENT_ARCHITECTURE.md](EHR_AGENT_ARCHITECTURE.md) for technical details.

### Future Features (with Firebase Integration)
- 📱 **Push Notifications** - Appointment reminders, lab results ready
- 💬 **Secure Messaging** - Communicate with healthcare providers
- 👨‍👩‍👧‍👦 **Family Account Management** - Manage multiple family members
- 📊 **Health Tracking** - Track vitals, symptoms, medication adherence
- 📚 **Educational Resources** - Personalized health information
- 🔔 **Custom Alerts** - Medication reminders, health goals

## 🛠️ Technology Stack

- **Frontend**: React 19 + TypeScript
- **UI Framework**: Material-UI (MUI)
- **State Management**: React Context + Hooks
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Build Tool**: Vite
- **Backend**: Python/FastAPI with local Gemma 4 AI
- **Desktop**: Tauri (Rust) - lightweight native wrapper (~5MB vs Electron's 150MB)
- **Edge Server**: Raspberry Pi 4/5 support with mDNS
- **Deployment**: Firebase Hosting (web) / Native apps (desktop) / RPi server (LAN)

## 🚀 Development

### Prerequisites
- Node.js 20+
- npm or yarn
- Docker (for deployment)

### Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Development Server
The development server runs on `http://localhost:3001` and proxies API requests to `http://localhost` (your OpenMRS instance).

## 🏗️ Architecture

### Standalone Mode (Desktop/Development)
```
┌─────────────────────────────────────────┐
│           Tauri Desktop App             │
│  ┌─────────────┐    ┌─────────────────┐ │
│  │ React SPA   │◄──►│ FastAPI Backend │ │
│  │ (WebView)   │    │ + Gemma 4 AI    │ │
│  └─────────────┘    └─────────────────┘ │
└─────────────────────────────────────────┘
```

### Hub-Spoke Mode (Raspberry Pi Server)
```
                    ┌─────────────────┐
    ┌──────────────►│   RPi 5 Server  │◄──────────────┐
    │               │  ┌───────────┐  │               │
    │               │  │ FastAPI + │  │               │
    │               │  │ Gemma 4   │  │               │
    │               │  │ + SQLite  │  │               │
    │               │  └───────────┘  │               │
    │               └─────────────────┘               │
    │                       ▲                         │
    │                       │                         │
┌───┴───┐             ┌─────┴─────┐             ┌────┴────┐
│Phone  │             │  Laptop   │             │ Tablet  │
│Browser│             │  Browser  │             │ Browser │
└───────┘             └───────────┘             └─────────┘
      http://hopeos.local (mDNS)
```

### Cloud Mode (Firebase Hosting)
```
┌─────────────────┐    ┌─────────────────┐
│   React SPA     │    │   FastAPI       │
│   (Firebase     │───►│   (Cloud Run    │
│    Hosting)     │    │    + GPU)       │
└─────────────────┘    └─────────────────┘
```

## 🔐 Security Features

- ✅ **OpenMRS Authentication** - Secure session management
- ✅ **Protected Routes** - Authentication required for all pages
- ✅ **HTTPS Ready** - Secure communication
- ✅ **Content Security Policy** - XSS protection
- ✅ **Input Validation** - Sanitized inputs
- ✅ **Session Management** - Automatic logout on session expiry

## 📱 API Integration

### OpenMRS REST API Endpoints
- `/openmrs/ws/rest/v1/patient/{uuid}` - Patient demographics
- `/openmrs/ws/rest/v1/encounter?patient={uuid}` - Medical encounters
- `/openmrs/ws/rest/v1/visit?patient={uuid}` - Patient visits
- `/openmrs/ws/rest/v1/obs?patient={uuid}` - Observations

### OpenMRS FHIR API Endpoints
- `/openmrs/ws/fhir2/R4/Patient/{id}` - FHIR Patient resource
- `/openmrs/ws/fhir2/R4/Observation?patient={id}` - Lab results & vitals
- `/openmrs/ws/fhir2/R4/MedicationRequest?patient={id}` - Medications
- `/openmrs/ws/fhir2/R4/Encounter?patient={id}` - FHIR Encounters

## 🚀 Deployment

### Firebase Hosting (Recommended)
The patient portal is designed to be deployed on Firebase Hosting:

```bash
# Install Firebase CLI (if not already installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase (first time only)
firebase init hosting

# Build and deploy
npm run deploy
```

### Development Server
```bash
# Start development server
npm run dev

# Access at http://localhost:3001
# API calls proxy to your local OpenMRS instance
```

### Desktop App (Tauri)

HopeOS can run as a standalone desktop application with the Python backend bundled.

#### Prerequisites
- Python 3.11+
- Node.js 18+
- Rust (install from https://rustup.rs)

#### Development Mode
```bash
# Install backend dependencies (first time)
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..

# Run desktop app (starts backend automatically)
npm run desktop
```

#### Build Distributable
```bash
# Make build scripts executable (first time)
chmod +x scripts/build-desktop.sh scripts/build-backend.sh

# Build complete desktop app (~60-90MB)
npm run desktop:build

# Output location:
# macOS: src-tauri/target/release/bundle/dmg/
# Linux: src-tauri/target/release/bundle/appimage/
# Windows: src-tauri/target/release/bundle/msi/
```

The distributable includes the bundled Python backend - end users don't need Python installed.

### Raspberry Pi 4/5 Desktop App (Native Build)

Build HopeOS as a native `.deb` package directly on your Raspberry Pi. Cross-compilation from Mac/Windows isn't supported - must build on the Pi itself.

#### Quick Start (One Command)

```bash
# Transfer project to Pi (from your Mac/PC)
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude 'src-tauri/target' \
  --exclude '.venv' \
  ./ user@hopeos.local:~/HopeOS/

# SSH into Pi and build + install
ssh user@hopeos.local
cd ~/HopeOS
chmod +x scripts/build-pi.sh
./scripts/build-pi.sh --install
```

The script handles everything: dependencies, backend, Tauri build, and installation.

#### AI Model Recommendations

| Device | RAM | Recommended Model | Size |
|--------|-----|-------------------|------|
| Pi 5 | 8GB | Gemma 4 E2B Q4_K_M | 3.1 GB |
| Pi 4 | 4GB+ | Gemma 4 E2B Q2 | 2.3 GB |
| Pi 4 | 2GB | Gemma 3 1B Q4 | 806 MB |

Download models from [unsloth/gemma-4-E2B-it-GGUF](https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF).

<details>
<summary><strong>Manual Build Steps</strong> (if you prefer step-by-step)</summary>

#### Step 1: Transfer Project to Pi

```bash
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude 'src-tauri/target' \
  --exclude '.venv' \
  ./ user@hopeos.local:~/HopeOS/
```

#### Step 2: Install Dependencies

```bash
ssh user@hopeos.local
cd ~/HopeOS
chmod +x scripts/setup-pi4-build.sh
./scripts/setup-pi4-build.sh
```

#### Step 3: Build Backend

```bash
cd ~/HopeOS/backend
python3 -m venv .venv
.venv/bin/pip install pyinstaller -r requirements.txt
.venv/bin/pyinstaller hopeos-backend.spec --distpath dist --noconfirm
```

#### Step 4: Build Tauri App

```bash
cd ~/HopeOS
npm install
npm run tauri:build  # Takes 30-60 min on Pi 4
```

#### Step 5: Install

```bash
sudo dpkg -i src-tauri/target/release/bundle/deb/HopeOS_1.0.0_arm64.deb
```

</details>

Launch from app menu or run `hopeos` from terminal.

### Raspberry Pi Server (Multi-Device Access)

Run HopeOS on a Raspberry Pi 5 as a central server, accessible from any device on the network.

#### Architecture
```
┌─────────────────┐
│   RPi 5 Server  │◄─── http://hopeos.local
│   (HopeOS +     │
│    FastAPI +    │◄─── Phones, tablets, laptops
│    Gemma 4 AI)  │     connect via browser
└─────────────────┘
```

#### Quick Start
```bash
# On the Raspberry Pi
cd HopeOS
npm run dev  # or npm run desktop

# Access from any device on the network:
# http://<rpi-ip>:3001  (e.g., http://192.168.1.50:3001)
```

#### Human-Readable URL (mDNS)

Set up `hopeos.local` for easy access:

```bash
# Quick setup (requires port in URL)
sudo hostnamectl set-hostname hopeos
sudo systemctl restart avahi-daemon
# Access: http://hopeos.local:3001

# Full setup (clean URL without port)
sudo bash scripts/setup-rpi-server.sh
# Access: http://hopeos.local
```

The setup script installs:
- **avahi-daemon** - mDNS for `.local` domain
- **nginx** - Reverse proxy (removes port requirement)

#### Network Requirements
- All devices must be on the same local network
- Server binds to `0.0.0.0` (already configured)
- Ports 3001 (frontend) and 8080 (backend) must be accessible

## 🌐 Access

| Mode | URL | Description |
|------|-----|-------------|
| Local Dev | http://localhost:3001 | Development on same machine |
| Network (IP) | http://192.168.x.x:3001 | Access from other devices |
| Network (mDNS) | http://hopeos.local:3001 | Human-readable local URL |
| Network (nginx) | http://hopeos.local | Clean URL (after setup script) |
| Production | https://your-firebase-app.web.app | Firebase Hosting |

## 🧪 Testing Accounts

Use these test accounts to access the patient portal:
- **Username**: Any existing OpenMRS patient identifier
- **Password**: Same as OpenMRS user password

**Note**: The system will automatically link the login credentials to patient records based on username or name matching.

## 📁 Project Structure

```
HopeOS/
├── src/                      # React frontend
│   ├── components/           # Reusable UI components
│   ├── pages/                # Page components
│   ├── hooks/                # Custom React hooks
│   ├── services/             # API services
│   │   └── api.service.ts    # FastAPI client
│   └── types/                # TypeScript definitions
├── backend/                  # Python/FastAPI backend
│   ├── app/
│   │   ├── main.py           # FastAPI entry point
│   │   ├── models/           # SQLAlchemy models
│   │   ├── routers/          # API endpoints
│   │   └── services/         # Business logic + AI
│   └── requirements.txt
├── src-tauri/                # Tauri desktop wrapper
│   ├── src/lib.rs            # Rust backend management
│   └── tauri.conf.json       # Tauri configuration
├── scripts/
│   ├── build-desktop.sh      # Desktop build script (Mac/Linux)
│   ├── build-pi.sh           # One-command Pi build & install
│   ├── build-backend.sh      # PyInstaller bundling
│   ├── setup-pi4-build.sh    # Pi 4 build environment setup
│   └── setup-rpi-server.sh   # Raspberry Pi server setup
└── package.json
```

## 🔮 Future Enhancements

### Phase 2: Firebase Integration
- [ ] Firebase Authentication
- [ ] Cloud Firestore for user preferences
- [ ] Cloud Messaging for push notifications
- [ ] Cloud Storage for document uploads

### Phase 3: Advanced Features
- [ ] Progressive Web App (PWA)
- [ ] Offline capability
- [ ] Health data visualization
- [ ] Appointment scheduling
- [ ] Prescription refill requests

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure the development proxy is configured correctly in `vite.config.ts`
2. **Authentication Fails**: Check that OpenMRS is running and accessible
3. **No Patient Data**: Verify the user has an associated patient record
4. **Build Fails**: Ensure Node.js 20+ is installed

### Development Debugging
```bash
# Check backend API
curl http://localhost:8080/health

# Check if ports are in use
lsof -i :3001
lsof -i :8080

# Kill stuck processes
lsof -ti:8080 | xargs kill -9
```

### Raspberry Pi Server Issues
```bash
# Check if mDNS is working
avahi-browse -a

# Verify hostname
hostname

# Check nginx status
sudo systemctl status nginx

# View nginx logs
sudo tail -f /var/log/nginx/error.log

# Test local access first
curl http://localhost:3001
```

## 📞 Support

For technical support or questions:
- Check the main project documentation
- Review OpenMRS 3.x documentation
- Contact the development team

## 📄 License

This project is licensed under the MIT License - see the main project LICENSE file for details.
