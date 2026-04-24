# ===================
# Base image
# ===================
FROM node:20-bookworm-slim AS base

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates wget \
 && rm -rf /var/lib/apt/lists/*

# ===================
# Stage 1: Install dependencies
# ===================
FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci

# ===================
# Stage 2: Build
# ===================
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json nest-cli.json tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma client, compile NestJS, then remove dev dependencies.
RUN npm exec prisma generate \
 && npm run build \
 && npm prune --omit=dev

# Fail early if build output is missing.
RUN test -f dist/src/main.js || (echo "ERROR: dist/src/main.js not found after build" && exit 1)

# ===================
# Stage 3: Production
# ===================
FROM base AS runner

ENV NODE_ENV=production
ENV PORT=5000

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --create-home nestjs

COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

USER nestjs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-5000}/health || exit 1

CMD ["node", "dist/src/main.js"]
