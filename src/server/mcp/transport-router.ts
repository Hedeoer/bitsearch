import type { Request, Response } from "express";
import { createHash, randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DEFAULT_NEGOTIATED_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import type { AppContext } from "../app-context.js";
import { parseBearerToken } from "../lib/auth.js";
import { createMcpRuntime, isInitializeRequest } from "./register-tools.js";
import { getToolSurfaceSnapshot } from "../services/tool-surface-service.js";

const MCP_SESSION_TTL_MS = 30 * 60 * 1000;
const MCP_SESSION_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

interface TransportSession {
  server: McpServer;
  syncToolSurface: (nextToolSurface: ReturnType<typeof getToolSurfaceSnapshot>) => void;
  transport: StreamableHTTPServerTransport;
  lastSeenAt: number;
}

const transports = new Map<string, TransportSession>();
const clientSessionHints = new Map<string, string>();
const sessionClientHints = new Map<string, string>();

function getClientIp(req: Request, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) {
      return forwarded;
    }
  }
  return req.socket.remoteAddress || req.ip || "";
}

function createClientFingerprint(context: AppContext, req: Request): string | null {
  const token = parseBearerToken(req.header("authorization"));
  if (!token) {
    return null;
  }
  const clientIp = getClientIp(req, context.bootstrap.trustProxy);
  const userAgent = req.header("user-agent") ?? "";
  return createHash("sha256")
    .update(token)
    .update("\0")
    .update(clientIp)
    .update("\0")
    .update(userAgent)
    .digest("hex");
}

function forgetClientSession(sessionId: string): void {
  const fingerprint = sessionClientHints.get(sessionId);
  if (!fingerprint) {
    return;
  }
  if (clientSessionHints.get(fingerprint) === sessionId) {
    clientSessionHints.delete(fingerprint);
  }
  sessionClientHints.delete(sessionId);
}

function rememberClientSession(context: AppContext, req: Request, sessionId: string): void {
  const fingerprint = createClientFingerprint(context, req);
  if (!fingerprint) {
    return;
  }
  const previousSessionId = clientSessionHints.get(fingerprint);
  if (previousSessionId && previousSessionId !== sessionId) {
    sessionClientHints.delete(previousSessionId);
  }
  const previousFingerprint = sessionClientHints.get(sessionId);
  if (previousFingerprint && previousFingerprint !== fingerprint) {
    clientSessionHints.delete(previousFingerprint);
  }
  clientSessionHints.set(fingerprint, sessionId);
  sessionClientHints.set(sessionId, fingerprint);
}

function resolveCompatibleSessionId(
  context: AppContext,
  req: Request,
): string | undefined {
  const fingerprint = createClientFingerprint(context, req);
  if (!fingerprint) {
    return undefined;
  }
  const sessionId = clientSessionHints.get(fingerprint);
  if (!sessionId) {
    return undefined;
  }
  if (!transports.has(sessionId)) {
    clientSessionHints.delete(fingerprint);
    sessionClientHints.delete(sessionId);
    return undefined;
  }
  console.debug("Recovered MCP session for compatibility", {
    fingerprint: fingerprint.slice(0, 12),
    sessionId,
  });
  return sessionId;
}

function setCompatibilityHeader(
  req: Request,
  headerName: string,
  rawHeaderName: string,
  value: string,
): void {
  req.headers[headerName] = value;
  const rawHeaders = req.rawHeaders;
  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (rawHeaders[index].toLowerCase() === headerName) {
      rawHeaders[index + 1] = value;
      return;
    }
  }
  rawHeaders.push(rawHeaderName, value);
}

function ensureProtocolVersionHeader(req: Request): void {
  if (req.header("mcp-protocol-version")) {
    return;
  }
  setCompatibilityHeader(
    req,
    "mcp-protocol-version",
    "Mcp-Protocol-Version",
    DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  );
  console.debug("Defaulted MCP protocol version for compatibility", {
    protocolVersion: DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  });
}

async function cleanupIdleTransports(): Promise<void> {
  const staleCutoff = Date.now() - MCP_SESSION_TTL_MS;
  const staleSessions = [...transports.entries()].filter(
    ([, session]) => session.lastSeenAt <= staleCutoff,
  );

  for (const [sessionId, session] of staleSessions) {
    transports.delete(sessionId);
    forgetClientSession(sessionId);
    try {
      await session.transport.close();
    } catch (error) {
      console.error(`Failed to close MCP transport ${sessionId}`, error);
    }
  }
}

