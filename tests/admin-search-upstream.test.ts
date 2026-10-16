import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { createApp } from "../src/server/app.js";
import { getSystemSettings, saveSystemSettings } from "../src/server/repos/settings-repo.js";
import { createSearchContext } from "./helpers/search-fixture.js";

test("search routing settings require auth, save independently and preserve legacy PUT semantics", async (t) => {
  const context = createSearchContext(t);
  saveSystemSettings(context.db, { searchUpstreamMode: "tavily_only", logRetentionDays: 17 });
  const server = createApp(context).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api/admin`;
  try {
    const anonymous = await fetch(`${url}/search-upstream`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ searchUpstreamMode: "llm_only" }),
    });
    assert.equal(anonymous.status, 401);
    const login = await fetch(`${url}/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ authKey: "test-admin" }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie);
    const headers = { "content-type": "application/json", cookie };
    const before = getSystemSettings(context.db);

    for (const searchUpstreamMode of ["llm_first", "llm_only", "tavily_first", "tavily_only"] as const) {
      const response = await fetch(`${url}/search-upstream`, {
        method: "PUT", headers, body: JSON.stringify({ searchUpstreamMode }),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { searchUpstreamMode });
      assert.deepEqual(getSystemSettings(context.db), { ...before, searchUpstreamMode });
    }

    const { searchUpstreamMode: _mode, ...legacyPayload } = getSystemSettings(context.db);
    const legacySave = await fetch(`${url}/system`, {
      method: "PUT", headers, body: JSON.stringify({ ...legacyPayload, logRetentionDays: 23 }),
    });
    assert.equal(legacySave.status, 200);
    const updated = await legacySave.json();
    assert.equal(updated.searchUpstreamMode, "tavily_only");
    assert.equal(updated.logRetentionDays, 23);

    for (const body of [{}, { searchUpstreamMode: "invalid" }, { searchUpstreamMode: null }, { searchUpstreamMode: "llm_only", defaultSearchModel: "unrelated-change" }]) {
      const badSave = await fetch(`${url}/search-upstream`, { method: "PUT", headers, body: JSON.stringify(body) });
      assert.equal(badSave.status, 400);
      assert.equal(getSystemSettings(context.db).searchUpstreamMode, "tavily_only");
      assert.equal(getSystemSettings(context.db).defaultSearchModel, before.defaultSearchModel);
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
