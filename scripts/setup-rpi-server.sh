#!/bin/bash
# HopeOS Raspberry Pi Server Setup
# Makes the server accessible at http://hopeos.local (no port needed)

set -e

echo "=== HopeOS Raspberry Pi Server Setup ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run with sudo: sudo bash $0"
    exit 1
fi

# Set hostname
echo "1. Setting hostname to 'hopeos'..."
hostnamectl set-hostname hopeos
echo "127.0.1.1 hopeos" >> /etc/hosts

# Install and configure avahi (mDNS)
echo "2. Installing avahi-daemon for mDNS..."
apt update
apt install -y avahi-daemon

# Install nginx
echo "3. Installing nginx reverse proxy..."
apt install -y nginx

# Create nginx config
echo "4. Configuring nginx..."
cat > /etc/nginx/sites-available/hopeos << 'EOF'
server {
    listen 80;
    server_name hopeos.local hopeos;

    # Frontend (Vite dev server or built static files)
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8080/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;  # 5 min timeout for AI operations
    }

    # WebSocket support for hot reload (dev mode)
    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/hopeos /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and restart nginx
nginx -t
systemctl restart nginx
systemctl enable nginx

# Restart avahi
systemctl restart avahi-daemon
systemctl enable avahi-daemon

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "Access HopeOS from any device on your network:"
echo "  http://hopeos.local"
echo ""
echo "Or by IP (find with: hostname -I):"
echo "  http://$(hostname -I | awk '{print $1}')"
echo ""
echo "Make sure HopeOS is running:"
echo "  cd /path/to/HopeOS"
echo "  npm run dev  (or npm run desktop)"
echo ""
