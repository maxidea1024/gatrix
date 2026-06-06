# Build stage — use bookworm for consistent glibc
FROM rust:bookworm AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y \
    cmake \
    nasm \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests first for layer caching
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/

# Build release binary
RUN cargo build --release --bin symbolicator

# Runtime stage — same base distro as build
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -r -m -d /data symbolicator

COPY --from=builder /build/target/release/symbolicator /usr/local/bin/symbolicator

USER symbolicator

VOLUME ["/etc/symbolicator", "/data"]
EXPOSE 3021

ENTRYPOINT ["/usr/local/bin/symbolicator"]
CMD ["run"]
