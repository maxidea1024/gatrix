# Base stage
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat dumb-init
WORKDIR /app

# Enable Corepack for Yarn 4
RUN corepack enable

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy Yarn 4 configuration and binary
COPY .yarnrc.yml ./
COPY .yarn/releases/ ./.yarn/releases/

# Copy package files for all workspaces needed
COPY package.json yarn.lock ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/chat-server/package.json ./packages/chat-server/
COPY packages/event-lens/package.json ./packages/event-lens/
COPY packages/edge/package.json ./packages/edge/
COPY packages/shared/package.json ./packages/shared/
COPY packages/storage/package.json ./packages/storage/
COPY packages/sdks/server-sdks/gatrix-node-server-sdk/package.json ./packages/sdks/server-sdks/gatrix-node-server-sdk/
COPY packages/evaluator/package.json ./packages/evaluator/

# Skip Cypress binary download - not needed in production Docker image
ENV CYPRESS_INSTALL_BINARY=0

# Install dependencies (Yarn 4 syntax)
RUN yarn install

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy Yarn 4 configuration and binary
COPY .yarnrc.yml ./
COPY .yarn/releases/ ./.yarn/releases/

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY . .

# Build shared (required by other packages)
RUN cd packages/shared && yarn build

# Build storage (required by backend/server-sdk)
RUN cd packages/storage && yarn build

# Build evaluator (required by server-sdk)
RUN cd packages/evaluator && yarn build

# Build server-sdk (required because main points to dist/index.js)
RUN cd packages/sdks/server-sdks/gatrix-node-server-sdk && yarn build

# Build chat-server
RUN yarn workspace @gatrix/chat-server build

# Production stage
FROM base AS runner
WORKDIR /app

# App version (passed via --build-arg)
ARG APP_VERSION=0.0.0
ENV APP_VERSION=$APP_VERSION

ENV NODE_ENV=production

# Copy Yarn 4 configuration and binary
COPY .yarnrc.yml ./
COPY .yarn/releases/ ./.yarn/releases/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
  adduser -S chatserver -u 1001

# Copy package files for all workspaces needed
COPY package.json yarn.lock ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/chat-server/package.json ./packages/chat-server/
COPY packages/event-lens/package.json ./packages/event-lens/
COPY packages/edge/package.json ./packages/edge/
COPY packages/shared/package.json ./packages/shared/
COPY packages/storage/package.json ./packages/storage/
COPY packages/sdks/server-sdks/gatrix-node-server-sdk/package.json ./packages/sdks/server-sdks/gatrix-node-server-sdk/
COPY packages/evaluator/package.json ./packages/evaluator/

# Copy shared source (needed for file: dependency)
COPY packages/shared ./packages/shared

# Copy storage source (needed for file: dependency)
COPY packages/storage ./packages/storage

# Copy server-sdk source (needed for file: dependency)
COPY packages/sdks/server-sdks/gatrix-node-server-sdk ./packages/sdks/server-sdks/gatrix-node-server-sdk
COPY packages/evaluator ./packages/evaluator

# Install production dependencies only (Yarn 4 syntax)
RUN yarn workspaces focus @gatrix/chat-server --production && \
  yarn cache clean --all

# Copy built shared from builder
COPY --from=builder /app/packages/shared/dist ./packages/chat-server/node_modules/@gatrix/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/chat-server/node_modules/@gatrix/shared/package.json

# Copy built storage from builder
COPY --from=builder /app/packages/storage/dist ./packages/chat-server/node_modules/@gatrix/storage/dist
COPY --from=builder /app/packages/storage/package.json ./packages/chat-server/node_modules/@gatrix/storage/package.json

# Copy built server-sdk from builder to node_modules location
COPY --from=builder /app/packages/sdks/server-sdks/gatrix-node-server-sdk/dist ./packages/chat-server/node_modules/@gatrix/gatrix-node-server-sdk/dist
COPY --from=builder /app/packages/sdks/server-sdks/gatrix-node-server-sdk/package.json ./packages/chat-server/node_modules/@gatrix/gatrix-node-server-sdk/package.json

# Copy built evaluator from builder
COPY --from=builder /app/packages/evaluator/dist ./packages/chat-server/node_modules/@gatrix/evaluator/dist
COPY --from=builder /app/packages/evaluator/package.json ./packages/chat-server/node_modules/@gatrix/evaluator/package.json

# Copy built application
COPY --from=builder /app/packages/chat-server/dist ./packages/chat-server/dist

# Copy migration files
COPY packages/chat-server/src/database/migrations ./packages/chat-server/dist/database/migrations

# Copy knexfile
COPY packages/chat-server/knexfile.js ./packages/chat-server/

# Create logs and uploads directories with proper permissions
RUN mkdir -p logs uploads && chown -R chatserver:nodejs logs uploads

# Switch to non-root user
USER chatserver

# Expose port
EXPOSE 5100

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node packages/chat-server/dist/health-check.js

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "packages/chat-server/dist/index.js"]
