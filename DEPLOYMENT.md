# BitSearch Deployment Guide

BitSearch supports two deployment modes: **Node native** (direct process) and **Container** (Docker / Docker Compose).

For image distribution, the repository now also includes a GitHub Actions workflow that can publish prebuilt Docker images to Docker Hub.

---

## Prerequisites

| Mode | Requirement |
|------|-------------|
| Node native | Node.js 22+, npm 10+ |
| Container | Docker 24+, Docker Compose v2 |

---

## Environment Variables

Copy `.env.example` to `.env`. Secrets can be left empty — BitSearch will
generate and persist them on first boot.

```bash
cp .env.example .env
```

| Variable | Required in prod | Default | Description |
|----------|-----------------|---------|-------------|
| `APP_PORT` | No | `8097` | TCP port to listen on |
| `APP_HOST` | No | `0.0.0.0` | Bind address |
| `TRUST_PROXY` | No | `false` | Set to `true` when the app is behind a reverse proxy that terminates TLS |
| `DATABASE_PATH` | No | `./data/bitsearch.db` | SQLite file path (directory must exist) |
| `RUNTIME_SECRETS_FILE` | No | `<DATABASE_PATH dir>/runtime-secrets.json` | Optional override for the persisted runtime secrets file path |
| `APP_ENCRYPTION_KEY` | No (auto) | — | AES-256-GCM key for stored API keys (must remain stable) |
| `ADMIN_AUTH_KEY` | No (auto) | — | Admin console login authorization key |
| `SESSION_SECRET` | No (auto) | — | Admin session signing secret |
| `MCP_BEARER_TOKEN` | No (auto) | — | MCP API bearer token |
| `NODE_ENV` | No | — | Use `production` for deployments; affects provider URL validation and other safety checks |

### Runtime secrets file

By default, BitSearch persists generated/loaded secrets to a local file named
`runtime-secrets.json` next to the SQLite DB. Environment variables override the
file values.

- Do not delete this file when migrating hosts; copy it together with the DB.
- If encrypted provider secrets already exist and `APP_ENCRYPTION_KEY` is
  missing, BitSearch refuses to start (to avoid silently generating a new key).

Generate a random encryption key (only needed if you manage secrets externally):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generate a random session secret (only needed if you manage secrets externally):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

If you deploy from a published image instead of building from source, set the optional compose variable below:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BITSEARCH_IMAGE` | For prebuilt-image compose only | `docker.io/hedeoerwang/bitsearch:latest` | Full image reference to pull |

---

## Mode 1: Node Native

### 1. Install dependencies and build

```bash
npm ci
npm run build
```

### 2. Create the data directory

```bash
mkdir -p data
```

### 3. Start

```bash
# Using the helper script (sets NODE_ENV=production automatically)
bash scripts/start.sh

# Or directly
NODE_ENV=production node dist/server/main.js
```

The server listens on `http://0.0.0.0:8097` by default.

### 4. Run as a systemd service (Linux)

```bash
# Copy files to deployment directory
sudo mkdir -p /opt/bitsearch
sudo cp -r dist package.json .env /opt/bitsearch/
sudo mkdir -p /opt/bitsearch/data

# Create a dedicated user
sudo useradd -r -s /bin/false bitsearch
sudo chown -R bitsearch:bitsearch /opt/bitsearch

# Install and enable the service
sudo cp deploy/bitsearch.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bitsearch

# Check status
sudo systemctl status bitsearch
sudo journalctl -u bitsearch -f
```

### Upgrading (native)

```bash
npm ci
npm run build
sudo cp -r dist /opt/bitsearch/
sudo systemctl restart bitsearch
```

---

## Mode 2: Docker

### Quick start (single container)

```bash
# Build the image
docker build -t bitsearch:latest .

# Run with environment variables from .env
docker run -d \
  --name bitsearch \
  --restart unless-stopped \
  -p 8097:8097 \
  --env-file .env \
  -v bitsearch_data:/app/data \
  bitsearch:latest
```

### Docker Compose (recommended)

```bash
# Copy and edit environment file
cp .env.example .env

# Start
docker compose up -d

# If you let BitSearch generate secrets, fetch the admin login key from:
docker exec -it bitsearch cat /app/data/runtime-secrets.json

# View logs
docker compose logs -f

# Stop
docker compose down
```

### Docker Compose (pull a published image)

Use this mode when you want to run a prebuilt image from Docker Hub instead of building from local source.

```bash
# Copy and edit environment file
cp .env.example .env

# Point to the published image you want to run
# Example:
# BITSEARCH_IMAGE=docker.io/hedeoerwang/bitsearch:latest

# Start
docker compose -f docker-compose.image.yml up -d

# Pull a newer image later
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

### Docker Compose — production hardening

Apply the production overrides (resource limits, `restart: always`, structured logging):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

For published images:

```bash
docker compose -f docker-compose.image.yml -f docker-compose.prod.yml up -d
```

### Upgrading (Docker Compose)

```bash
docker compose build --no-cache
docker compose up -d
```

Upgrading with a published image:

```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

### GitHub Actions → Docker Hub publishing

This repository now includes `.github/workflows/docker-publish.yml`.

Before enabling image publishing, configure the following in your GitHub repository under `Settings` → `Secrets and variables` → `Actions`:

| Type | Name | Value |
|------|------|-------|
| Variable | `DOCKERHUB_USERNAME` | Your Docker Hub login username |
| Variable | `DOCKERHUB_IMAGE` | Full image name, for example `your-namespace/bitsearch` or `docker.io/your-namespace/bitsearch` (not a web URL) |
| Secret | `DOCKERHUB_TOKEN` | Docker Hub personal access token with push permissions |

Workflow behavior:

- `pull_request`: build only, no push
- `push` to `main`: publish `latest`, branch, and `sha-*` tags
- `push` of a tag matching `v*.*.*`: publish semantic version tags such as `0.1.0`, `0.1`, and `0`
- `workflow_dispatch`: allow manual runs from GitHub Actions

The workflow publishes multi-platform images for `linux/amd64` and `linux/arm64`.

> **Data safety**: SQLite is stored in the `bitsearch_data` Docker named volume. It is **not** removed by `docker compose down`. Use `docker compose down -v` only if you want to wipe all data.

---

## Health Check

Both deployment modes expose a health endpoint:

```
GET /healthz  →  { "ok": true }
```

---

## File Layout (after build)

```
.
├── dist/
│   ├── public/          # Vite-built frontend (served as static files)
│   └── server/          # Compiled Node.js server
│       └── main.js
├── data/                # SQLite database (mount volume here in Docker)
├── scripts/
│   └── start.sh         # Native start helper
├── deploy/
│   └── bitsearch.service  # systemd unit template
├── Dockerfile
├── docker-compose.yml
├── docker-compose.image.yml
├── docker-compose.prod.yml
├── .github/
│   └── workflows/
│       └── docker-publish.yml
└── .env.example
```
