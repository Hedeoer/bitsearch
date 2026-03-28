import { useState } from "react";
import {
  LayoutDashboard,
  Server,
  KeyRound,
  Activity,
  RefreshCw,
  LogOut,
  Menu,
  X,
  Search,
} from "lucide-react";
import type { DashboardSummary, ProviderConfigRecord, SystemSettings } from "@shared/contracts";
import { InlineSpinner } from "./Feedback";
import type { SessionState } from "../types";

type HeaderProps = {
  isRefreshing: boolean;
  onOpenNavigation: () => void;
  session: SessionState;
  onRefresh: () => void;
  onLogout: () => void;
};

type SidebarProps = {
  dashboard: DashboardSummary | null;
  isOpen: boolean;
  onClose: () => void;
  providers: ProviderConfigRecord[];
  system: SystemSettings;
};

const NAV_ITEMS = [
  { href: "#overview", label: "Overview", icon: LayoutDashboard },
  { href: "#providers", label: "Providers", icon: Server },
  { href: "#keys", label: "Key Pools", icon: KeyRound },
  { href: "#activity", label: "Activity", icon: Activity },
];

function useActiveHash() {
  const [activeHash, setActiveHash] = useState(
    () => window.location.hash || "#overview"
  );

  // Update on hashchange
  if (typeof window !== "undefined") {
    window.onhashchange = () => setActiveHash(window.location.hash || "#overview");
  }

  return activeHash;
}

export function ConsoleHeader(props: HeaderProps) {
  const [navOpen, setNavOpen] = useState(false);
  const activeHash = useActiveHash();

  function handleNavClose() {
    setNavOpen(false);
  }

  return (
    <>
      <header className="console-header">
        {/* Brand */}
        <a href="#overview" className="header-brand">
          <span className="header-brand-icon">
            <Search size={16} />
          </span>
          <h1>BitSearch</h1>
        </a>

        {/* Desktop nav */}
        <nav className="header-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className={`nav-link${activeHash === href ? " active" : ""}`}
            >
              <Icon size={14} />
              {label}
            </a>
          ))}
        </nav>

        {/* Right actions */}
        <div className="header-actions">
          {props.isRefreshing ? (
            <span className="header-status">
              <InlineSpinner label="Refreshing" />
            </span>
          ) : (
            <span className="header-status">
              <span className="status-dot" aria-hidden="true" />
              Live
            </span>
          )}
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
          <button
            type="button"
            className="nav-toggle-button"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* Mobile drawer backdrop */}
      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="sidebar-backdrop sidebar-backdrop-open"
          onClick={handleNavClose}
        />
      )}

      {/* Mobile nav drawer */}
      <nav
        className={`mobile-nav-drawer${navOpen ? " mobile-nav-open" : ""}`}
        aria-label="Mobile navigation"
      >
        <div className="mobile-nav-header">
          <a href="#overview" className="header-brand" onClick={handleNavClose}>
            <span className="header-brand-icon">
              <Search size={14} />
            </span>
            <h1>BitSearch</h1>
          </a>
          <button
            type="button"
            className="sidebar-close-button"
            aria-label="Close navigation"
            onClick={handleNavClose}
          >
            <X size={16} />
          </button>
        </div>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            className={`mobile-nav-link${activeHash === href ? " active" : ""}`}
            onClick={handleNavClose}
          >
            <Icon size={16} />
            {label}
          </a>
        ))}
      </nav>
    </>
  );
}

// Legacy export alias kept for App.tsx compatibility
export function ConsoleSidebar(props: SidebarProps) {
  return null;
}
