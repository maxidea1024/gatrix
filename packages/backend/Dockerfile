# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json yarn.lock* ./
COPY packages/backend/package.json ./packages/backend/
RUN yarn install --frozen-lockfile --production=false

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the backend
RUN yarn workspace @gate/backend build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built application
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/package.json ./package.json

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Create logs directory
RUN mkdir -p logs && chown nodejs:nodejs logs

USER nodejs

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/index.js"]
