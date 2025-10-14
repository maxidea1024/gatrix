# Base stage
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json yarn.lock* ./
COPY packages/event-lens/package.json ./packages/event-lens/

# Install dependencies
RUN yarn install --frozen-lockfile --production=false

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY . .

# Build event-lens
RUN yarn workspace @gatrix/event-lens build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package.json yarn.lock* ./
COPY packages/event-lens/package.json ./packages/event-lens/

# Install production dependencies only
RUN yarn install --frozen-lockfile --production=true && \
    yarn cache clean

# Copy built files from builder
COPY --from=builder /app/packages/event-lens/dist ./packages/event-lens/dist

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "packages/event-lens/dist/index.js"]

