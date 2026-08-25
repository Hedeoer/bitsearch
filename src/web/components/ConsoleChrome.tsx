import { useEffect, useState } from "react";
import {
  Activity,
  KeyRound,
  LayoutDashboard,
  Menu,
  Server,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { BitSearchLogo } from "./BitSearchLogo";
import { NavUser } from "./NavUser";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";

type ConsoleLayoutProps = Readonly<{
  isRefreshing: boolean;
  onLogout: () => void;
  onRefresh: () => void;
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
                `flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
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

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background text-foreground">
        <aside className="console-enter fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-border/70 bg-card p-4 lg:flex">
          <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-background px-3 py-2.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <BitSearchLogo className="size-4" />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-sm tracking-tight text-foreground">BitSearch</span>
            </div>
          </div>
          <nav className="mt-6 flex-1" aria-label="Console navigation">
            <NavList onNavigate={() => setMobileOpen(false)} />
          </nav>
          <div className="mt-auto pt-3 border-t border-border/70">
            <NavUser
              isRefreshing={props.isRefreshing}
              onLogout={props.onLogout}
              onRefresh={props.onRefresh}
            />
          </div>
        </aside>

        <div className="relative min-w-0 lg:pl-56">
          <div className="console-atmosphere" aria-hidden="true" />
          <header className="console-enter sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border/70 bg-background px-4 py-2.5 lg:hidden">
            <div className="flex items-center gap-2">
              <Sheet onOpenChange={setMobileOpen} open={mobileOpen}>
                <Button aria-label="Open navigation" size="icon" type="button" variant="ghost" onClick={() => setMobileOpen(true)}>
                  <Menu className="size-5" />
                </Button>
                <SheetContent className="border-border bg-card flex flex-col justify-between" side="left">
                  <div>
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2 text-base normal-case tracking-normal">
                        <BitSearchLogo className="size-4" /> BitSearch
                      </SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <NavList onNavigate={() => setMobileOpen(false)} />
                    </div>
                  </div>
                  <div className="pt-3 border-t border-border/70">
                    <NavUser
                      isRefreshing={props.isRefreshing}
                      onLogout={props.onLogout}
                      onRefresh={props.onRefresh}
                    />
                  </div>
                </SheetContent>
              </Sheet>
              <span className="font-semibold text-sm tracking-tight text-foreground">BitSearch</span>
            </div>
          </header>
          <main className="console-enter-2 relative mx-auto w-full max-w-[1440px] overflow-x-hidden p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
