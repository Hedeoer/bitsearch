import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import type { SystemSettings } from "@shared/contracts";
import { apiRequest, clearStoredAuthKey, setStoredAuthKey } from "./api";
import { LoginView } from "./LoginView";
import { ConsoleLayout } from "./components/ConsoleChrome";
import { ToastViewport } from "./components/Feedback";
import { ActivityWorkspace } from "./pages/ActivityWorkspace";
import { KeysWorkspace } from "./pages/KeysWorkspace";
import { OverviewWorkspace } from "./pages/OverviewWorkspace";
import { ProvidersWorkspace } from "./pages/ProvidersWorkspace";
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
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
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
      setWorkspaceRefreshNonce((current) => current + 1);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function checkSession() {
    try {
      const res = await apiRequest<SessionState>("GET", "/admin/session");
      if (res.ok && res.data.loggedIn) {
        setSession(res.data);
        void refreshAll();
      } else {
        setSession(null);
      }
    } finally {
      setIsSessionReady(true);
    }
  }

  useEffect(() => {
    void checkSession();
  }, []);

  async function login() {
    setLoginMessage("");
    setIsAuthenticating(true);
    try {
      const res = await apiRequest<SessionState>("POST", "/admin/login", {
        authKey,
      });
      if (res.ok && res.data.loggedIn) {
        setStoredAuthKey(authKey);
        setSession(res.data);
        void refreshAll();
      } else {
        setLoginMessage("Login failed. Check the authorization key.");
      }
    } finally {
      setIsAuthenticating(false);
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
    setAuthKey("");
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
        pending={!isSessionReady || isAuthenticating}
      />
    );
  }

  return (
    <>
      <ToastViewport items={toasts} onDismiss={dismissToast} />
      <Routes>
        <Route
          element={
            <ConsoleLayout
              dashboard={dashboard}
              providers={providers}
              system={system}
              isRefreshing={isRefreshing}
              onRefresh={() => void refreshAll()}
              onLogout={() => void logout()}
            />
          }
        >
          <Route index element={<Navigate replace to="/overview" />} />
          <Route
            path="/overview"
            element={
              <OverviewWorkspace
                dashboard={dashboard}
                loading={isRefreshing}
                onSaveSystem={() => void saveSystem()}
                setSystem={setSystem}
                system={system}
              />
            }
          />
          <Route
            path="/providers"
            element={
              <ProvidersWorkspace
                drafts={providerDrafts}
                loading={isRefreshing}
                onSave={(provider) => void saveProvider(provider)}
                providers={providers}
                setDrafts={setProviderDrafts}
              />
            }
          />
          <Route
            path="/keys"
            element={
              <KeysWorkspace
                onToast={(type, message) => enqueueToast(type, message)}
                refreshNonce={workspaceRefreshNonce}
              />
            }
          />
          <Route
            path="/activity"
            element={
              <ActivityWorkspace
                activity={activity}
                loading={isRefreshing}
              />
            }
          />
          <Route path="*" element={<Navigate replace to="/overview" />} />
        </Route>
      </Routes>
    </>
  );
}
