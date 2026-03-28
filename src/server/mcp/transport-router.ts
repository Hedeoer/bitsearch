import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { AppContext } from "../app-context.js";
import { createMcpServer, isInitializeRequest } from "./register-tools.js";

const transports = new Map<string, StreamableHTTPServerTransport>();

function getExistingTransport(sessionId: string | undefined) {
  if (!sessionId) {
    return null;
  }
  return transports.get(sessionId) ?? null;
}

async function createTransport(context: AppContext) {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      transports.set(sessionId, transport);
    },
  });
  transport.onclose = () => {
    const sessionId = transport.sessionId;
    if (sessionId) {
      transports.delete(sessionId);
    }
  };
  const server = createMcpServer(context);
  await server.connect(transport);
  return transport;
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
