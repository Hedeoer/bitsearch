import { mkdtempSync, rmSync } from "node:fs";
import {
  createServer,
  request as createProxyRequest,
  type Server,
} from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../src/server/app.js";
import type { BootstrapConfig } from "../../src/server/bootstrap.js";
import { createDatabase } from "../../src/server/db/database.js";
import { createAdminSessionStore } from "../../src/server/lib/admin-session.js";
import {
  closeAllMcpTransports,
  closeModernMcpHandler,
  setMcpRuntimeFactoryForTooling,
} from "../../src/server/mcp/transport-router.js";
import { createMcpToolingRuntime } from "./mcp-conformance-fixtures.js";

const LOOPBACK_HOST = "127.0.0.1";
const DEFAULT_TOOLING_TOKEN = "bitsearch-mcp-tooling-token";

export interface McpToolingHarness {
  bearerToken: string;
  protectedMcpUrl: string;
  conformanceMcpUrl: string;
  close(): Promise<void>;
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, LOOPBACK_HOST, () => {
      server.off("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to resolve MCP tooling server address"));
        return;
      }
      resolve(address.port);
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function createBootstrap(tempRoot: string, bearerToken: string): BootstrapConfig {
  const databasePath = join(tempRoot, "data", "bitsearch.db");
  return {
    port: 0,
    host: LOOPBACK_HOST,
    databasePath,
    encryptionKey: "mcp-tooling-encryption-key",
    adminAuthKey: "mcp-tooling-admin-key",
    sessionSecret: "mcp-tooling-session-secret",
    mcpBearerToken: bearerToken,
    trustProxy: false,
    runtimeSecrets: {
      filePath: join(tempRoot, "runtime-secrets.json"),
      dirty: false,
      sources: {
        encryptionKey: "env",
        adminAuthKey: "env",
        sessionSecret: "env",
        mcpBearerToken: "env",
      },
      values: {
        encryptionKey: "mcp-tooling-encryption-key",
        adminAuthKey: "mcp-tooling-admin-key",
        sessionSecret: "mcp-tooling-session-secret",
        mcpBearerToken: bearerToken,
      },
    },
  };
}

function createAuthInjectingProxy(targetPort: number, bearerToken: string): Server {
  return createServer((incomingRequest, outgoingResponse) => {
    const headers = {
      ...incomingRequest.headers,
      authorization: `Bearer ${bearerToken}`,
      host: `${LOOPBACK_HOST}:${targetPort}`,
    };
    const proxyRequest = createProxyRequest(
      {
        host: LOOPBACK_HOST,
        port: targetPort,
        path: incomingRequest.url,
        method: incomingRequest.method,
        headers,
      },
      (proxyResponse) => {
        outgoingResponse.writeHead(
          proxyResponse.statusCode ?? 502,
          proxyResponse.statusMessage,
          proxyResponse.headers,
        );
        proxyResponse.pipe(outgoingResponse);
      },
    );

    proxyRequest.on("error", (error) => {
      if (!outgoingResponse.headersSent) {
        outgoingResponse.writeHead(502, { "content-type": "application/json" });
      }
      outgoingResponse.end(JSON.stringify({ error: "proxy_error", detail: error.message }));
    });
    incomingRequest.pipe(proxyRequest);
  });
}

export async function startMcpToolingHarness(): Promise<McpToolingHarness> {
  const tempRoot = mkdtempSync(join(tmpdir(), "bitsearch-mcp-tooling-"));
  const bearerToken = process.env.MCP_TOOLING_BEARER_TOKEN?.trim()
    || DEFAULT_TOOLING_TOKEN;
  const bootstrap = createBootstrap(tempRoot, bearerToken);
  const db = createDatabase(bootstrap);
  const restoreRuntimeFactory = setMcpRuntimeFactoryForTooling(createMcpToolingRuntime);
  const app = createApp({
    bootstrap,
    db,
    adminSessions: createAdminSessionStore(bootstrap.sessionSecret),
  });
  const protectedServer = createServer(app);
  let proxyServer: Server | null = null;

  try {
    const protectedPort = await listen(protectedServer);
    proxyServer = createAuthInjectingProxy(protectedPort, bearerToken);
    const proxyPort = await listen(proxyServer);
    let closed = false;

    return {
      bearerToken,
      protectedMcpUrl: `http://${LOOPBACK_HOST}:${protectedPort}/mcp`,
      conformanceMcpUrl: `http://${LOOPBACK_HOST}:${proxyPort}/mcp`,
      async close() {
        if (closed) {
          return;
        }
      closed = true;
      await closeAllMcpTransports();
      await closeModernMcpHandler().catch(() => {});
      await closeServer(proxyServer as Server);
        await closeServer(protectedServer);
        restoreRuntimeFactory();
        db.sqlite.close();
        rmSync(tempRoot, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await closeAllMcpTransports();
    if (proxyServer?.listening) {
      await closeServer(proxyServer).catch(() => {});
    }
    if (protectedServer.listening) {
      await closeServer(protectedServer).catch(() => {});
    }
    restoreRuntimeFactory();
    db.sqlite.close();
    rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}
