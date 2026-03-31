import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createApp } from "../src/server/app.js";
import type { BootstrapConfig } from "../src/server/bootstrap.js";
import { createDatabase } from "../src/server/db/database.js";
import { createAdminSessionStore } from "../src/server/lib/admin-session.js";
import { resolveRuntimeSecrets } from "../src/server/lib/runtime-secrets.js";

function createTestBootstrap(tempRoot: string): BootstrapConfig {
  const databasePath = join(tempRoot, "data", "bitsearch.db");
  const runtimeSecrets = resolveRuntimeSecrets(databasePath);
  return {
    port: 0,
    host: "127.0.0.1",
    databasePath,
    encryptionKey: runtimeSecrets.values.encryptionKey,
    adminAuthKey: runtimeSecrets.values.adminAuthKey,
    sessionSecret: runtimeSecrets.values.sessionSecret,
    mcpBearerToken: runtimeSecrets.values.mcpBearerToken,
    trustProxy: true,
    runtimeSecrets,
  };
}

test("MCP initialize accepts desktop client Origin headers when bearer token is valid", async (t) => {
  const tempRoot = mkdtempSync(join(tmpdir(), "bitsearch-mcp-origin-"));
  t.after(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  const bootstrap = createTestBootstrap(tempRoot);
  const db = createDatabase(bootstrap);
  const app = createApp({
    bootstrap,
    db,
    adminSessions: createAdminSessionStore(bootstrap.sessionSecret),
  });

  const server = await new Promise<import("node:http").Server>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  t.after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    db.sqlite.close();
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");

  const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bootstrap.mcpBearerToken}`,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      Origin: "null",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: "node-test",
          version: "1.0.0",
        },
      },
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  assert.ok(response.headers.get("mcp-session-id"));
});

test("MCP desktop clients can send notifications without session or protocol headers after initialize", async (t) => {
  const tempRoot = mkdtempSync(join(tmpdir(), "bitsearch-mcp-compat-"));
  t.after(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  const bootstrap = createTestBootstrap(tempRoot);
  const db = createDatabase(bootstrap);
  const app = createApp({
    bootstrap,
    db,
    adminSessions: createAdminSessionStore(bootstrap.sessionSecret),
  });

  const server = await new Promise<import("node:http").Server>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  t.after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    db.sqlite.close();
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/mcp`;

  const initializeResponse = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bootstrap.mcpBearerToken}`,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      Origin: "null",
      "User-Agent": "CherryStudio/1.8.4",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: "Cherry Studio",
          version: "1.8.4",
        },
      },
    }),
  });

  assert.equal(initializeResponse.status, 200);
  assert.ok(initializeResponse.headers.get("mcp-session-id"));

  const notificationResponse = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bootstrap.mcpBearerToken}`,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      Origin: "null",
      "User-Agent": "CherryStudio/1.8.4",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    }),
  });

  assert.equal(notificationResponse.status, 202);
});

test("MCP desktop clients can list tools without session or protocol headers after initialize", async (t) => {
  const tempRoot = mkdtempSync(join(tmpdir(), "bitsearch-mcp-compat-"));
  t.after(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  const bootstrap = createTestBootstrap(tempRoot);
  const db = createDatabase(bootstrap);
  const app = createApp({
    bootstrap,
    db,
    adminSessions: createAdminSessionStore(bootstrap.sessionSecret),
  });

  const server = await new Promise<import("node:http").Server>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  t.after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    db.sqlite.close();
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/mcp`;
  const baseHeaders = {
    Authorization: `Bearer ${bootstrap.mcpBearerToken}`,
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    Origin: "null",
    "User-Agent": "CherryStudio/1.8.4",
  };

  const initializeResponse = await fetch(baseUrl, {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: "Cherry Studio",
          version: "1.8.4",
        },
      },
    }),
  });

  assert.equal(initializeResponse.status, 200);
  assert.ok(initializeResponse.headers.get("mcp-session-id"));

  const toolsListResponse = await fetch(baseUrl, {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }),
  });

  assert.equal(toolsListResponse.status, 200);
  assert.equal(toolsListResponse.headers.get("content-type"), "text/event-stream");
  const body = await toolsListResponse.text();
  assert.match(body, /"name":"web_search"/);
});
