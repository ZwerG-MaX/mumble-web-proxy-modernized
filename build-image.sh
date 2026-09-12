#!/bin/bash
# Build script for mumble-web-proxy container image

set -e

IMAGE_NAME="mumble-web-proxy"
IMAGE_TAG="latest"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"

echo "🔨 Building ${FULL_IMAGE_NAME}..."
echo ""

# Check if rust-backend directory exists
if [ ! -d "rust-backend" ]; then
    echo "❌ Error: rust-backend directory not found"
    echo "Please ensure you're running this script from the repository root"
    exit 1
fi

# Check if Dockerfile exists
if [ ! -f "Dockerfile" ]; then
    echo "❌ Error: Dockerfile not found"
    exit 1
fi

# Build the image
podman build -t "${FULL_IMAGE_NAME}" -f Dockerfile .

echo ""
echo "✅ Build complete!"
echo ""
echo "📋 Image details:"
podman image inspect "${FULL_IMAGE_NAME}" --format 'Size: {{.Size}} bytes' | awk '{printf "%.2f MB\n", $1/1024/1024}'
echo ""
echo "🚀 To use with Quadlet, your .container file should have:"
echo "   Image=localhost/${FULL_IMAGE_NAME}"
echo ""
echo "🔍 To verify the image:"
echo "   podman images | grep ${IMAGE_NAME}"
echo ""
echo "🧪 To test run manually:"
echo "   podman run --rm -p 64737:64737 -p 20000-21000:20000-21000/udp ${FULL_IMAGE_NAME} --help"
