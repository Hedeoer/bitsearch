import { useEffect, useState } from "react";
import type { SystemSettings } from "@shared/contracts";
import { apiRequest, clearStoredAuthKey, setStoredAuthKey } from "./api";
import { getErrorMessage } from "./format";
import { LoginView } from "./LoginView";
import { ConsoleSidebar, ShellHeader } from "./components/ConsoleChrome";
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [workspaceRefreshNonce, setWorkspaceRefreshNonce] = useState(0);
  const toasts = useToastStore();

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    if (session?.loggedIn) {
      void refreshAll();
    }
  }, [session?.loggedIn]);

  async function loadSession() {
    try {
      const data = await apiRequest<SessionState>("/api/admin/session");
      if (!data.loggedIn) {
        setAuthKey("");
      }
      setSession(data);
    } catch (error) {
      setSession({ loggedIn: false });
      setLoginMessage(getErrorMessage(error, "无法检查当前授权状态。"));
    }
  }

  async function refreshAll() {
    setIsRefreshing(true);
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
      setLoginMessage("");
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes("unauthorized")) {
        clearStoredAuthKey();
        setAuthKey("");
      setSession({ loggedIn: false });
      setLoginMessage("后台授权已失效，请重新输入授权密钥。");
      return false;
    }
      enqueueToast("error", getErrorMessage(error, "刷新后台数据失败。"));
      return false;
    } finally {
      setIsRefreshing(false);
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
      setLoginMessage("");
      await loadSession();
    } catch {
      clearStoredAuthKey();
      setLoginMessage("登录失败，请检查授权密钥。");
    }
  }

  function logout() {
    clearStoredAuthKey();
    setAuthKey("");
    setSession({ loggedIn: false });
    setIsSidebarOpen(false);
  }

  async function saveProvider(provider: string) {
    try {
      await apiRequest(`/api/admin/providers/${provider}`, {
        method: "PUT",
        body: JSON.stringify(providerDrafts[provider]),
      });
      const refreshed = await refreshAll();
      if (refreshed) {
        enqueueToast("success", `Saved provider: ${provider}`);
      }
    } catch (error) {
      enqueueToast("error", getErrorMessage(error, `Failed to save provider: ${provider}`));
    }
  }

  async function saveSystem() {
    try {
      await apiRequest("/api/admin/system", {
        method: "PUT",
        body: JSON.stringify(system),
      });
      const refreshed = await refreshAll();
      if (refreshed) {
        enqueueToast("success", "Saved system settings");
      }
    } catch (error) {
      enqueueToast("error", getErrorMessage(error, "Failed to save system settings"));
    }
  }

  if (!session?.loggedIn) {
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
    <main className="console-shell">
      <ConsoleSidebar
        dashboard={dashboard}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        providers={providers}
        system={system}
      />
      <div className="console-main">
        <ShellHeader
          isRefreshing={isRefreshing}
          onOpenNavigation={() => setIsSidebarOpen(true)}
          session={session}
          onRefresh={() => void refreshAll()}
          onLogout={logout}
        />
        <ToastViewport items={toasts} onDismiss={dismissToast} />
        <section className="overview-grid">
          <OverviewPanel dashboard={dashboard} loading={isRefreshing} />
          <StrategyPanel
            loading={isRefreshing}
            system={system}
            setSystem={setSystem}
            onSave={() => void saveSystem()}
          />
        </section>
        <ProviderGrid
          providers={providers}
          loading={isRefreshing}
          drafts={providerDrafts}
          setDrafts={setProviderDrafts}
          onSave={(provider) => void saveProvider(provider)}
        />
        <KeyPoolsWorkspace
          onToast={(type, message) => enqueueToast(type, message)}
          refreshNonce={workspaceRefreshNonce}
        />
        <ActivityHub activity={activity} loading={isRefreshing} />
      </div>
    </main>
  );
}
