#!/bin/bash
# Build script for mumble-web-proxy container image

set -e

IMAGE_NAME="mumble-web-proxy"
IMAGE_TAG="latest"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"

echo "🔨 Building ${FULL_IMAGE_NAME}..."

# Build the image
podman build -t "${FULL_IMAGE_NAME}" -f Dockerfile .

echo ""
echo "✅ Build complete!"
echo ""
echo "📋 Image details:"
podman image inspect "${FULL_IMAGE_NAME}" --format 'Size: {{.Size}} bytes'
echo ""
echo "🚀 To use with Quadlet, update your .container file:"
echo "   Image=localhost/${FULL_IMAGE_NAME}"
echo ""
echo "🔍 To verify the image:"
echo "   podman images | grep ${IMAGE_NAME}"
echo ""
echo "🧪 To test run manually:"
echo "   podman run --rm -p 64737:64737 -p 20000-21000:20000-21000/udp ${FULL_IMAGE_NAME} --help"
