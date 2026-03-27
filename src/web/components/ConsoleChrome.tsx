import { useEffect, useState } from "react";
import type { DashboardSummary, ProviderConfigRecord, SystemSettings } from "@shared/contracts";
import { InlineSpinner } from "./Feedback";
import type { SessionState } from "../types";

type SidebarProps = {
  dashboard: DashboardSummary | null;
  isOpen: boolean;
  onClose: () => void;
  providers: ProviderConfigRecord[];
  system: SystemSettings;
};

type HeaderProps = {
  isRefreshing: boolean;
  onOpenNavigation: () => void;
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
  const [activeHash, setActiveHash] = useState(() => window.location.hash || "#overview");

  useEffect(() => {
    const handleHashChange = () => {
      setActiveHash(window.location.hash || "#overview");
      props.onClose();
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [props.onClose]);

  const providerSummary = props.providers
    .map((item) => `${item.provider}:${item.keyCount}`)
    .join(" · ");

  return (
    <>
      <button
        aria-label="Close navigation"
        className={`sidebar-backdrop ${props.isOpen ? "sidebar-backdrop-open" : ""}`}
        type="button"
        onClick={props.onClose}
      />
      <aside className={`console-sidebar ${props.isOpen ? "console-sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-mobile-row">
            <div>
              <div className="eyebrow">BitSearch</div>
              <h1>Control Surface</h1>
            </div>
            <button className="secondary-button sidebar-close-button" type="button" onClick={props.onClose}>
              Close
            </button>
          </div>
          <p className="supporting">
            Premium MCP operations console with live provider routing and request observability.
          </p>
        </div>
        <nav className="sidebar-nav">
          {SECTION_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`nav-link ${activeHash === item.href ? "active" : ""}`}
              onClick={props.onClose}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
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
        </div>
      </aside>
    </>
  );
}

export function ShellHeader(props: HeaderProps) {
  return (
    <header className="hero-panel">
      <div>
        <div className="eyebrow">Operations Center</div>
        <h2>Unified Streamable HTTP MCP Console</h2>
        <p className="supporting">
          使用后台授权密钥访问控制台，对外端点为 <code>/mcp</code>。
        </p>
      </div>
      <div className="action-row">
        <button className="secondary-button nav-toggle-button" type="button" onClick={props.onOpenNavigation}>
          Menu
        </button>
        <button className="secondary-button" type="button" onClick={props.onRefresh}>
          {props.isRefreshing ? <InlineSpinner label="Refreshing" /> : "Refresh"}
        </button>
        <button className="secondary-button" type="button" onClick={props.onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
