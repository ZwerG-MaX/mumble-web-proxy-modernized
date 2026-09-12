#!/bin/bash
# install-quadlet.sh
# Installation script for mumble-web-proxy Quadlet configuration

set -e

echo "🚀 Installing mumble-web-proxy Quadlet configuration..."

# Check if Podman is installed
if ! command -v podman &> /dev/null; then
    echo "❌ Error: Podman is not installed"
    echo "Please install Podman first:"
    echo "  - Fedora: sudo dnf install podman"
    echo "  - Ubuntu: sudo apt install podman"
    echo "  - Arch: sudo pacman -S podman"
    exit 1
fi

# Check Podman version (Quadlet requires 4.4+)
PODMAN_VERSION=$(podman version --format '{{.Client.Version}}' | cut -d. -f1,2)
REQUIRED_VERSION="4.4"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PODMAN_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "⚠️  Warning: Podman version $PODMAN_VERSION detected"
    echo "Quadlet requires Podman 4.4 or newer"
    echo "Some features may not work correctly"
fi

# Create Quadlet directory
QUADLET_DIR="${HOME}/.config/containers/systemd"
echo "📁 Creating Quadlet directory: $QUADLET_DIR"
mkdir -p "$QUADLET_DIR"

# Copy Quadlet files
echo "📋 Copying Quadlet configuration files..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cp "$SCRIPT_DIR/mumble-web-proxy.container" "$QUADLET_DIR/"
cp "$SCRIPT_DIR/mumble-web-proxy.volume" "$QUADLET_DIR/"
cp "$SCRIPT_DIR/mumble-web-proxy.network" "$QUADLET_DIR/"

echo "✅ Files copied successfully"

# Create config volume and add default config
echo "🔧 Setting up configuration volume..."
VOLUME_PATH="${HOME}/.local/share/containers/storage/volumes/mumble-web-proxy-config/_data"
mkdir -p "$VOLUME_PATH"

if [ ! -f "$VOLUME_PATH/config.toml" ]; then
    cat > "$VOLUME_PATH/config.toml" << 'EOF'
# mumble-web-proxy configuration
# Edit this file to match your setup

# WebSocket listener port
listen-ws = 64737

# Upstream Mumble server
server = "localhost:64738"

# ICE port range for WebRTC
ice-port-min = 20000
ice-port-max = 21000

# Public IP addresses (for NAT traversal)
# Uncomment and set your public IPs:
# ice-ipv4 = "1.2.3.4"
# ice-ipv6 = "2001:db8::1"

# Accept invalid certificates (DANGEROUS - only for self-signed certs)
# accept-invalid-certificate = true
EOF
    echo "✅ Default configuration created at: $VOLUME_PATH/config.toml"
    echo "⚠️  IMPORTANT: Edit the config file to match your setup!"
else
    echo "ℹ️  Configuration already exists, skipping"
fi

# Reload systemd
echo "🔄 Reloading systemd daemon..."
systemctl --user daemon-reload

echo ""
echo "✅ Installation complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Edit configuration: nano $VOLUME_PATH/config.toml"
echo "   2. Start the service: systemctl --user start mumble-web-proxy.service"
echo "   3. Enable auto-start: systemctl --user enable mumble-web-proxy.service"
echo "   4. Check status: systemctl --user status mumble-web-proxy.service"
echo "   5. View logs: journalctl --user -u mumble-web-proxy.service -f"
echo ""
echo "📚 For more information, visit the Podman tab on the website"
