# ===================
# Stage 1: Build
# ===================
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable

# Install all dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client + Build NestJS
RUN npx prisma generate && pnpm run build

# Verify build output exists
RUN test -f dist/main.js && echo "Build OK" || (echo "dist/main.js not found!" && exit 1)

# ===================
# Stage 2: Production
# ===================
FROM node:20-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy everything needed from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

RUN chown -R nestjs:nodejs /app

USER nestjs

EXPOSE ${PORT:-3000}

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

CMD ["node", "dist/main.js"]
