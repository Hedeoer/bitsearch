import { useEffect, useState } from "react";
import {
  Activity,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Server,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import type {
  DashboardSummary,
  ProviderConfigRecord,
  SystemSettings,
} from "@shared/contracts";
import { InlineSpinner } from "./Feedback";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    description: "Manage Search Engine, Tavily, and Firecrawl provider configuration.",
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

function PrimaryNav(
  props: Readonly<{
    className: string;
    linkClassName: string;
    onNavigate: () => void;
  }>,
) {
  return (
    <nav className={props.className} aria-label="Console navigation">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          className={({ isActive }) =>
            `${props.linkClassName}${isActive ? ` ${props.linkClassName}-active` : ""}`
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
  const isOverviewRoute = activeRoute.href === "/overview";

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <TooltipProvider delayDuration={200}>
    <div className="console-shell">
      <aside className="console-sidebar">
        <div className="console-brand">
          <div className="console-brand-mark">
            <Search size={16} />
          </div>
          <div className="console-brand-copy">
            <span className="eyebrow">BitSearch</span>
            <strong>Operations Console</strong>
          </div>
        </div>
        <PrimaryNav
          className="sidebar-nav"
          linkClassName="sidebar-nav-link"
          onNavigate={() => setMobileOpen(false)}
        />
      </aside>

      <div className="console-workspace">
        <header className="console-header">
          <div className="console-header-row">
            <div className="console-topbar-copy">
              <div className="console-topbar-mark" aria-hidden="true">
                <Search size={16} />
              </div>
              <div className="console-topbar-text">
                <div className="eyebrow">{activeRoute.label}</div>
                <h1>{activeRoute.title}</h1>
                <p className="supporting">{activeRoute.description}</p>
              </div>
            </div>
            <PrimaryNav
              className="top-nav"
              linkClassName="top-nav-link"
              onNavigate={() => setMobileOpen(false)}
            />
            <div className="console-topbar-actions">
              <span className="header-status">
                {props.isRefreshing ? (
                  <InlineSpinner label="Refreshing" />
                ) : (
                  <>
                    <span className="status-dot" aria-hidden="true" />
                    {isOverviewRoute ? "Live · 30s" : "Ready"}
                  </>
                )}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button aria-label="Refresh" disabled={props.isRefreshing} size="icon" type="button" variant="ghost" onClick={props.onRefresh}>
                    <RefreshCw className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
              <ThemeToggle />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button aria-label="Sign out" size="icon" type="button" variant="ghost" onClick={props.onLogout}>
                    <LogOut className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sign out</TooltipContent>
              </Tooltip>
              <Sheet onOpenChange={setMobileOpen} open={mobileOpen}>
                <Button aria-label="Open navigation" className="lg:hidden" size="icon" type="button" variant="ghost" onClick={() => setMobileOpen(true)}>
                  <Menu className="size-5" />
                </Button>
                <SheetContent className="border-border bg-card" side="left">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2 text-base normal-case tracking-normal">
                      <Search className="size-4" /> BitSearch
                    </SheetTitle>
                  </SheetHeader>
                  <PrimaryNav
                    className="flex flex-col gap-2 px-4"
                    linkClassName="mobile-nav-link"
                    onNavigate={() => setMobileOpen(false)}
                  />
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>
        <main className="console-main">
          <Outlet />
        </main>
      </div>
      </div>
    </TooltipProvider>
  );
}
