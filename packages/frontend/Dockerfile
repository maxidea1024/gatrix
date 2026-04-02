# Multi-stage build for production optimization
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Enable Corepack for Yarn 4
RUN corepack enable

# Copy Yarn 4 configuration and binary
COPY .yarnrc.yml ./
COPY .yarn/releases/ ./.yarn/releases/

# Copy package files
COPY package.json yarn.lock ./
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/shared/package.json ./packages/shared/
COPY packages/storage/package.json ./packages/storage/
COPY packages/backend/package.json ./packages/backend/
COPY packages/chat-server/package.json ./packages/chat-server/
COPY packages/event-lens/package.json ./packages/event-lens/
COPY packages/edge/package.json ./packages/edge/
COPY packages/sdks/server-sdks/gatrix-node-server-sdk/package.json ./packages/sdks/server-sdks/gatrix-node-server-sdk/

COPY packages/evaluator/package.json ./packages/evaluator/

# Skip Cypress binary download - not needed in production Docker image
ENV CYPRESS_INSTALL_BINARY=0

RUN yarn install

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Enable Corepack for Yarn 4
RUN corepack enable

# Copy Yarn 4 configuration and binary
COPY .yarnrc.yml ./
COPY .yarn/releases/ ./.yarn/releases/

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# App version from build-arg
ARG APP_VERSION=0.0.0
ENV VITE_APP_VERSION=$APP_VERSION

# Build the frontend
ENV NODE_ENV=production
# Increase Node.js heap size for build process to prevent out of memory errors
ENV NODE_OPTIONS="--max-old-space-size=4096"
# Build shared package first (required for frontend)
RUN yarn workspace @gatrix/shared build
# Run tsc and vite build directly (cross-env not available in Docker)
RUN cd packages/frontend && npx tsc --noEmit && npx vite build
# Verify dist/index.html exists
RUN ls -la packages/frontend/dist/index.html

# Production image with Nginx
FROM nginx:alpine AS runner

# Install Node.js for health checks
RUN apk add --no-cache nodejs npm

# Copy custom nginx config
COPY packages/frontend/nginx.conf /etc/nginx/nginx.conf

# Copy built application
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

# Copy environment script
COPY packages/frontend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create nginx user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
