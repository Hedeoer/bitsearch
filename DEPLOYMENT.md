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

If you let BitSearch auto-generate secrets, start the service once and then read
the persisted runtime secrets file:

```bash
cat data/runtime-secrets.json
```

For Docker:

```bash
docker exec -it bitsearch cat /app/data/runtime-secrets.json
```

If you only need the generated admin console login key, read the
`secrets.adminAuthKey` field directly:

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('data/runtime-secrets.json','utf8')).secrets.adminAuthKey)"
```

For Docker:

```bash
docker exec -it bitsearch node -e "console.log(JSON.parse(require('fs').readFileSync('/app/data/runtime-secrets.json','utf8')).secrets.adminAuthKey)"
```

If you deploy with Docker Compose, set the optional image override below when you want a different published tag or registry mirror:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BITSEARCH_IMAGE` | No | `docker.io/hedeoerwang/bitsearch:latest` | Full image reference that `docker-compose.yml` pulls |

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

### Quick start (single container, optional low-level path)

This path is useful if you prefer raw `docker run` over Compose. The
recommended deployment path remains `docker compose up -d`.

```bash
# Pull the published image
docker pull docker.io/hedeoerwang/bitsearch:latest

# Run with environment variables from .env
docker run -d \
  --name bitsearch \
  --restart always \
  -p 8097:8097 \
  --env-file .env \
  -v bitsearch_data:/app/data \
  docker.io/hedeoerwang/bitsearch:latest
```

### Docker Compose (recommended)

`docker-compose.yml` is the single supported Compose entrypoint. It pulls the published image by default, mounts the persistent data volume, enables log rotation, and configures restart/healthcheck behavior.

```bash
# Copy and edit environment file
cp .env.example .env

# Optional: pin a different image tag
# BITSEARCH_IMAGE=docker.io/hedeoerwang/bitsearch:latest

# Start
docker compose up -d

# If you let BitSearch generate secrets, fetch the admin login key from:
docker exec -it bitsearch cat /app/data/runtime-secrets.json

# View logs
docker compose logs -f

# Stop
docker compose down
```

### Upgrading (Docker Compose)

```bash
docker compose pull
docker compose up -d
```

### Reverse proxy (Nginx)

If BitSearch is exposed behind Nginx, set `TRUST_PROXY=true` in `.env` so the
Admin Console and MCP access panel use the externally visible protocol and host.

It is recommended to expose BitSearch at the site root of a dedicated domain
such as `https://bitsearch.example.com`, because the frontend router and
backend endpoints use root-based paths like `/`, `/api/admin`, and `/mcp`.

Example Nginx configuration:

```nginx
upstream bitsearch_backend {
    server 127.0.0.1:8097;
    keepalive 32;
}

log_format bitsearch_mcp '$remote_addr - $remote_user [$time_local] '
                         '"$request" $status $body_bytes_sent '
                         'upstream_status="$upstream_status" '
                         'upstream_response_time="$upstream_response_time" '
                         'sid="$http_mcp_session_id" '
                         'proto="$http_mcp_protocol_version" '
                         'origin="$http_origin" '
                         'accept="$http_accept" '
                         'ua="$http_user_agent"';

server {
    listen 80;
    server_name bitsearch.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bitsearch.example.com;

    ssl_certificate     /etc/letsencrypt/live/bitsearch.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bitsearch.example.com/privkey.pem;

    access_log /var/log/nginx/bitsearch_access.log;
    error_log  /var/log/nginx/bitsearch_error.log warn;

    location = /mcp {
        access_log /var/log/nginx/bitsearch_mcp_access.log bitsearch_mcp;

        proxy_pass http://bitsearch_backend;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header Connection "";

        proxy_request_buffering off;
        proxy_buffering off;
        proxy_intercept_errors off;
        proxy_pass_request_headers on;

        proxy_pass_header Mcp-Session-Id;
        proxy_pass_header Content-Type;
        proxy_pass_header Cache-Control;

        chunked_transfer_encoding off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location / {
        proxy_pass http://bitsearch_backend;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
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

Container deployments in this repository intentionally probe
`http://127.0.0.1:${APP_PORT}/healthz` instead of `localhost`. In Alpine-based
containers, `localhost` may resolve to `::1` first, while the BitSearch process
listens on IPv4 `0.0.0.0:${APP_PORT}` by default. Using `127.0.0.1` avoids
false `unhealthy` container states caused by IPv6 loopback resolution.

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
├── .github/
│   └── workflows/
│       └── docker-publish.yml
└── .env.example
```