const sweepTimer = setInterval(() => {
  void cleanupIdleTransports();
}, MCP_SESSION_SWEEP_INTERVAL_MS);

sweepTimer.unref();

function getExistingTransport(sessionId: string | undefined) {
  if (!sessionId) {
    return null;
  }
  const session = transports.get(sessionId) ?? null;
  if (!session) {
    return null;
  }
  session.lastSeenAt = Date.now();
  return session.transport;
}

async function createTransport(context: AppContext) {
  let server: McpServer;
  let syncToolSurface: TransportSession["syncToolSurface"] = () => {};
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      transports.set(sessionId, {
        server,
        syncToolSurface,
        transport,
        lastSeenAt: Date.now(),
      });
    },
  });
  transport.onclose = () => {
    const sessionId = transport.sessionId;
    if (sessionId) {
      transports.delete(sessionId);
      forgetClientSession(sessionId);
    }
  };
  const runtime = createMcpRuntime(context);
  server = runtime.server;
  syncToolSurface = runtime.syncToolSurface;
  await server.connect(transport);
  return transport;
}

export function broadcastToolListChanged(context: AppContext): void {
  const latestToolSurface = getToolSurfaceSnapshot(context);
  for (const [sessionId, session] of transports.entries()) {
    try {
      session.syncToolSurface(latestToolSurface);
      session.server.sendToolListChanged();
    } catch (error) {
      console.error(`Failed to broadcast tool list change for session ${sessionId}`, error);
    }
  }
}

function sendJsonRpcError(
  res: Response,
  status: number,
  code: number,
  message: string,
): void {
  res.status(status).json({
    jsonrpc: "2.0",
    error: {
      code,
      message,
    },
    id: null,
  });
}

function sendMissingSession(res: Response): void {
  sendJsonRpcError(res, 400, -32000, "Bad Request: Mcp-Session-Id header is required");
}

function sendSessionNotFound(res: Response): void {
  sendJsonRpcError(res, 404, -32001, "Session not found");
}

export async function handleMcpPost(
  context: AppContext,
  req: Request,
  res: Response,
): Promise<void> {
  const initializeRequest = isInitializeRequest(req.body);
  let sessionId = req.header("mcp-session-id");
  if (!initializeRequest) {
    ensureProtocolVersionHeader(req);
  }
  if (!sessionId && !initializeRequest) {
    sessionId = resolveCompatibleSessionId(context, req);
    if (sessionId) {
      setCompatibilityHeader(req, "mcp-session-id", "Mcp-Session-Id", sessionId);
    }
  }
  const existingTransport = getExistingTransport(sessionId);
  if (existingTransport) {
    if (sessionId) {
      rememberClientSession(context, req, sessionId);
    }
    await existingTransport.handleRequest(req, res, req.body);
    return;
  }
  if (!sessionId && initializeRequest) {
    const transport = await createTransport(context);
    await transport.handleRequest(req, res, req.body);
    if (transport.sessionId) {
      rememberClientSession(context, req, transport.sessionId);
    }
    return;
  }
  if (!sessionId) {
    sendMissingSession(res);
    return;
  }
  sendSessionNotFound(res);
}

export async function handleMcpGet(req: Request, res: Response): Promise<void> {
  const sessionId = req.header("mcp-session-id");
  const transport = getExistingTransport(sessionId);
  if (!transport) {
    if (!sessionId) {
      sendMissingSession(res);
      return;
    }
    sendSessionNotFound(res);
    return;
  }
  ensureProtocolVersionHeader(req);
  await transport.handleRequest(req, res);
}

export async function handleMcpDelete(req: Request, res: Response): Promise<void> {
  const sessionId = req.header("mcp-session-id");
  const transport = getExistingTransport(sessionId);
  if (!transport) {
    if (!sessionId) {
      sendMissingSession(res);
      return;
    }
    sendSessionNotFound(res);
    return;
  }
  ensureProtocolVersionHeader(req);
  await transport.handleRequest(req, res);
}
