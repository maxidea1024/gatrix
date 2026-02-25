# Multi-stage build for Gatrix Edge Server (.NET)
# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src

# Copy solution and project files first (for layer caching)
COPY packages/edge-dotnet/Gatrix.Edge.sln ./packages/edge-dotnet/

COPY packages/edge-dotnet/src/Gatrix.Edge/Gatrix.Edge.csproj \
     ./packages/edge-dotnet/src/Gatrix.Edge/

COPY packages/sdks/server-sdks/gatrix-dotnet-server-sdk/src/Gatrix.Server.Sdk/Gatrix.Server.Sdk.csproj \
     ./packages/sdks/server-sdks/gatrix-dotnet-server-sdk/src/Gatrix.Server.Sdk/

COPY packages/sdks/server-sdks/gatrix-dotnet-server-sdk/src/Gatrix.Server.Sdk.AspNetCore/Gatrix.Server.Sdk.AspNetCore.csproj \
     ./packages/sdks/server-sdks/gatrix-dotnet-server-sdk/src/Gatrix.Server.Sdk.AspNetCore/

# Restore dependencies
RUN dotnet restore packages/edge-dotnet/src/Gatrix.Edge/Gatrix.Edge.csproj

# Copy source code
COPY packages/edge-dotnet/src/ ./packages/edge-dotnet/src/
COPY packages/sdks/server-sdks/gatrix-dotnet-server-sdk/src/ \
     ./packages/sdks/server-sdks/gatrix-dotnet-server-sdk/src/

# Build and publish
RUN dotnet publish packages/edge-dotnet/src/Gatrix.Edge/Gatrix.Edge.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 dotnet \
 && adduser  --system --uid 1001 --ingroup dotnet dotnet

# Copy published output
COPY --from=build /app/publish ./

# Log directory
RUN mkdir -p logs \
 && chown dotnet:dotnet logs

USER dotnet

# Main API port
EXPOSE 3400
# Internal management port
EXPOSE 3410

# App version (passed via --build-arg)
ARG APP_VERSION=0.0.0
ENV APP_VERSION=$APP_VERSION

ENV DOTNET_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:3400
ENV Edge__Port=3400
ENV Edge__InternalPort=3410

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3400/health || exit 1

ENTRYPOINT ["./Gatrix.Edge"]
