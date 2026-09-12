# Multi-stage build for mumble-web-proxy
# Build stage
FROM rust:1.75-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    libssl-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy Rust backend source
COPY rust-backend/Cargo.toml ./
COPY rust-backend/src ./src

# Build release binary
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libssl3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r mumble \
    && useradd -r -g mumble -d /nonexistent -s /sbin/nologin mumble

# Create necessary directories
RUN mkdir -p /etc/mumble-web-proxy /var/log/mumble-web-proxy \
    && chown -R mumble:mumble /var/log/mumble-web-proxy

# Copy binary from builder
COPY --from=builder /build/target/release/mumble-web-proxy /usr/local/bin/mumble-web-proxy

# Set permissions
RUN chmod +x /usr/local/bin/mumble-web-proxy

# Switch to non-root user
USER mumble

# Expose ports
# WebSocket control channel
EXPOSE 64737
# ICE/WebRTC voice channels (UDP)
EXPOSE 20000-21000/udp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD pgrep mumble-web-proxy || exit 1

# Default command
ENTRYPOINT ["/usr/local/bin/mumble-web-proxy"]
CMD ["--help"]

# Labels
LABEL org.opencontainers.image.title="mumble-web-proxy"
LABEL org.opencontainers.image.description="Mumble to WebSocket+WebRTC proxy"
LABEL org.opencontainers.image.vendor="ZwerG-MaX"
LABEL org.opencontainers.image.source="https://github.com/ZwerG-MaX/mumble-web-proxy"
