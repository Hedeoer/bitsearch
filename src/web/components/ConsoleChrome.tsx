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
    className?: string;
    onNavigate: () => void;
  }>,
) {
  return (
    <nav className={props.className ?? "flex items-center gap-1 overflow-x-auto rounded-2xl border border-border/70 bg-muted/30 p-1"} aria-label="Console navigation">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          className={({ isActive }) =>
            `inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"
            }`
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
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border/70 bg-card/80 p-4 backdrop-blur-xl lg:block">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Search className="size-4" aria-hidden="true" />
          </div>
          <div className="grid gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">BitSearch</span>
            <strong className="font-sans text-sm tracking-tight">Operations Console</strong>
          </div>
        </div>
        <PrimaryNav
          className="mt-6 grid gap-1"
          onNavigate={() => setMobileOpen(false)}
        />
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="mx-auto grid w-full max-w-[1760px] gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                <Search className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{activeRoute.label}</div>
                <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">{activeRoute.title}</h1>
                <p className="mt-0.5 hidden max-w-2xl truncate text-sm text-muted-foreground sm:block">{activeRoute.description}</p>
              </div>
            </div>
            <PrimaryNav
              className="hidden justify-self-center lg:flex"
              onNavigate={() => setMobileOpen(false)}
            />
            <div className="flex items-center justify-end gap-1.5">
              <span className="hidden items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:inline-flex">
                {props.isRefreshing ? (
                  <InlineSpinner label="Refreshing" />
                ) : (
                  <>
                    <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_color-mix(in_oklch,var(--success),transparent_88%)]" aria-hidden="true" />
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
                    onNavigate={() => setMobileOpen(false)}
                  />
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1760px] overflow-x-hidden p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
      </div>
    </TooltipProvider>
  );
}
