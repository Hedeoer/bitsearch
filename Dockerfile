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

RUN apk add --no-cache su-exec \
  && addgroup -S bitsearch \
  && adduser -S bitsearch -G bitsearch

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy build artifacts
COPY --from=builder /build/dist ./dist
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

# Data directory for SQLite persistence (mount a volume here)
RUN chmod +x ./scripts/docker-entrypoint.sh \
  && mkdir -p data \
  && chown bitsearch:bitsearch data

EXPOSE 8097

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${APP_PORT:-8097}/healthz || exit 1

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["node", "dist/server/main.js"]
