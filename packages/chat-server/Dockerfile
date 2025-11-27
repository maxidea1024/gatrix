# Base stage
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat dumb-init
WORKDIR /app

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json yarn.lock* ./
COPY packages/chat-server/package.json ./packages/chat-server/
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

# Build chat-server
RUN yarn workspace @gatrix/chat-server build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S chatserver -u 1001

# Copy package files
COPY package.json yarn.lock* ./
COPY packages/chat-server/package.json ./packages/chat-server/
COPY packages/sdks/server-sdk/package.json ./packages/sdks/server-sdk/

# Copy server-sdk source (needed for file: dependency)
COPY packages/sdks/server-sdk ./packages/sdks/server-sdk

# Install production dependencies only
RUN yarn install --frozen-lockfile --production=true && \
    yarn cache clean

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
