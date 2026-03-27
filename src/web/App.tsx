import { useEffect, useState } from "react";
import type { SystemSettings } from "@shared/contracts";
import { apiRequest } from "./api";
import { LoginView } from "./LoginView";
import { ConsoleSidebar, ShellHeader, StatusToast } from "./components/ConsoleChrome";
import {
  OverviewPanel,
  ProviderGrid,
  StrategyPanel,
} from "./components/OverviewPanels";
import { SecurityPanel } from "./components/SecurityPanel";
import {
  KeyPoolPanel,
  KeyTablePanel,
} from "./components/KeyManagement";
import { ActivityHub } from "./components/ActivityHub";
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
  const [profile, setProfile] = useState<AppDataBundle["profile"]>(null);
  const [providers, setProviders] = useState<AppDataBundle["providers"]>([]);
  const [providerDrafts, setProviderDrafts] = useState<ProviderDrafts>({});
  const [keys, setKeys] = useState<AppDataBundle["keys"]>([]);
  const [system, setSystem] = useState<SystemSettings>(EMPTY_SYSTEM);
  const [activity, setActivity] = useState<AppDataBundle["activity"]>([]);
  const [selectedProvider, setSelectedProvider] = useState<"tavily" | "firecrawl">("tavily");
  const [rawKeys, setRawKeys] = useState("");
  const [tags, setTags] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

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
    setSession(data);
  }

  async function refreshAll() {
    const [profileData, dashboardData, providerData, keyData, systemData, activityData] =
      await Promise.all([
        apiRequest<AppDataBundle["profile"]>("/api/admin/profile"),
        apiRequest<AppDataBundle["dashboard"]>("/api/admin/dashboard"),
        apiRequest<AppDataBundle["providers"]>("/api/admin/providers"),
        apiRequest<AppDataBundle["keys"]>("/api/admin/keys"),
        apiRequest<SystemSettings>("/api/admin/system"),
        apiRequest<AppDataBundle["activity"]>("/api/admin/activity?limit=80"),
      ]);

    setProfile(profileData);
    setDashboard(dashboardData);
    setProviders(providerData);
    setProviderDrafts(createProviderDrafts(providerData));
    setKeys(keyData);
    setSystem(systemData);
    setActivity(activityData);
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
    const ids = keys
      .filter((item) => item.provider === selectedProvider)
      .map((item) => item.id);
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

  async function updatePassword() {
    if (nextPassword !== confirmPassword) {
      setMessage("新密码与确认密码不一致。");
      return;
    }
    try {
      await apiRequest("/api/admin/profile/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, nextPassword }),
      });
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      setMessage("Password updated.");
      await refreshAll();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("current_password_incorrect")) {
          setMessage("当前密码不正确。");
          return;
        }
        if (error.message.includes("password_too_short")) {
          setMessage("新密码至少需要 8 位。");
          return;
        }
      }
      setMessage("密码更新失败。");
    }
  }

  if (!session?.loggedIn) {
    return (
      <LoginView
        username={username}
        password={password}
        message={message}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onLogin={() => void login()}
      />
    );
  }

  const selectedKeys = keys.filter((item) => item.provider === selectedProvider);

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
          onLogout={() => void logout()}
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
        <section className="settings-grid">
          <SecurityPanel
            profile={profile}
            currentPassword={currentPassword}
            nextPassword={nextPassword}
            confirmPassword={confirmPassword}
            onCurrentPasswordChange={setCurrentPassword}
            onNextPasswordChange={setNextPassword}
            onConfirmPasswordChange={setConfirmPassword}
            onSubmit={() => void updatePassword()}
          />
        </section>
        <ProviderGrid
          providers={providers}
          drafts={providerDrafts}
          setDrafts={setProviderDrafts}
          onSave={(provider) => void saveProvider(provider)}
        />
        <section className="workspace-grid">
          <KeyPoolPanel
            selectedProvider={selectedProvider}
            setSelectedProvider={setSelectedProvider}
            rawKeys={rawKeys}
            setRawKeys={setRawKeys}
            tags={tags}
            setTags={setTags}
            selectedCount={selectedKeys.length}
            onImport={() => void importTextKeys()}
            onBulkToggle={(enabled) => void bulkToggle(enabled)}
          />
          <KeyTablePanel
            selectedProvider={selectedProvider}
            keys={selectedKeys}
            onDeleteKey={(id) => void deleteKey(id)}
          />
        </section>
        <ActivityHub activity={activity} />
      </div>
    </main>
  );
}
