import { useEffect, useState } from "react";
import type { SystemSettings } from "@shared/contracts";
import { apiRequest, clearStoredAuthKey, setStoredAuthKey } from "./api";
import { LoginView } from "./LoginView";
import { ConsoleHeader } from "./components/ConsoleChrome";
import { ToastViewport } from "./components/Feedback";
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
import { dismissToast, enqueueToast, useToastStore } from "./toast-store";

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
  const [loginMessage, setLoginMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [workspaceRefreshNonce, setWorkspaceRefreshNonce] = useState(0);
  const toasts = useToastStore();

  async function refreshAll() {
    setIsRefreshing(true);
    try {
      const [dashRes, provRes, sysRes, actRes] = await Promise.all([
        apiRequest<AppDataBundle["dashboard"]>("GET", "/admin/dashboard"),
        apiRequest<AppDataBundle["providers"]>("GET", "/admin/providers"),
        apiRequest<SystemSettings>("GET", "/admin/system"),
        apiRequest<AppDataBundle["activity"]>("GET", "/admin/activity"),
      ]);
      if (dashRes.ok) setDashboard(dashRes.data);
      if (provRes.ok) {
        setProviders(provRes.data);
        setProviderDrafts(createProviderDrafts(provRes.data));
      }
      if (sysRes.ok) setSystem(sysRes.data);
      if (actRes.ok) setActivity(actRes.data);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function checkSession() {
    const res = await apiRequest<SessionState>("GET", "/admin/session");
    if (res.ok && res.data.loggedIn) {
      setSession(res.data);
      void refreshAll();
    }
  }

  useEffect(() => {
    void checkSession();
  }, []);

  async function login() {
    setLoginMessage("");
    const res = await apiRequest<SessionState>("POST", "/admin/login", {
      authKey,
    });
    if (res.ok && res.data.loggedIn) {
      setStoredAuthKey(authKey);
      setSession(res.data);
      void refreshAll();
    } else {
      setLoginMessage(res.ok ? "登录失败，请检查授权密钥。" : "登录失败，请检查授权密钥。");
    }
  }

  async function logout() {
    await apiRequest("POST", "/admin/logout");
    clearStoredAuthKey();
    setSession(null);
    setDashboard(null);
    setProviders([]);
    setProviderDrafts({});
    setActivity([]);
  }

  async function saveSystem() {
    const res = await apiRequest("PUT", "/admin/system", system);
    if (res.ok) {
      enqueueToast("success", "System settings saved.");
      void refreshAll();
    } else {
      enqueueToast("error", res.message);
    }
  }

  async function saveProvider(provider: string) {
    const draft = providerDrafts[provider];
    if (!draft) return;
    const res = await apiRequest("PUT", `/admin/providers/${provider}`, draft);
    if (res.ok) {
      enqueueToast("success", `${provider} provider saved.`);
      void refreshAll();
    } else {
      enqueueToast("error", res.message);
    }
  }

  if (!session) {
    return (
      <LoginView
        authKey={authKey}
        message={loginMessage}
        onAuthKeyChange={setAuthKey}
        onLogin={() => void login()}
      />
    );
  }

  return (
    <div className="console-shell">
      <ConsoleHeader
        isRefreshing={isRefreshing}
        onOpenNavigation={() => {}}
        session={session}
        onRefresh={() => void refreshAll()}
        onLogout={() => void logout()}
      />
      <main className="console-main">
        <ToastViewport items={toasts} onDismiss={dismissToast} />

        <section id="overview" className="console-section">
          <div className="overview-grid">
            <div className="overview-grid-wide">
              <OverviewPanel dashboard={dashboard} loading={isRefreshing} />
            </div>
            <div className="overview-grid-wide">
              <StrategyPanel
                loading={isRefreshing}
                system={system}
                setSystem={setSystem}
                onSave={() => void saveSystem()}
              />
            </div>
          </div>
        </section>

        <section id="providers" className="console-section">
          <ProviderGrid
            providers={providers}
            loading={isRefreshing}
            drafts={providerDrafts}
            setDrafts={setProviderDrafts}
            onSave={(provider) => void saveProvider(provider)}
          />
        </section>

        <section id="keys" className="console-section">
          <KeyPoolsWorkspace
            onToast={(type, message) => enqueueToast(type, message)}
            refreshNonce={workspaceRefreshNonce}
          />
        </section>

        <section id="activity" className="console-section">
          <ActivityHub activity={activity} loading={isRefreshing} />
        </section>
      </main>
    </div>
  );
}
