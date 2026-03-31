import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  type AdminAccessInfo,
  type McpAccessInfo,
  type SystemSettings,
  type ToolSurfaceSnapshot,
} from "@shared/contracts";
import { apiRequest } from "./api";
import { AppShell } from "./AppShell";
import { LoginView } from "./LoginView";
import { ToastViewport } from "./components/Feedback";
import {
  EMPTY_ADMIN_ACCESS,
  EMPTY_MCP_ACCESS,
  EMPTY_SYSTEM,
  EMPTY_TOOL_SURFACE,
} from "./app-defaults";
import type { AppDataBundle, SessionState } from "./types";
import { dismissToast, enqueueToast, useToastStore } from "./toast-store";
import { useProviderWorkspaceState } from "./use-provider-workspace-state";

const AUTO_REFRESH_INTERVAL_MS = 30_000;

export function App() {
  const location = useLocation();
  const [session, setSession] = useState<SessionState | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [dashboard, setDashboard] = useState<AppDataBundle["dashboard"]>(null);
  const [providers, setProviders] = useState<AppDataBundle["providers"]>([]);
  const [system, setSystem] = useState<SystemSettings>(EMPTY_SYSTEM);
  const [toolSurface, setToolSurface] = useState<ToolSurfaceSnapshot>(EMPTY_TOOL_SURFACE);
  const [adminAccess, setAdminAccess] = useState<AdminAccessInfo>(EMPTY_ADMIN_ACCESS);
  const [mcpAccess, setMcpAccess] = useState<McpAccessInfo>(EMPTY_MCP_ACCESS);
  const [activity, setActivity] = useState<AppDataBundle["activity"]>(null);
  const [authKey, setAuthKey] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [workspaceRefreshNonce, setWorkspaceRefreshNonce] = useState(0);
  const refreshInFlightRef = useRef(false);
  const dashboardRefreshInFlightRef = useRef(false);
  const toasts = useToastStore();
  const providerWorkspace = useProviderWorkspaceState({
    onToast: enqueueToast,
    providers,
    setProviders,
    setSystem,
    setToolSurface,
    system,
  });

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
    if (refreshInFlightRef.current || dashboardRefreshInFlightRef.current) {
      return;
    }
    dashboardRefreshInFlightRef.current = true;
    try {
      const dashRes = await apiRequest<AppDataBundle["dashboard"]>("GET", "/admin/dashboard");
      if (dashRes.ok) {
        setDashboard(dashRes.data);
      }
    } finally {
      dashboardRefreshInFlightRef.current = false;
    }
  }

  async function refreshAll() {
    await withRefresh(async () => {
      const [dashRes, provRes, sysRes, toolSurfaceRes, adminRes, mcpRes] = await Promise.all([
        apiRequest<AppDataBundle["dashboard"]>("GET", "/admin/dashboard"),
        apiRequest<AppDataBundle["providers"]>("GET", "/admin/providers"),
        apiRequest<SystemSettings>("GET", "/admin/system"),
        apiRequest<ToolSurfaceSnapshot>("GET", "/admin/tool-surface"),
        apiRequest<AdminAccessInfo>("GET", "/admin/admin-access"),
        apiRequest<McpAccessInfo>("GET", "/admin/mcp-access"),
      ]);
      const nextSystem = sysRes.ok ? sysRes.data : system;
      if (dashRes.ok) setDashboard(dashRes.data);
      if (provRes.ok) {
        setProviders(provRes.data);
        providerWorkspace.syncSnapshot(provRes.data, nextSystem);
      }
      if (sysRes.ok) setSystem(sysRes.data);
      if (toolSurfaceRes.ok) setToolSurface(toolSurfaceRes.data);
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
    providerWorkspace.reset();
    setToolSurface(EMPTY_TOOL_SURFACE);
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

  const isConsoleBusy = isRefreshing || providerWorkspace.isSaving;

  return (
    <>
      <ToastViewport items={toasts} onDismiss={dismissToast} />
      <AppShell
        adminAccess={adminAccess}
        dashboard={dashboard}
        dirtyProviders={providerWorkspace.dirtyProviders}
        isConsoleBusy={isConsoleBusy}
        isRefreshing={isRefreshing}
        mcpAccess={mcpAccess}
        onDraftChange={providerWorkspace.updateDraft}
        onLogout={() => void logout()}
        onRefresh={() => void refreshAll()}
        onSaveAdminAccess={saveAdminAccess}
        onSaveAllProviderChanges={() => void providerWorkspace.saveAllChanges()}
        onSaveMcpAccess={saveMcpAccess}
        onSaveSystem={() => void saveSystem()}
        onToast={(type, message) => enqueueToast(type, message)}
        providerDrafts={providerWorkspace.drafts}
        providerSaveErrors={providerWorkspace.saveErrors}
        providers={providers}
        savingProviders={providerWorkspace.isSaving}
        setSystem={setSystem}
        system={system}
        toolSurface={toolSurface}
        workspaceRefreshNonce={workspaceRefreshNonce}
      />
    </>
  );
}
