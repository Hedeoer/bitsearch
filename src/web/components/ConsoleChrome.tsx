import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import type {
  DashboardSummary,
  ProviderConfigRecord,
  SystemSettings,
} from "@shared/contracts";
import { formatNumber } from "../format";
import { InlineSpinner } from "./Feedback";

type ConsoleLayoutProps = Readonly<{
  dashboard: DashboardSummary | null;
  isRefreshing: boolean;
  onLogout: () => void;
  onRefresh: () => void;
  providers: ProviderConfigRecord[];
  system: SystemSettings;
}>;

type NavItem = Readonly<{
  description: string;
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  title: string;
}>;

const NAV_ITEMS: NavItem[] = [
  {
    href: "/overview",
    icon: LayoutDashboard,
    label: "Overview",
    title: "Service Pulse",
    description: "Global routing posture, request health, and operator summary.",
  },
  {
    href: "/providers",
    icon: Server,
    label: "Providers",
    title: "Integration Control",
    description: "Manage Grok, Tavily, and Firecrawl provider configuration.",
  },
  {
    href: "/keys",
    icon: KeyRound,
    label: "Key Pools",
    title: "Key Operations",
    description: "Import, inspect, and batch-operate provider key inventory.",
  },
  {
    href: "/activity",
    icon: Activity,
    label: "Activity",
    title: "Request Trace",
    description: "Search request history and inspect full execution details.",
  },
];

function getActiveRoute(pathname: string): NavItem {
  return NAV_ITEMS.find((item) => pathname.startsWith(item.href)) ?? NAV_ITEMS[0];
}

function summarizeProviders(providers: ProviderConfigRecord[]) {
  return providers.reduce(
    (summary, provider) => ({
      activeCount: summary.activeCount + (provider.enabled ? 1 : 0),
      keyCount: summary.keyCount + provider.keyCount,
    }),
    { activeCount: 0, keyCount: 0 },
  );
}

function StatusCluster(props: Readonly<{
  dashboard: DashboardSummary | null;
  providers: ProviderConfigRecord[];
  system: SystemSettings;
}>) {
  const providerSummary = useMemo(
    () => summarizeProviders(props.providers),
    [props.providers],
  );

  return (
    <section className="sidebar-status-card">
      <div className="section-heading compact">
        <div>
          <div className="eyebrow">Runtime</div>
          <h3>Control Plane</h3>
        </div>
        <span className="section-icon">
          <ShieldCheck size={14} />
        </span>
      </div>
      <div className="sidebar-stat-grid">
        <div className="sidebar-stat">
          <span>Requests</span>
          <strong>{formatNumber(props.dashboard?.totalRequests ?? 0)}</strong>
        </div>
        <div className="sidebar-stat">
          <span>Providers</span>
          <strong>{providerSummary.activeCount}</strong>
        </div>
        <div className="sidebar-stat">
          <span>Keys</span>
          <strong>{formatNumber(providerSummary.keyCount)}</strong>
        </div>
        <div className="sidebar-stat">
          <span>Mode</span>
          <strong>{props.system.fetchMode}</strong>
        </div>
      </div>
    </section>
  );
}

function SidebarNav(props: Readonly<{ onNavigate: () => void }>) {
  return (
    <nav className="sidebar-nav" aria-label="Console navigation">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          className={({ isActive }) =>
            `sidebar-nav-link${isActive ? " sidebar-nav-link-active" : ""}`
          }
          onClick={props.onNavigate}
        >
          <item.icon size={16} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function ConsoleLayout(props: ConsoleLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const activeRoute = getActiveRoute(location.pathname);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="console-shell">
      <button
        type="button"
        aria-label="Close navigation"
        className={`sidebar-backdrop${mobileOpen ? " sidebar-backdrop-open" : ""}`}
        onClick={() => setMobileOpen(false)}
      />
      <aside className={`console-sidebar${mobileOpen ? " console-sidebar-open" : ""}`}>
        <div className="console-brand">
          <div className="console-brand-mark">
            <Search size={16} />
          </div>
          <div className="console-brand-copy">
            <span className="eyebrow">BitSearch</span>
            <strong>Operations Console</strong>
          </div>
          <button
            type="button"
            className="sidebar-close-button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={16} />
          </button>
        </div>
        <SidebarNav onNavigate={() => setMobileOpen(false)} />
        <StatusCluster
          dashboard={props.dashboard}
          providers={props.providers}
          system={props.system}
        />
      </aside>

      <div className="console-workspace">
        <header className="console-topbar">
          <div className="console-topbar-copy">
            <button
              type="button"
              className="sidebar-mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </button>
            <div>
              <div className="eyebrow">{activeRoute.label}</div>
              <h1>{activeRoute.title}</h1>
              <p className="supporting">{activeRoute.description}</p>
            </div>
          </div>
          <div className="console-topbar-actions">
            <span className="header-status">
              {props.isRefreshing ? (
                <InlineSpinner label="Refreshing" />
              ) : (
                <>
                  <span className="status-dot" aria-hidden="true" />
                  Live
                </>
              )}
            </span>
            <button
              type="button"
              className="icon-button"
              title="Refresh"
              disabled={props.isRefreshing}
              onClick={props.onRefresh}
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              className="icon-button"
              title="Sign out"
              onClick={props.onLogout}
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>
        <main className="console-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
