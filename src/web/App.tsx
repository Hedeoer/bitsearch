import { useEffect, useState } from "react";
import type { SystemSettings } from "@shared/contracts";
import { apiRequest, clearStoredAuthKey, setStoredAuthKey } from "./api";
import { LoginView } from "./LoginView";
import { ConsoleSidebar, ShellHeader, StatusToast } from "./components/ConsoleChrome";
import {
  OverviewPanel,
  ProviderGrid,
  StrategyPanel,
} from "./components/OverviewPanels";
import { ActivityHub } from "./components/ActivityHub";
import { KeyPoolsWorkspace } from "./components/KeyPoolsWorkspace";
import type {
  AppDataBundle,
  ProviderDrafts,
  SessionState,
} from "./types";

const EMPTY_SYSTEM: SystemSettings = {
  fetchMode: "auto_ordered",
  providerPriority: ["tavily", "firecrawl"],
  defaultGrokModel: "grok-4-fast",
  logRetentionDays: 7,
  allowedOrigins: [],
};

function createProviderDrafts(
  providers: AppDataBundle["providers"],
): ProviderDrafts {
  return Object.fromEntries(
    providers.map((item) => [
      item.provider,
      {
        enabled: item.enabled,
        baseUrl: item.baseUrl,
        timeoutMs: item.timeoutMs,
        apiKey: "",
      },
    ]),
  );
}

export function App() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [dashboard, setDashboard] = useState<AppDataBundle["dashboard"]>(null);
  const [providers, setProviders] = useState<AppDataBundle["providers"]>([]);
  const [providerDrafts, setProviderDrafts] = useState<ProviderDrafts>({});
  const [system, setSystem] = useState<SystemSettings>(EMPTY_SYSTEM);
  const [activity, setActivity] = useState<AppDataBundle["activity"]>([]);
  const [authKey, setAuthKey] = useState("");
  const [message, setMessage] = useState("");
  const [workspaceRefreshNonce, setWorkspaceRefreshNonce] = useState(0);

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    if (session?.loggedIn) {
      void refreshAll();
    }
  }, [session?.loggedIn]);

  async function loadSession() {
    const data = await apiRequest<SessionState>("/api/admin/session");
    if (!data.loggedIn) {
      setAuthKey("");
    }
    setSession(data);
  }

  async function refreshAll() {
    try {
      const [dashboardData, providerData, systemData, activityData] =
      await Promise.all([
        apiRequest<AppDataBundle["dashboard"]>("/api/admin/dashboard"),
        apiRequest<AppDataBundle["providers"]>("/api/admin/providers"),
        apiRequest<SystemSettings>("/api/admin/system"),
        apiRequest<AppDataBundle["activity"]>("/api/admin/activity?limit=80"),
      ]);

      setDashboard(dashboardData);
      setProviders(providerData);
      setProviderDrafts(createProviderDrafts(providerData));
      setSystem(systemData);
      setActivity(activityData);
      setWorkspaceRefreshNonce((current) => current + 1);
    } catch (error) {
      if (error instanceof Error && error.message.includes("unauthorized")) {
        clearStoredAuthKey();
        setAuthKey("");
        setSession({ loggedIn: false });
        setMessage("后台授权已失效，请重新输入授权密钥。");
        return;
      }
      throw error;
    }
  }

  async function login() {
    try {
      await apiRequest("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ authKey }),
      });
      setStoredAuthKey(authKey);
      setAuthKey("");
      setMessage("");
      await loadSession();
    } catch {
      clearStoredAuthKey();
      setMessage("登录失败，请检查授权密钥。");
    }
  }

  function logout() {
    clearStoredAuthKey();
    setAuthKey("");
    setSession({ loggedIn: false });
  }

  async function saveProvider(provider: string) {
    await apiRequest(`/api/admin/providers/${provider}`, {
      method: "PUT",
      body: JSON.stringify(providerDrafts[provider]),
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

  if (!session?.loggedIn) {
    return (
      <LoginView
        authKey={authKey}
        message={message}
        onAuthKeyChange={setAuthKey}
        onLogin={() => void login()}
      />
    );
  }

  return (
    <main className="console-shell">
      <ConsoleSidebar
        dashboard={dashboard}
        providers={providers}
        system={system}
      />
      <div className="console-main">
        <ShellHeader
          session={session}
          onRefresh={() => void refreshAll()}
          onLogout={logout}
        />
        <StatusToast message={message} />
        <section className="overview-grid">
          <OverviewPanel dashboard={dashboard} />
          <StrategyPanel
            system={system}
            setSystem={setSystem}
            onSave={() => void saveSystem()}
          />
        </section>
        <ProviderGrid
          providers={providers}
          drafts={providerDrafts}
          setDrafts={setProviderDrafts}
          onSave={(provider) => void saveProvider(provider)}
        />
        <KeyPoolsWorkspace
          onMessage={setMessage}
          refreshNonce={workspaceRefreshNonce}
        />
        <ActivityHub activity={activity} />
      </div>
    </main>
  );
}
