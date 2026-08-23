import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/web/hooks/use-theme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <Button
      aria-label={theme === "dark" ? "切换到亮色主题" : "切换到暗色主题"}
      onClick={toggle}
      size="icon"
      variant="ghost"
      title={theme === "dark" ? "亮色主题" : "暗色主题"}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
