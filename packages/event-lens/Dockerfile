# Base stage
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Use Tencent npm mirror for faster downloads in China
RUN yarn config set registry http://mirrors.cloud.tencent.com/npm/

# Copy package files for all workspaces needed
COPY package.json yarn.lock* ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/chat-server/package.json ./packages/chat-server/
COPY packages/event-lens/package.json ./packages/event-lens/
COPY packages/sdks/server-sdk/package.json ./packages/sdks/server-sdk/

# Install dependencies (with increased network timeout for slow connections)
RUN yarn install --frozen-lockfile --production=false --network-timeout 600000 --ignore-optional

# Install SWC native binding for Alpine Linux (musl)
RUN yarn add --dev @swc/core-linux-x64-musl --ignore-scripts

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy and build server-sdk (required dependency)
COPY packages/sdks/server-sdk ./packages/sdks/server-sdk
RUN yarn workspace @gatrix/server-sdk build

# Copy and build event-lens
COPY packages/event-lens ./packages/event-lens
RUN yarn workspace @gatrix/event-lens build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Use Tencent npm mirror for faster downloads in China
RUN yarn config set registry http://mirrors.cloud.tencent.com/npm/

# Copy package files for all workspaces needed
COPY package.json yarn.lock* ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/chat-server/package.json ./packages/chat-server/
COPY packages/event-lens/package.json ./packages/event-lens/
COPY packages/sdks/server-sdk/package.json ./packages/sdks/server-sdk/

# Copy server-sdk source (needed for file: dependency)
COPY packages/sdks/server-sdk ./packages/sdks/server-sdk

# Install production dependencies only (with increased network timeout for slow connections)
RUN yarn install --frozen-lockfile --production=true --network-timeout 600000 --ignore-optional && \
  yarn cache clean

# Copy built server-sdk from builder to node_modules location
COPY --from=builder /app/packages/sdks/server-sdk/dist ./packages/event-lens/node_modules/@gatrix/server-sdk/dist
COPY --from=builder /app/packages/sdks/server-sdk/package.json ./packages/event-lens/node_modules/@gatrix/server-sdk/package.json

# Copy built files from builder
COPY --from=builder /app/packages/event-lens/dist ./packages/event-lens/dist

# Copy migration files
COPY packages/event-lens/migrations ./packages/event-lens/migrations

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 5200

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=5 \
  CMD node -e "const http = require('http'); const req = http.get('http://localhost:5200/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.setTimeout(5000, () => { req.destroy(); process.exit(1); });"

# Start server
CMD ["node", "packages/event-lens/dist/index.js"]

