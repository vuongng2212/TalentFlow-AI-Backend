# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN pnpm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Copy Prisma schema first (needed for generate + migrations)
COPY prisma ./prisma

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Generate Prisma client in production node_modules
RUN npx prisma generate

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Set ownership to non-root user
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Expose application port (Railway injects PORT at runtime)
EXPOSE ${PORT:-3000}

# Health check using dynamic PORT
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# Start application
CMD ["node", "dist/main.js"]
