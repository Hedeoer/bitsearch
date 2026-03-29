# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.server.json vite.config.ts ./
COPY src ./src
COPY index.html ./

RUN npm run build

# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

ENV NODE_ENV=production

RUN addgroup -S bitsearch && adduser -S bitsearch -G bitsearch

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy build artifacts
COPY --from=builder /build/dist ./dist

# Data directory for SQLite persistence (mount a volume here)
RUN mkdir -p data && chown bitsearch:bitsearch data

USER bitsearch

EXPOSE 8097

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${APP_PORT:-8097}/healthz || exit 1

CMD ["node", "dist/server/main.js"]
