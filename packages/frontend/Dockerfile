# Multi-stage build for production optimization
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Use Tencent npm mirror for faster downloads in China
RUN yarn config set registry http://mirrors.cloud.tencent.com/npm/

# Copy package files
COPY package.json yarn.lock* ./
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/shared/package.json ./packages/shared/

# Skip Cypress binary download - not needed in production Docker image
ENV CYPRESS_INSTALL_BINARY=0

RUN yarn install --frozen-lockfile --network-timeout 600000 --ignore-optional

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
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
RUN yarn workspace @gatrix/frontend build
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
