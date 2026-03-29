# BitSearch

Self-hosted MCP search gateway and admin console for personal use, with controllable web retrieval, key-pool failover, and observable search traffic.

<p>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green.svg"></a>
  <a href="https://www.typescriptlang.org/"><img alt="Language: TypeScript" src="https://img.shields.io/badge/language-TypeScript-3178C6.svg"></a>
  <a href="https://nodejs.org/"><img alt="Node.js" src="https://img.shields.io/badge/node-22%2B-5FA04E.svg"></a>
  <a href="Dockerfile"><img alt="Docker Ready" src="https://img.shields.io/badge/docker-ready-2496ED.svg"></a>
  <a href="https://github.com/Hedeoer/bitsearch/actions/workflows/docker-publish.yml"><img alt="Docker Publish" src="https://github.com/Hedeoer/bitsearch/actions/workflows/docker-publish.yml/badge.svg"></a>
  <a href="https://hub.docker.com/r/hedeoerwang/bitsearch"><img alt="Docker Hub" src="https://img.shields.io/badge/image-hedeoerwang%2Fbitsearch-2496ED.svg"></a>
  <a href="https://github.com/Hedeoer/bitsearch"><img alt="GitHub stars" src="https://img.shields.io/github/stars/Hedeoer/bitsearch"></a>
</p>

## About

BitSearch packages two things into one deployable service: an HTTP-based Model Context Protocol server and a browser-based admin console. It is designed for individual users who want a single, self-hosted entrypoint for web search, fetch, and site-mapping workflows without giving up control over provider credentials, routing order, or request visibility.

The backend exposes `13` MCP tools over streamable HTTP, routes fetch-like operations across Tavily and Firecrawl key pools, and persists telemetry in SQLite. The frontend gives a single user one workspace for provider configuration, key imports, quota sync, MCP access details, dashboards, and request activity inspection. BitSearch does not implement team-facing collaboration or multi-user workspace features.

Project endpoints:

- GitHub: `https://github.com/Hedeoer/bitsearch`
- Docker Hub image: `docker.io/hedeoerwang/bitsearch`

### Highlights

- Exposes `13` MCP tools across search, configuration, and planning workflows.
- Supports multi-provider routing with ordered failover for Tavily and Firecrawl operations.
- Manages provider key pools with bulk import, enable/disable controls, testing, notes, quota sync, and CSV export.
- Includes a six-phase query planning engine for structured search execution.
- Tracks request logs, per-attempt failures, dashboard metrics, and recent errors in a built-in admin console.
- Supports two deployment paths: npm-based source deployment and Docker container deployment.

### Architecture

```mermaid
flowchart LR
    Client[LLM Client] -- MCP --> Server[BitSearch Gateway]
    Server -- web_search --> SearchEngine[Search Engine API]
    Server -- web_fetch / web_map --> Router{Failover Router}
    Router -- Priority 1 --> Tavily[Tavily API]
    Router -- Priority 2 --> Firecrawl[Firecrawl API]
    Server -. telemetry .-> SQLite[(Local Database)]
    Admin[Admin UI] -- HTTP --> SQLite
```

### MCP Tools Reference

BitSearch exposes 13 tools to the LLM client, covering three main areas:

#### 1. Search & Web Access
- **`web_search`**: Performs AI-driven web search using the configured search engine model. Caches sources server-side.
- **`get_sources`**: Retrieves source links cached during a `web_search` call using the returned `session_id`.
- **`web_fetch`**: Extracts full Markdown content from a target URL. Automatically fails over across Tavily and Firecrawl key pools.
- **`web_map`**: Maps website structure and discovers URLs using Tavily Map or Firecrawl.

#### 2. Planning Engine
A scaffold for LLMs to generate structured search strategies for highly complex tasks:
- **`plan_intent`**: Phase 1 - Analyze user intent and ambiguities.
- **`plan_complexity`**: Phase 2 - Assess if the task requires simple or multi-level planning.
- **`plan_sub_query`**: Phase 3 - Break down the task into sub-queries.
- **`plan_search_term`**: Phase 4 - Devise targeted search terms.
- **`plan_tool_mapping`**: Phase 5 - Map sub-queries to specific web tools.
- **`plan_execution`**: Phase 6 - Determine parallel vs. sequential execution.

#### 3. System Management
- **`get_config_info`**: Retrieves current server settings, key pool status, and tests search engine connectivity.
- **`switch_model`**: Toggles the default AI model used for `web_search`.
- **`toggle_builtin_tools`**: Indicates status of local client tool overriding (primarily for local Claude Code setups).

### Project Structure

```text
src/
├── server/
│   ├── db/              # SQLite database schema and instantiation
│   ├── http/            # Express admin routes, session, and middleware
│   ├── lib/             # Crypto, auth, HTTP helpers, admin session store
│   ├── mcp/             # MCP SDK tool registrations and input schemas
│   ├── providers/       # Fetch adapters (Tavily, Firecrawl, Search Engine)
│   ├── repos/           # Database repositories (logs, keys, queries)
│   ├── services/        # Core logic (Planning Engine, access controllers)
│   ├── app-context.ts   # AppContext interface shared across server modules
│   ├── main.ts          # Service entry point
│   ├── app.ts           # Express app layout
│   └── bootstrap.ts     # Runtime environment validation
├── shared/
│   └── contracts.ts     # Zod schemas and API payloads shared via ESM
└── web/
    ├── components/      # React components (Dashboard, Key Pools, Activity)
    ├── pages/           # Main workspace layouts
    ├── api.ts           # Frontend fetch client
    ├── format.ts        # Display formatting utilities
    ├── types.ts         # Frontend type definitions
    ├── toast-store.ts   # Toast notification state
    ├── LoginView.tsx    # Admin login page
    ├── theme.css        # Design tokens and theme system
    ├── styles.css       # Global and component styles
    └── main.tsx         # React UI entry point
```

