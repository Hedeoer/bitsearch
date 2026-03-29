import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  SEARCH_ENGINE_PROVIDER,
  type AdminAccessInfo,
  type McpAccessInfo,
  type SearchEngineModelsResponse,
  type SystemSettings,
} from "@shared/contracts";
import { apiRequest, type ApiResult } from "./api";
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

const AUTO_REFRESH_INTERVAL_MS = 30_000;

const EMPTY_SYSTEM: SystemSettings = {
  fetchMode: "auto_ordered",
  providerPriority: ["tavily", "firecrawl"],
  defaultSearchModel: "grok-4-fast",
  logRetentionDays: 7,
  allowedOrigins: [],
};
const EMPTY_MCP_ACCESS: McpAccessInfo = {
  streamHttpUrl: "",
  authScheme: "Bearer",
  hasBearerToken: false,
  tokenPreview: null,
};
const EMPTY_ADMIN_ACCESS: AdminAccessInfo = {
  hasAuthKey: false,
  authKeyPreview: null,
};

function createProviderDrafts(
  providers: AppDataBundle["providers"],
  system: SystemSettings,
): ProviderDrafts {
  return Object.fromEntries(
    providers.map((item) => [
      item.provider,
      {
        enabled: item.enabled,
        baseUrl: item.baseUrl,
        timeoutMs: item.timeoutMs,
        apiKey: "",
        searchModel: item.provider === SEARCH_ENGINE_PROVIDER ? system.defaultSearchModel : "",
      },
    ]),
  );
}

export function App() {
  const location = useLocation();
  const [session, setSession] = useState<SessionState | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [dashboard, setDashboard] = useState<AppDataBundle["dashboard"]>(null);
  const [providers, setProviders] = useState<AppDataBundle["providers"]>([]);
  const [providerDrafts, setProviderDrafts] = useState<ProviderDrafts>({});
  const [system, setSystem] = useState<SystemSettings>(EMPTY_SYSTEM);
  const [adminAccess, setAdminAccess] = useState<AdminAccessInfo>(EMPTY_ADMIN_ACCESS);
  const [mcpAccess, setMcpAccess] = useState<McpAccessInfo>(EMPTY_MCP_ACCESS);
  const [activity, setActivity] = useState<AppDataBundle["activity"]>(null);
  const [authKey, setAuthKey] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [workspaceRefreshNonce, setWorkspaceRefreshNonce] = useState(0);
  const refreshInFlightRef = useRef(false);
  const toasts = useToastStore();

  async function withRefresh(task: () => Promise<void>) {
    if (refreshInFlightRef.current) {
      return;
    }
    refreshInFlightRef.current = true;
    setIsRefreshing(true);
    try {
      await task();
    } finally {
      refreshInFlightRef.current = false;
      setIsRefreshing(false);
    }
  }

  async function refreshDashboard() {
    await withRefresh(async () => {
      const dashRes = await apiRequest<AppDataBundle["dashboard"]>("GET", "/admin/dashboard");
      if (dashRes.ok) {
        setDashboard(dashRes.data);
      }
    });
  }

  async function refreshAll() {
    await withRefresh(async () => {
      const [dashRes, provRes, sysRes, adminRes, mcpRes] = await Promise.all([
        apiRequest<AppDataBundle["dashboard"]>("GET", "/admin/dashboard"),
        apiRequest<AppDataBundle["providers"]>("GET", "/admin/providers"),
        apiRequest<SystemSettings>("GET", "/admin/system"),
        apiRequest<AdminAccessInfo>("GET", "/admin/admin-access"),
        apiRequest<McpAccessInfo>("GET", "/admin/mcp-access"),
      ]);
      const nextSystem = sysRes.ok ? sysRes.data : system;
      if (dashRes.ok) setDashboard(dashRes.data);
      if (provRes.ok) {
        setProviders(provRes.data);
        setProviderDrafts(createProviderDrafts(provRes.data, nextSystem));
      }
      if (sysRes.ok) setSystem(sysRes.data);
      if (adminRes.ok) setAdminAccess(adminRes.data);
      if (mcpRes.ok) setMcpAccess(mcpRes.data);
      setWorkspaceRefreshNonce((current) => current + 1);
    });
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

  const refreshDashboardEvent = useEffectEvent(() => {
    void refreshDashboard();
  });

  useEffect(() => {
    if (!session || !location.pathname.startsWith("/overview")) {
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      refreshDashboardEvent();
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [location.pathname, refreshDashboardEvent, session]);

  async function login() {
    setLoginMessage("");
    setIsAuthenticating(true);
    try {
      const res = await apiRequest<SessionState>("POST", "/admin/login", {
        authKey,
      });
      if (res.ok && res.data.loggedIn) {
        setAuthKey("");
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
    setSession(null);
    setDashboard(null);
    setProviders([]);
    setProviderDrafts({});
    setAdminAccess(EMPTY_ADMIN_ACCESS);
    setMcpAccess(EMPTY_MCP_ACCESS);
    setActivity(null);
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
    const providerRes = await apiRequest("PUT", `/admin/providers/${provider}`, {
      enabled: draft.enabled,
      baseUrl: draft.baseUrl,
      timeoutMs: draft.timeoutMs,
      apiKey: draft.apiKey,
    });
    if (!providerRes.ok) {
      enqueueToast("error", providerRes.message);
      return;
    }
    if (provider !== SEARCH_ENGINE_PROVIDER) {
      enqueueToast("success", `${provider} provider saved.`);
      void refreshAll();
      return;
    }
    const systemRes = await apiRequest<SystemSettings>("PUT", "/admin/system", {
      ...system,
      defaultSearchModel: draft.searchModel,
    });
    if (!systemRes.ok) {
      enqueueToast("warning", "search_engine saved, but the default search model could not be updated.");
      enqueueToast("error", systemRes.message);
      return;
    }
    enqueueToast("success", "search_engine settings saved.");
    setSystem(systemRes.data);
    void refreshAll();
  }

  async function saveMcpAccess(bearerToken: string): Promise<boolean> {
    const res = await apiRequest<McpAccessInfo>("PUT", "/admin/mcp-access", {
      bearerToken,
    });
    if (!res.ok) {
      enqueueToast("error", res.message);
      return false;
    }
    setMcpAccess(res.data);
    enqueueToast("success", "MCP access key saved. New token is live.");
    return true;
  }

  async function saveAdminAccess(nextAuthKey: string): Promise<boolean> {
    const res = await apiRequest<AdminAccessInfo>("PUT", "/admin/admin-access", {
      authKey: nextAuthKey,
    });
    if (!res.ok) {
      enqueueToast("error", res.message);
      return false;
    }
    setAdminAccess(res.data);
    enqueueToast("success", "Admin authorization key saved. New key is live.");
    return true;
  }

  function probeSearchModels(): Promise<ApiResult<SearchEngineModelsResponse>> {
    return apiRequest<SearchEngineModelsResponse>(
      "GET",
      `/admin/providers/${SEARCH_ENGINE_PROVIDER}/models`,
    );
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
              adminAccess={adminAccess}
              onSaveAdminAccess={saveAdminAccess}
              mcpAccess={mcpAccess}
              onSaveMcpAccess={saveMcpAccess}
              onSaveSystem={() => void saveSystem()}
              onToast={(type, message) => enqueueToast(type, message)}
              setSystem={setSystem}
                system={system}
                providers={providers}
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
                onProbeSearchModels={probeSearchModels}
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
              <ActivityWorkspace />
            }
          />
          <Route path="*" element={<Navigate replace to="/overview" />} />
        </Route>
      </Routes>
    </>
  );
}
