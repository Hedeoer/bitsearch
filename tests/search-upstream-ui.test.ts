import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StrategyRoutingTab } from "../src/web/components/strategy/StrategyRoutingTab.js";
import { ProvidersWorkspace } from "../src/web/pages/ProvidersWorkspace.js";
import { EMPTY_SYSTEM, EMPTY_TOOL_SURFACE, EMPTY_ADMIN_ACCESS, EMPTY_MCP_ACCESS } from "../src/web/app-defaults.js";
import type { ProviderDrafts } from "../src/web/types.js";

const noop = () => {};

test("Overview routing retains its original controls without the search-upstream card", () => {
  const html = renderToStaticMarkup(createElement(StrategyRoutingTab, {
    system: EMPTY_SYSTEM,
    toolSurface: EMPTY_TOOL_SURFACE,
    loading: false,
    adminAccess: EMPTY_ADMIN_ACCESS,
    mcpAccess: EMPTY_MCP_ACCESS,
    onSaveAdminAccess: async () => false,
    onSaveMcpAccess: async () => false,
    onToast: noop,
    setSystem: noop,
    onSave: noop,
  }));
  assert.match(html, /Routing Mode/);
  assert.match(html, /MCP result budget/);
  assert.match(html, /Save Routing/);
  assert.doesNotMatch(html, /search-upstream-mode|Search Upstream/);
});

test("Providers renders the independently saved search-upstream control", () => {
  const html = renderToStaticMarkup(createElement(ProvidersWorkspace, {
    dirtyProviders: [],
    drafts: {} as ProviderDrafts,
    providers: [],
    loading: false,
    saving: false,
    saveErrors: {},
    system: EMPTY_SYSTEM,
    toolSurface: EMPTY_TOOL_SURFACE,
    onDraftChange: noop,
    onSaveAll: noop,
    onToast: noop,
    onToolSurfaceChange: noop,
    onSearchUpstreamChange: noop,
  }));
  assert.match(html, /Search Upstream/);
  assert.match(html, /id="search-upstream-mode"/);
  assert.match(html, /for="search-upstream-mode"/);
  assert.match(html, /Save Search Upstream/);
  assert.match(html, /MCP Tool Exposure/);
});
