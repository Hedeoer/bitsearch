import type { Request } from "express";
import type { McpAccessInfo } from "../../shared/contracts.js";
import type { AppContext } from "../app-context.js";
import { getEffectiveMcpBearerToken } from "../repos/settings-repo.js";

const MCP_PATH = "/mcp";
const MCP_AUTH_SCHEME = "Bearer";
const TOKEN_PREVIEW_SUFFIX_LENGTH = 4;
const TOKEN_PREVIEW_MASK = "********";

function getForwardedValue(
  req: Request,
  headerName: string,
): string | null {
  const value = req.header(headerName)?.split(",")[0]?.trim();
  return value || null;
}

function getRequestProtocol(
  req: Request,
  trustProxy: boolean,
): string {
  if (!trustProxy) {
    return req.protocol;
  }
  const forwarded = getForwardedValue(req, "x-forwarded-proto");
  return forwarded || req.protocol;
}

function getRequestHost(
  req: Request,
  trustProxy: boolean,
): string {
  if (!trustProxy) {
    return req.header("host") ?? "";
  }
  const forwarded = getForwardedValue(req, "x-forwarded-host");
  return forwarded || req.header("host") || "";
}

function createTokenPreview(token: string): string {
  return `${TOKEN_PREVIEW_MASK}${token.slice(-TOKEN_PREVIEW_SUFFIX_LENGTH)}`;
}

export function getMcpAccessInfo(
  context: AppContext,
  req: Request,
): McpAccessInfo {
  const token = getEffectiveMcpBearerToken(
    context.db,
    context.bootstrap.mcpBearerToken,
  );
  const protocol = getRequestProtocol(req, context.bootstrap.trustProxy);
  const host = getRequestHost(req, context.bootstrap.trustProxy);
  return {
    streamHttpUrl: `${protocol}://${host}${MCP_PATH}`,
    authScheme: MCP_AUTH_SCHEME,
    hasBearerToken: Boolean(token),
    tokenPreview: token ? createTokenPreview(token) : null,
  };
}