## Built With

- [TypeScript](https://www.typescriptlang.org/)
- [Node.js](https://nodejs.org/)
- [Express](https://expressjs.com/)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Zod](https://zod.dev/)
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- SQLite (`node:sqlite`)
- Docker and Docker Compose

## Getting Started

### Prerequisites

| Mode | Requirement |
|------|-------------|
| npm deployment | Node.js `22+`, npm `10+` |
| Docker deployment | Docker `24+`, Docker Compose v2 |

### Installation

Shell examples below use `bash`. A PowerShell alternative is shown where the command differs.

1. Clone the repository and install dependencies.

```bash
git clone https://github.com/Hedeoer/bitsearch.git
cd bitsearch
npm ci
```

2. Copy the example environment file.

```bash
cp .env.example .env
```

```powershell
Copy-Item .env.example .env
```

3. Fill in the required production values.

Required in production:

- `APP_ENCRYPTION_KEY`
- `ADMIN_AUTH_KEY`
- `SESSION_SECRET`
- `MCP_BEARER_TOKEN`

Common runtime settings:

- `APP_PORT` defaults to `8097`
- `APP_HOST` defaults to `0.0.0.0`
- `TRUST_PROXY=true` is required when a reverse proxy terminates TLS
- `DATABASE_PATH` controls the SQLite file path
- `BITSEARCH_IMAGE` can be set to `docker.io/hedeoerwang/bitsearch:<tag>` when running a published image

4. Generate random secrets when needed.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

5. If you plan to use npm deployment, create the local data directory.

```bash
mkdir -p data
```

```powershell
New-Item -ItemType Directory -Force data | Out-Null
```

> Docker Compose reads `.env` automatically. npm deployment does not; export the variables from `.env` into your shell before starting the server.

### Quick Start

#### Option 1: npm deployment

```bash
npm run build
set -a
source .env
set +a
bash scripts/start.sh
```

This starts the production server from local source and serves the built admin UI from the same process.

#### Option 2: Docker deployment

Build and run the local container image with Docker Compose:

```bash
docker compose up -d --build
```

Useful commands:

```bash
docker compose logs -f
docker compose down
```

Published image deployment after the first successful GitHub Actions publish run:

```bash
export BITSEARCH_IMAGE=docker.io/hedeoerwang/bitsearch:latest
docker compose -f docker-compose.image.yml up -d
```

The Docker publish workflow runs on pushes to `main` and on tags matching `v*.*.*`. The first successful push to `main` is what makes `docker.io/hedeoerwang/bitsearch:latest` available.

#### Option 3: Development mode
For local development, run the Vite frontend and TSX backend concurrently:
```bash
# Starts the Express server via tsx and the Vite dev server
npm run dev
```
- Admin Console: `http://localhost:5173`
- Backend API/MCP: `http://localhost:8097`

Useful endpoints after either deployment mode starts:

- App and admin console: `http://127.0.0.1:8097`
- Health check: `http://127.0.0.1:8097/healthz`
- MCP endpoint: `http://127.0.0.1:8097/mcp`

For full deployment options, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Usage

### 1. Verify the service is running

```bash
curl http://127.0.0.1:8097/healthz
```

Expected response:

```json
{"ok":true}
```

### 2. Connect an MCP client

Example streamable HTTP client configuration. The exact field names vary by client, but the endpoint and bearer token are the important parts:

```json
{
  "mcpServers": {
    "bitsearch": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:8097/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_BEARER_TOKEN>"
      }
    }
  }
}
```

### 3. Operate the admin console

1. Start the app with one of the deployment modes above.
2. Open `http://127.0.0.1:8097`.
3. Sign in with `ADMIN_AUTH_KEY`.
4. Configure provider base URLs, import Tavily / Firecrawl keys, and review the MCP access panel.
5. Use the Overview, Providers, Keys, and Activity workspaces to monitor routing behavior and failures.

### Screenshots

![BitSearch overview](docs/images/overview.png)

![BitSearch providers](docs/images/providers.png)

![BitSearch keypools](docs/images/keypools.png)

![BitSearch activity](docs/images/activity.png)

## FAQ & Troubleshooting

- **Q: MCP connection times out / fails?**
  A: Ensure `TRUST_PROXY=true` in your `.env` if exposing behind an NGinX/Caddy reverse proxy, and make sure `MCP_BEARER_TOKEN` matches your client config.
- **Q: What happens when Tavily keys run out of quota?**
  A: The Failover Router will mark the exhausted key as invalid for a timeout period and rotate to the next active Tavily key. If no Tavily keys remain, it gracefully downgrades to Firecrawl.
- **Q: I lost my `APP_ENCRYPTION_KEY`. Can I recover my API keys?**
  A: No. Keys are securely stored in SQLite using AES-256-GCM. If you lose the encryption key, you cannot decrypt the payload and must truncate the database to re-import keys.

## Acknowledgments

This project is heavily inspired by [GrokSearch](https://github.com/GuDaStudio/GrokSearch) by GuDaStudio. BitSearch builds upon their AI-search + scraping fallback architecture, adding an Admin Console and Key Pooling capabilities.

## Roadmap

- Add more provider adapters and per-tool routing policies.
- Increase automated coverage for MCP transport, failover logic, and admin flows.
- Add release notes and documented image version channels for Docker Hub consumers.
- Expand dashboard analytics and operational audit views.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for issue reporting, pull request flow, coding standards, and verification requirements.

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for the full text.
