import { useEffect, useState } from "react";
import type {
  DashboardSummary,
  ProviderConfigRecord,
  ProviderKeyRecord,
  SystemSettings,
} from "@shared/contracts";
import { apiRequest } from "./api";

type SessionState = {
  loggedIn: boolean;
  username: string | null;
};

type ProviderDraft = Record<string, { enabled: boolean; baseUrl: string; timeoutMs: number; apiKey: string }>;
type AttemptLog = Record<string, unknown>;

const EMPTY_SYSTEM: SystemSettings = {
  fetchMode: "auto_ordered",
  providerPriority: ["tavily", "firecrawl"],
  defaultGrokModel: "grok-4-fast",
  logRetentionDays: 7,
  allowedOrigins: [],
};

export function App() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [providers, setProviders] = useState<ProviderConfigRecord[]>([]);
  const [providerDrafts, setProviderDrafts] = useState<ProviderDraft>({});
  const [keys, setKeys] = useState<ProviderKeyRecord[]>([]);
  const [system, setSystem] = useState<SystemSettings>(EMPTY_SYSTEM);
  const [selectedProvider, setSelectedProvider] = useState<"tavily" | "firecrawl">("tavily");
  const [rawKeys, setRawKeys] = useState("");
  const [tags, setTags] = useState("");
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [attempts, setAttempts] = useState<AttemptLog[]>([]);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    if (!session?.loggedIn) {
      return;
    }
    void refreshAll();
  }, [session?.loggedIn]);

  async function loadSession() {
    const data = await apiRequest<SessionState>("/api/admin/session");
    setSession(data);
  }

  async function refreshAll() {
    const [dashboardData, providerData, keyData, systemData, logData, attemptData] = await Promise.all([
      apiRequest<DashboardSummary>("/api/admin/dashboard"),
      apiRequest<ProviderConfigRecord[]>("/api/admin/providers"),
      apiRequest<ProviderKeyRecord[]>("/api/admin/keys"),
      apiRequest<SystemSettings>("/api/admin/system"),
      apiRequest<Array<Record<string, unknown>>>("/api/admin/logs?limit=50"),
      apiRequest<AttemptLog[]>("/api/admin/logs/attempts?limit=50"),
    ]);
    setDashboard(dashboardData);
    setProviders(providerData);
    setKeys(keyData);
    setSystem(systemData);
    setLogs(logData);
    setAttempts(attemptData);
    setProviderDrafts(
      Object.fromEntries(
        providerData.map((item) => [
          item.provider,
          {
            enabled: item.enabled,
            baseUrl: item.baseUrl,
            timeoutMs: item.timeoutMs,
            apiKey: "",
          },
        ]),
      ),
    );
  }

  async function login() {
    try {
      await apiRequest("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setPassword("");
      setMessage("");
      await loadSession();
    } catch {
      setMessage("登录失败，请检查用户名和密码。");
    }
  }

  async function logout() {
    await apiRequest("/api/admin/logout", { method: "POST" });
    setSession({ loggedIn: false, username: null });
  }

  async function saveProvider(provider: string) {
    const draft = providerDrafts[provider];
    await apiRequest("/api/admin/providers/" + provider, {
      method: "PUT",
      body: JSON.stringify(draft),
    });
    setMessage(`Saved provider: ${provider}`);
    await refreshAll();
  }

  async function saveSystem() {
    await apiRequest("/api/admin/system", {
      method: "PUT",
      body: JSON.stringify(system),
    });
    setMessage("Saved system settings");
    await refreshAll();
  }

  async function importTextKeys() {
    await apiRequest("/api/admin/keys/import-text", {
      method: "POST",
      body: JSON.stringify({
        provider: selectedProvider,
        rawKeys,
        tags,
      }),
    });
    setRawKeys("");
    setMessage("Imported keys");
    await refreshAll();
  }

  async function bulkToggle(enabled: boolean) {
    const ids = keys.filter((item) => item.provider === selectedProvider).map((item) => item.id);
    await apiRequest("/api/admin/keys/bulk", {
      method: "PATCH",
      body: JSON.stringify({ ids, enabled }),
    });
    setMessage(enabled ? "Enabled all selected provider keys" : "Disabled all selected provider keys");
    await refreshAll();
  }

  async function deleteKey(id: string) {
    await apiRequest("/api/admin/keys", {
      method: "DELETE",
      body: JSON.stringify({ ids: [id] }),
    });
    setMessage("Deleted key");
    await refreshAll();
  }

  const selectedKeys = keys.filter((item) => item.provider === selectedProvider);

  if (!session?.loggedIn) {
    return (
      <main className="shell">
        <section className="login-card">
          <div className="eyebrow">BitSearch</div>
          <h1>统一 MCP 管理台</h1>
          <p className="muted">登录后配置 Grok、Tavily、Firecrawl 与远程 MCP 服务。</p>
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button onClick={() => void login()}>Login</button>
          {message ? <p className="muted">{message}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <div className="eyebrow">BitSearch Admin</div>
          <h1>统一 Streamable HTTP MCP 管理台</h1>
          <p className="muted">
            管理员：{session.username}。对外端点为 <code>/mcp</code>，后台与 MCP Bearer 独立。
          </p>
        </div>
        <div className="hero-actions">
          <button className="ghost" onClick={() => void refreshAll()}>
            Refresh
          </button>
          <button className="ghost" onClick={() => void logout()}>
            Logout
          </button>
        </div>
      </header>

      {message ? <section className="toast">{message}</section> : null}

      <section className="grid two">
        <article className="card">
          <h2>Dashboard</h2>
          <div className="stats">
            <div><span>Total</span><strong>{dashboard?.totalRequests ?? 0}</strong></div>
            <div><span>Success</span><strong>{dashboard?.successCount ?? 0}</strong></div>
            <div><span>Failed</span><strong>{dashboard?.failedCount ?? 0}</strong></div>
          </div>
          <div className="pill-row">
            {(dashboard?.providerErrors ?? []).map((item) => (
              <span key={item.provider} className="pill">
                {item.provider}: {item.count}
              </span>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>Global Strategy</h2>
          <label>
            Fetch / Map Mode
            <select
              value={system.fetchMode}
              onChange={(event) =>
                setSystem((current) => ({ ...current, fetchMode: event.target.value as SystemSettings["fetchMode"] }))
              }
            >
              <option value="auto_ordered">auto_ordered</option>
              <option value="strict_tavily">strict_tavily</option>
              <option value="strict_firecrawl">strict_firecrawl</option>
            </select>
          </label>
          <label>
            Default Grok Model
            <input
              value={system.defaultGrokModel}
              onChange={(event) =>
                setSystem((current) => ({ ...current, defaultGrokModel: event.target.value }))
              }
            />
          </label>
          <label>
            First Provider
            <select
              value={system.providerPriority[0]}
              onChange={(event) => {
                const first = event.target.value as "tavily" | "firecrawl";
                const second = first === "tavily" ? "firecrawl" : "tavily";
                setSystem((current) => ({
                  ...current,
                  providerPriority: [first, second],
                }));
              }}
            >
              <option value="tavily">tavily</option>
              <option value="firecrawl">firecrawl</option>
            </select>
          </label>
          <label>
            Second Provider
            <input value={system.providerPriority[1]} readOnly />
          </label>
          <label>
            Log Retention Days
            <input
              type="number"
              value={system.logRetentionDays}
              onChange={(event) =>
                setSystem((current) => ({
                  ...current,
                  logRetentionDays: Number(event.target.value || 7),
                }))
              }
            />
          </label>
          <label>
            Allowed Origins
            <input
              value={system.allowedOrigins.join(",")}
              onChange={(event) =>
                setSystem((current) => ({
                  ...current,
                  allowedOrigins: event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                }))
              }
            />
          </label>
          <button onClick={() => void saveSystem()}>Save Strategy</button>
        </article>
      </section>

      <section className="grid three">
        {providers.map((provider) => {
          const draft = providerDrafts[provider.provider];
          if (!draft) {
            return null;
          }
          return (
            <article key={provider.provider} className="card">
              <h2>{provider.provider}</h2>
              <p className="muted">
                {provider.provider === "grok"
                  ? provider.hasApiKey
                    ? "Grok API key stored"
                    : "Grok API key missing"
                  : `Key pool count: ${provider.keyCount}`}
              </p>
              {provider.provider !== "grok" && provider.enabled && provider.keyCount === 0 ? (
                <p className="warning">Enabled but no provider keys are loaded.</p>
              ) : null}
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) =>
                    setProviderDrafts((current) => ({
                      ...current,
                      [provider.provider]: {
                        ...current[provider.provider],
                        enabled: event.target.checked,
                      },
                    }))
                  }
                />
                Enabled
              </label>
              <label>
                Base URL
                <input
                  value={draft.baseUrl}
                  onChange={(event) =>
                    setProviderDrafts((current) => ({
                      ...current,
                      [provider.provider]: {
                        ...current[provider.provider],
                        baseUrl: event.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label>
                Timeout (ms)
                <input
                  type="number"
                  value={draft.timeoutMs}
                  onChange={(event) =>
                    setProviderDrafts((current) => ({
                      ...current,
                      [provider.provider]: {
                        ...current[provider.provider],
                        timeoutMs: Number(event.target.value || 30000),
                      },
                    }))
                  }
                />
              </label>
              {provider.provider === "grok" ? (
                <label>
                  API Key
                  <input
                    type="password"
                    placeholder={provider.hasApiKey ? "Stored. Fill only to replace." : "Enter API key"}
                    value={draft.apiKey}
                    onChange={(event) =>
                      setProviderDrafts((current) => ({
                        ...current,
                        [provider.provider]: {
                          ...current[provider.provider],
                          apiKey: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              ) : null}
              <button onClick={() => void saveProvider(provider.provider)}>Save Provider</button>
            </article>
          );
        })}
      </section>

      <section className="grid two">
        <article className="card">
          <h2>Key Pool</h2>
          <p className="muted">
            当前 {selectedProvider} 已加载 {selectedKeys.length} 个 key。
          </p>
          <label>
            Provider
            <select
              value={selectedProvider}
              onChange={(event) => setSelectedProvider(event.target.value as "tavily" | "firecrawl")}
            >
              <option value="tavily">tavily</option>
              <option value="firecrawl">firecrawl</option>
            </select>
          </label>
          <label>
            Tags
            <input value={tags} onChange={(event) => setTags(event.target.value)} />
          </label>
          <label>
            Paste keys
            <textarea
              rows={8}
              value={rawKeys}
              onChange={(event) => setRawKeys(event.target.value)}
              placeholder="One API key per line"
            />
          </label>
          <div className="row">
            <button onClick={() => void importTextKeys()}>Import Text</button>
            <button className="ghost" onClick={() => void bulkToggle(true)}>
              Enable All
            </button>
            <button className="ghost" onClick={() => void bulkToggle(false)}>
              Disable All
            </button>
          </div>
          <a className="link" href={`/api/admin/keys/export.csv?provider=${selectedProvider}`}>
            Export CSV
          </a>
        </article>

        <article className="card">
          <h2>{selectedProvider} Keys</h2>
          {selectedKeys.length === 0 ? (
            <p className="warning">No keys saved for this provider.</p>
          ) : null}
          <div className="table">
            <div className="table-head">
              <span>Fingerprint</span>
              <span>Status</span>
              <span>Tags</span>
              <span>Last Error</span>
            </div>
            {selectedKeys.map((item) => (
                <div className="table-row" key={item.id}>
                  <span>{item.fingerprint}</span>
                  <span>{item.enabled ? "enabled" : "disabled"}</span>
                  <span>{item.tags.join(", ") || "-"}</span>
                  <span>
                    {item.lastError || "-"}
                    <button className="ghost inline-button" onClick={() => void deleteKey(item.id)}>
                      Delete
                    </button>
                  </span>
                </div>
              ))}
          </div>
        </article>
      </section>

      <section className="card">
        <h2>Recent Logs</h2>
        <div className="table">
          <div className="table-head">
            <span>Tool</span>
            <span>Status</span>
            <span>Provider</span>
            <span>Duration</span>
            <span>Error</span>
          </div>
          {logs.map((item, index) => (
            <div className="table-row" key={String(item.id ?? index)}>
              <span>{String(item.toolName ?? item.tool_name ?? "-")}</span>
              <span>{String(item.status ?? "-")}</span>
              <span>{String(item.finalProvider ?? item.final_provider ?? "-")}</span>
              <span>{String(item.durationMs ?? item.duration_ms ?? "-")} ms</span>
              <span>{String(item.errorSummary ?? item.error_summary ?? "-")}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Recent Attempt Logs</h2>
        <div className="table">
          <div className="table-head">
            <span>Provider</span>
            <span>Status</span>
            <span>Fingerprint</span>
            <span>Duration</span>
            <span>Error</span>
          </div>
          {attempts.map((item, index) => (
            <div className="table-row" key={String(item.id ?? index)}>
              <span>{String(item.provider ?? "-")}</span>
              <span>{String(item.status ?? "-")}</span>
              <span>{String(item.keyFingerprint ?? item.key_fingerprint ?? "-")}</span>
              <span>{String(item.durationMs ?? item.duration_ms ?? "-")} ms</span>
              <span>{String(item.errorSummary ?? item.error_summary ?? "-")}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
