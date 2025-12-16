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
COPY packages/edge/package.json ./packages/edge/
COPY packages/sdks/server-sdk/package.json ./packages/sdks/server-sdk/
RUN yarn install --frozen-lockfile --production=false --network-timeout 600000 --ignore-optional

# Rebuild the source code only when needed
FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Use Tencent npm mirror for faster downloads in China
RUN yarn config set registry http://mirrors.cloud.tencent.com/npm/

# Copy all package files first
COPY package.json yarn.lock* ./
COPY packages/edge/package.json ./packages/edge/
COPY packages/sdks/server-sdk/package.json ./packages/sdks/server-sdk/

# Install dependencies
RUN yarn install --frozen-lockfile --production=false --network-timeout 600000 --ignore-optional

# Copy source code
COPY packages/edge ./packages/edge
COPY packages/sdks/server-sdk ./packages/sdks/server-sdk
COPY tsconfig.json ./

# Build server-sdk first (required because main points to dist/index.js)
RUN cd packages/sdks/server-sdk && yarn build

# Build the edge server
RUN cd packages/edge && yarn build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

# Use Tencent npm mirror for faster downloads in China
RUN yarn config set registry http://mirrors.cloud.tencent.com/npm/

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built application
COPY --from=builder /app/packages/edge/dist ./dist
COPY --from=builder /app/packages/edge/package.json ./package.json

# Copy public folder for static files (game webview pages)
COPY --from=builder /app/packages/edge/public ./public

# Copy production dependencies
COPY package.json yarn.lock* ./
COPY packages/edge/package.json ./packages/edge/
COPY packages/sdks/server-sdk/package.json ./packages/sdks/server-sdk/

# Copy server-sdk source (needed for file: dependency)
COPY packages/sdks/server-sdk ./packages/sdks/server-sdk

RUN yarn install --frozen-lockfile --production=true --network-timeout 600000 --ignore-optional && \
  yarn cache clean

# Copy built server-sdk dist (overwrite source with built version)
COPY --from=builder /app/packages/sdks/server-sdk/dist ./node_modules/@gatrix/server-sdk/dist

# Create logs directory
RUN mkdir -p logs && chown nodejs:nodejs logs

USER nodejs

# Main API port
EXPOSE 3400
# Metrics port (internal only - should not be exposed externally)
EXPOSE 9400

ENV NODE_ENV=production
ENV EDGE_PORT=3400
ENV EDGE_METRICS_PORT=9400

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3400/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/index.js"]

