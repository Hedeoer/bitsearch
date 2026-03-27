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

function sendInvalidSession(res: Response): void {
  res.status(400).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Bad Request: No valid session ID provided",
    },
    id: null,
  });
}

export async function handleMcpPost(
  context: AppContext,
  req: Request,
  res: Response,
): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
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
  sendInvalidSession(res);
}

export async function handleMcpGet(req: Request, res: Response): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const transport = getExistingTransport(sessionId);
  if (!transport) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transport.handleRequest(req, res);
}

export async function handleMcpDelete(req: Request, res: Response): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const transport = getExistingTransport(sessionId);
  if (!transport) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transport.handleRequest(req, res);
}
