import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppContext } from "../app-context.js";
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

async function cleanupIdleTransports(): Promise<void> {
  const staleCutoff = Date.now() - MCP_SESSION_TTL_MS;
  const staleSessions = [...transports.entries()].filter(
    ([, session]) => session.lastSeenAt <= staleCutoff,
  );

  for (const [sessionId, session] of staleSessions) {
    transports.delete(sessionId);
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
  const sessionId = req.header("mcp-session-id");
  const existingTransport = getExistingTransport(sessionId);
  if (existingTransport) {
    await existingTransport.handleRequest(req, res, req.body);
    return;
  }
  if (!sessionId && isInitializeRequest(req.body)) {
    const transport = await createTransport(context);
    await transport.handleRequest(req, res, req.body);
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
  await transport.handleRequest(req, res);
}
