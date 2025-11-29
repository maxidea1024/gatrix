# Base stage
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy package files for all workspaces needed
COPY package.json yarn.lock* ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/chat-server/package.json ./packages/chat-server/
COPY packages/event-lens/package.json ./packages/event-lens/
COPY packages/sdks/server-sdk/package.json ./packages/sdks/server-sdk/

# Install dependencies
RUN yarn install --frozen-lockfile --production=false

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY . .

# Build server-sdk (required because main points to dist/index.js)
RUN cd packages/sdks/server-sdk && yarn install && yarn build

# Build event-lens
RUN yarn workspace @gatrix/event-lens build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy package files for all workspaces needed
COPY package.json yarn.lock* ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/chat-server/package.json ./packages/chat-server/
COPY packages/event-lens/package.json ./packages/event-lens/
COPY packages/sdks/server-sdk/package.json ./packages/sdks/server-sdk/

# Copy server-sdk source (needed for file: dependency)
COPY packages/sdks/server-sdk ./packages/sdks/server-sdk

# Install production dependencies only
RUN yarn install --frozen-lockfile --production=true && \
  yarn cache clean

# Copy built server-sdk from builder (no need to rebuild)
COPY --from=builder /app/packages/sdks/server-sdk/dist ./packages/sdks/server-sdk/dist

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

