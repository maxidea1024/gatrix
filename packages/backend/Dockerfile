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
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/chat-server/package.json ./packages/chat-server/
COPY packages/event-lens/package.json ./packages/event-lens/
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
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/chat-server/package.json ./packages/chat-server/
COPY packages/event-lens/package.json ./packages/event-lens/
COPY packages/sdks/server-sdk/package.json ./packages/sdks/server-sdk/

# Install dependencies
RUN yarn install --frozen-lockfile --production=false --network-timeout 600000 --ignore-optional

# Copy source code
COPY . .

# Build server-sdk first (required because main points to dist/index.js)
RUN cd packages/sdks/server-sdk && yarn install --network-timeout 600000 --ignore-optional && yarn build

# Build the backend
RUN yarn workspace @gatrix/backend build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

# Use Tencent npm mirror for faster downloads in China
RUN yarn config set registry http://mirrors.cloud.tencent.com/npm/

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built application
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/package.json ./package.json

# Copy production dependencies
COPY package.json yarn.lock* ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/chat-server/package.json ./packages/chat-server/
COPY packages/event-lens/package.json ./packages/event-lens/
COPY packages/sdks/server-sdk/package.json ./packages/sdks/server-sdk/

# Copy server-sdk source (needed for file: dependency)
COPY packages/sdks/server-sdk ./packages/sdks/server-sdk

RUN yarn install --frozen-lockfile --production=true --network-timeout 600000 --ignore-optional && \
  yarn cache clean

# Copy built server-sdk dist to node_modules (required because main points to dist/index.js)
COPY --from=builder /app/packages/sdks/server-sdk/dist ./node_modules/@gatrix/server-sdk/dist

# Create logs, uploads, and data directories
RUN mkdir -p logs uploads data && chown nodejs:nodejs logs uploads data

USER nodejs

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/index.js"]
