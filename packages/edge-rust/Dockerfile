# ============================================================================
# Production Dockerfile for Gatrix Edge Server (Rust)
# Single static binary — no runtime dependencies
# ============================================================================

# Stage 1: Build
FROM rust:1.85-alpine AS builder

RUN apk add --no-cache musl-dev pkgconfig openssl-dev openssl-libs-static

WORKDIR /app

# Copy SDK dependency first (for caching)
COPY packages/sdks/server-sdks/gatrix-rust-server-sdk ./packages/sdks/server-sdks/gatrix-rust-server-sdk

# Copy edge-rust source
COPY packages/edge-rust ./packages/edge-rust

WORKDIR /app/packages/edge-rust

# Build release binary (statically linked)
ENV OPENSSL_STATIC=1
RUN cargo build --release --target x86_64-unknown-linux-musl 2>/dev/null \
    || cargo build --release

# ============================================================================
# Stage 2: Minimal runtime image
# ============================================================================

FROM alpine:3.21 AS runner

# Install ca-certificates for HTTPS
RUN apk add --no-cache ca-certificates

# Create non-root user
RUN addgroup -S gatrix && adduser -S gatrix -G gatrix

WORKDIR /app

# Copy binary from builder (try musl target first, fallback to default)
COPY --from=builder /app/packages/edge-rust/target/x86_64-unknown-linux-musl/release/gatrix-edge-rust ./gatrix-edge-rust 2>/dev/null || true
COPY --from=builder /app/packages/edge-rust/target/release/gatrix-edge-rust ./gatrix-edge-rust 2>/dev/null || true

RUN chmod +x ./gatrix-edge-rust

USER gatrix

# Main API port
EXPOSE 3400
# Internal API port
EXPOSE 3410

# App version (passed via --build-arg)
ARG APP_VERSION=0.0.0
ENV APP_VERSION=$APP_VERSION

ENV EDGE_PORT=3400
ENV RUST_LOG=info

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:3400/health || exit 1

ENTRYPOINT ["./gatrix-edge-rust"]
