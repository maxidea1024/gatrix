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
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/chat-server/package.json ./packages/chat-server/
COPY packages/event-lens/package.json ./packages/event-lens/
COPY packages/edge/package.json ./packages/edge/
COPY packages/sdks/server-sdks/gatrix-node-server-sdk/package.json ./packages/sdks/server-sdks/gatrix-node-server-sdk/

COPY packages/evaluator/package.json ./packages/evaluator/
COPY packages/shared/package.json ./packages/shared/
COPY packages/storage/package.json ./packages/storage/

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

# Copy all source files
COPY . .

# Build shared package first (required by other packages)
RUN cd packages/shared && yarn build

# Build storage (required by backend)
RUN cd packages/storage && yarn build

# Build evaluator (required by server-sdk)
RUN cd packages/evaluator && yarn build

# Build server-sdk (required because main points to dist/index.js)
RUN cd packages/sdks/server-sdks/gatrix-node-server-sdk && yarn build

# Build the backend
RUN yarn workspace @gatrix/backend build
# Resolve @/ path aliases in compiled output
RUN cd packages/backend && npx tsc-alias -p tsconfig.json

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
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/package.json ./package.json

# Copy production dependencies
COPY package.json yarn.lock ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/chat-server/package.json ./packages/chat-server/
COPY packages/event-lens/package.json ./packages/event-lens/
COPY packages/edge/package.json ./packages/edge/
COPY packages/sdks/server-sdks/gatrix-node-server-sdk/package.json ./packages/sdks/server-sdks/gatrix-node-server-sdk/

COPY packages/evaluator/package.json ./packages/evaluator/
COPY packages/shared/package.json ./packages/shared/
COPY packages/storage/package.json ./packages/storage/

# Copy server-sdk source (needed for file: dependency)
COPY packages/sdks/server-sdks/gatrix-node-server-sdk ./packages/sdks/server-sdks/gatrix-node-server-sdk
COPY packages/evaluator ./packages/evaluator

# Copy shared package source (needed for file: dependency)
COPY packages/shared ./packages/shared

# Copy storage source (needed for file: dependency)
COPY packages/storage ./packages/storage

RUN yarn workspaces focus @gatrix/backend --production && \
  yarn cache clean --all

# Copy built server-sdk dist to node_modules (required because main points to dist/index.js)
COPY --from=builder /app/packages/sdks/server-sdks/gatrix-node-server-sdk/dist ./node_modules/@gatrix/gatrix-node-server-sdk/dist

# Copy built shared dist to node_modules
COPY --from=builder /app/packages/shared/dist ./node_modules/@gatrix/shared/dist

# Copy built storage dist to node_modules
COPY --from=builder /app/packages/storage/dist ./node_modules/@gatrix/storage/dist

# Copy built evaluator dist to node_modules
COPY --from=builder /app/packages/evaluator/dist ./node_modules/@gatrix/evaluator/dist

# Create logs, uploads, and data directories
RUN mkdir -p logs uploads data && chown nodejs:nodejs logs uploads data

USER nodejs

EXPOSE 5000

# App version (passed via --build-arg)
ARG APP_VERSION=0.0.0
ENV APP_VERSION=$APP_VERSION

ENV NODE_ENV=production
ENV PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/index.js"]
