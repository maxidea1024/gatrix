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
COPY packages/edge/package.json ./packages/edge/
COPY packages/shared/package.json ./packages/shared/
COPY packages/storage/package.json ./packages/storage/
COPY packages/sdks/server-sdks/gatrix-node-server-sdk/package.json ./packages/sdks/server-sdks/gatrix-node-server-sdk/

COPY packages/evaluator/package.json ./packages/evaluator/
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/chat-server/package.json ./packages/chat-server/
COPY packages/event-lens/package.json ./packages/event-lens/

# Skip Cypress binary download - not needed in production Docker image
ENV CYPRESS_INSTALL_BINARY=0

RUN yarn install

# Rebuild the source code only when needed
FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Enable Corepack for Yarn 4
RUN corepack enable

# Copy Yarn 4 configuration and binary
COPY .yarnrc.yml ./
COPY .yarn/releases/ ./.yarn/releases/

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY packages/edge ./packages/edge
COPY packages/shared ./packages/shared
COPY packages/storage ./packages/storage
COPY packages/sdks/server-sdks/gatrix-node-server-sdk ./packages/sdks/server-sdks/gatrix-node-server-sdk
COPY packages/evaluator ./packages/evaluator
COPY package.json yarn.lock ./
COPY tsconfig.json ./

# Build shared first (required by other packages)
RUN cd packages/shared && yarn build

# Build storage (required by edge/server-sdk)
RUN cd packages/storage && yarn build

# Build evaluator (required by server-sdk)
RUN cd packages/evaluator && yarn build

# Build server-sdk (required because main points to dist/index.js)
RUN cd packages/sdks/server-sdks/gatrix-node-server-sdk && yarn build

# Build the edge server
RUN cd packages/edge && yarn build
# Verify dist/index.js exists
RUN ls -la packages/edge/dist/index.js

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

# Enable Corepack for Yarn 4
RUN corepack enable

# Copy Yarn 4 configuration and binary
COPY .yarnrc.yml ./
COPY .yarn/releases/ ./.yarn/releases/

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built application
COPY --from=builder /app/packages/edge/dist ./dist
COPY --from=builder /app/packages/edge/package.json ./package.json

# Copy public folder for static files (game webview pages)
COPY --from=builder /app/packages/edge/public ./public

# Copy production dependencies
COPY package.json yarn.lock ./
COPY packages/edge/package.json ./packages/edge/
COPY packages/shared/package.json ./packages/shared/
COPY packages/storage/package.json ./packages/storage/
COPY packages/sdks/server-sdks/gatrix-node-server-sdk/package.json ./packages/sdks/server-sdks/gatrix-node-server-sdk/

COPY packages/evaluator/package.json ./packages/evaluator/
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/chat-server/package.json ./packages/chat-server/
COPY packages/event-lens/package.json ./packages/event-lens/

# Copy shared source (needed for file: dependency)
COPY packages/shared ./packages/shared

# Copy storage source (needed for file: dependency)
COPY packages/storage ./packages/storage

# Copy server-sdk source (needed for file: dependency)
COPY packages/sdks/server-sdks/gatrix-node-server-sdk ./packages/sdks/server-sdks/gatrix-node-server-sdk
COPY packages/evaluator ./packages/evaluator

RUN yarn workspaces focus @gatrix/edge --production && \
  yarn cache clean --all

# Copy built server-sdk dist (overwrite source with built version)
COPY --from=builder /app/packages/sdks/server-sdks/gatrix-node-server-sdk/dist ./node_modules/@gatrix/gatrix-node-server-sdk/dist

# Copy built shared dist
COPY --from=builder /app/packages/shared/dist ./node_modules/@gatrix/shared/dist

# Copy built storage dist
COPY --from=builder /app/packages/storage/dist ./node_modules/@gatrix/storage/dist

# Copy built evaluator dist
COPY --from=builder /app/packages/evaluator/dist ./node_modules/@gatrix/evaluator/dist

# Create logs directory
RUN mkdir -p logs && chown nodejs:nodejs logs

USER nodejs

# Main API port
EXPOSE 3400
# Metrics port (internal only - should not be exposed externally)
EXPOSE 9400

# App version (passed via --build-arg)
ARG APP_VERSION=0.0.0
ENV APP_VERSION=$APP_VERSION

ENV NODE_ENV=production
ENV EDGE_PORT=3400
ENV EDGE_METRICS_PORT=9400

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3400/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/index.js"]
