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
  group: "Monitor" | "Configure";
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
    group: "Monitor",
  },
  {
    href: "/activity",
    icon: Activity,
    label: "Activity",
    title: "Request Trace",
    description: "Search request history and inspect full execution details.",
    group: "Monitor",
  },
  {
    href: "/providers",
    icon: Server,
    label: "Providers",
    title: "Integration Control",
    description: "Manage Search Engine, Tavily, and Firecrawl provider configuration.",
    group: "Configure",
  },
  {
    href: "/keys",
    icon: KeyRound,
    label: "Key Pools",
    title: "Key Operations",
    description: "Import, inspect, and batch-operate provider key inventory.",
    group: "Configure",
  },
];

const NAV_GROUPS: ReadonlyArray<NavItem["group"]> = ["Monitor", "Configure"];

function getActiveRoute(pathname: string): NavItem {
  return NAV_ITEMS.find((item) => pathname.startsWith(item.href)) ?? NAV_ITEMS[0];
}

function NavList(
  props: Readonly<{
    onNavigate: () => void;
  }>,
) {
  return (
    <div className="grid gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group} className="grid gap-1.5">
          <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {group}
          </div>
          {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              aria-label={`${item.title} — ${item.description}`}
              className={({ isActive }) =>
                `inline-flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-transparent text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                }`
              }
              onClick={props.onNavigate}
            >
              <item.icon size={16} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </div>
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
      <div className="min-h-screen bg-background text-foreground">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border/70 bg-card p-4 lg:block">
          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Search className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 grid gap-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">BitSearch</span>
              <strong className="truncate font-sans text-sm tracking-tight">Operations Console</strong>
            </div>
          </div>
          <nav className="mt-6" aria-label="Console navigation">
            <NavList onNavigate={() => setMobileOpen(false)} />
          </nav>
        </aside>

        <div className="relative min-w-0 lg:pl-64">
          <div className="console-atmosphere" aria-hidden="true" />
          <header className="console-enter sticky top-0 z-20 border-b border-border/70 bg-background">
            <div className="mx-auto grid w-full max-w-[1440px] gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{activeRoute.label}</div>
                  <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">{activeRoute.title}</h1>
                  <p className="mt-0.5 hidden max-w-2xl truncate text-sm text-muted-foreground sm:block">{activeRoute.description}</p>
                </div>
              </div>
              <div className="console-enter-2 flex items-center justify-end gap-1.5">
                <span className="hidden items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:inline-flex">
                  {props.isRefreshing ? (
                    <InlineSpinner label="Refreshing" />
                  ) : (
                    <>
                      <span className="live-dot size-2 rounded-full bg-emerald-400" aria-hidden="true" />
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
                    <div className="mt-4 px-4">
                      <NavList onNavigate={() => setMobileOpen(false)} />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </header>
          <main className="relative mx-auto w-full max-w-[1440px] overflow-x-hidden p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
