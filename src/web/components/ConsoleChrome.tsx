import type { DashboardSummary, ProviderConfigRecord, SystemSettings } from "@shared/contracts";
import type { SessionState } from "../types";

type SidebarProps = {
  dashboard: DashboardSummary | null;
  providers: ProviderConfigRecord[];
  system: SystemSettings;
};

type HeaderProps = {
  session: SessionState;
  onRefresh: () => void;
  onLogout: () => void;
};

const SECTION_LINKS = [
  { href: "#overview", label: "Overview" },
  { href: "#providers", label: "Providers" },
  { href: "#keys", label: "Key Pools" },
  { href: "#activity", label: "Activity" },
];

export function ConsoleSidebar(props: SidebarProps) {
  const providerSummary = props.providers
    .map((item) => `${item.provider}:${item.keyCount}`)
    .join(" · ");

  return (
    <aside className="console-sidebar">
      <div className="sidebar-brand">
        <div className="eyebrow">BitSearch</div>
        <h1>Control Surface</h1>
        <p className="supporting">
          Premium MCP operations console with live provider routing and request observability.
        </p>
      </div>
      <nav className="sidebar-nav">
        {SECTION_LINKS.map((item) => (
          <a key={item.href} href={item.href} className="nav-link">
            {item.label}
          </a>
        ))}
      </nav>
      <section className="sidebar-panel">
        <div className="panel-label">Current Mode</div>
        <div className="panel-value">{props.system.fetchMode}</div>
        <div className="panel-label">Provider Order</div>
        <div className="panel-value mono">{props.system.providerPriority.join(" → ")}</div>
      </section>
      <section className="sidebar-panel">
        <div className="panel-label">Key Pools</div>
        <div className="panel-value mono">{providerSummary}</div>
        <div className="panel-label">Requests</div>
        <div className="panel-value">{props.dashboard?.totalRequests ?? 0}</div>
      </section>
    </aside>
  );
}

export function ShellHeader(props: HeaderProps) {
  return (
    <header className="hero-panel">
      <div>
        <div className="eyebrow">Operations Center</div>
        <h2>Unified Streamable HTTP MCP Console</h2>
        <p className="supporting">
          管理员 `{props.session.username}`，对外端点为 <code>/mcp</code>。
        </p>
      </div>
      <div className="action-row">
        <button className="secondary-button" onClick={props.onRefresh}>
          Refresh
        </button>
        <button className="secondary-button" onClick={props.onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}

export function StatusToast({ message }: { message: string }) {
  if (!message) {
    return null;
  }
  return <section className="status-toast">{message}</section>;
}
