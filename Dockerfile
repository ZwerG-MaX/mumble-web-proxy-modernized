# Multi-stage build for mumble-web-proxy
# Build stage
FROM rust:1.88-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    libnice-dev \
    libssl-dev \
    clang \
    protobuf-compiler \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy workspace files
COPY Cargo.toml ./
COPY mumble-protocol ./mumble-protocol
COPY rtp ./rtp
COPY proxy ./proxy

# Build release binary
RUN cargo build --release --package mumble-web-proxy

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libnice0 \
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
EXPOSE 64737
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
