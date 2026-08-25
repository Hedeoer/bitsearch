import { ChevronsUpDown, LogOut, Moon, RefreshCw, Sun } from "lucide-react";
import { BitSearchLogo } from "./BitSearchLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/web/hooks/use-theme";

type NavUserProps = Readonly<{
  isRefreshing: boolean;
  onLogout: () => void;
  onRefresh: () => void;
}>;

export function NavUser({ isRefreshing, onLogout, onRefresh }: NavUserProps) {
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Session and Settings"
          className="flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-2 text-left transition-colors outline-none cursor-pointer hover:bg-muted/50 hover:text-foreground data-[state=open]:bg-muted/60 data-[state=open]:text-foreground"
        >
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <BitSearchLogo className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-xs leading-tight min-w-0">
            <span className="truncate font-semibold text-foreground">BitSearch</span>
            <span className="truncate text-[11px] text-muted-foreground">Local Session</span>
          </div>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 min-w-56 rounded-xl border-border/80 p-1.5 shadow-lg"
        side="top"
        align="end"
        sideOffset={8}
      >
        <DropdownMenuLabel className="p-1 font-normal">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <BitSearchLogo className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-xs leading-tight min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-semibold text-foreground">BitSearch</span>
                <span className="size-1.5 rounded-full bg-emerald-500" />
              </div>
              <span className="truncate text-[11px] text-muted-foreground">Authorized Session</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="cursor-pointer gap-2 px-2.5 py-2 text-xs font-medium"
            disabled={isRefreshing}
            onClick={onRefresh}
          >
            <RefreshCw className={`size-4 text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh data</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2 px-2.5 py-2 text-xs font-medium"
            onClick={toggleTheme}
          >
            {theme === "dark" ? (
              <>
                <Sun className="size-4 text-muted-foreground" />
                <span>Light mode</span>
              </>
            ) : (
              <>
                <Moon className="size-4 text-muted-foreground" />
                <span>Dark mode</span>
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer gap-2 px-2.5 py-2 text-xs font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
          onClick={onLogout}
        >
          <LogOut className="size-4 text-destructive" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
