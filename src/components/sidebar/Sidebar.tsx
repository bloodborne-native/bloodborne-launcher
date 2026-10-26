import { useTranslation } from "react-i18next";
import { Moon } from "@/components/brand";
import { ActiveProfile } from "@/components/profiles";
import { NAV_TABS } from "@/components/sidebar/navTabs";
import { PlayButton } from "@/components/sidebar/PlayButton";
import { SidebarNavItem } from "@/components/sidebar/SidebarNavItem";
import { useConfig } from "@/hooks";
import { cn } from "@/lib";
import { useGameStore, useUiStore } from "@/stores";

export function Sidebar() {
  const { t } = useTranslation();
  const { tab, setTab } = useUiStore();
  const running = useGameStore((s) => s.running);
  const { data: config } = useConfig();
  return (
    <aside
      // Wide windows only (narrow ones: MobileHeader). macOS draws its window buttons over the top.
      className={cn("drag hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 px-3 pb-4 md:flex",
        config?.platform === "macos" ? "pt-11" : "pt-5")}
      data-tauri-drag-region
    >
      <div className="mb-7 flex items-center gap-3 px-2">
        <Moon className="size-9" />
        <div>
          <div className="font-display text-lg font-semibold leading-tight tracking-wider">{t("app.name")}</div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{t("app.tagline")}</div>
        </div>
      </div>
      <nav className="no-drag flex flex-col gap-0.5">
        {NAV_TABS.map((item) => (
          <SidebarNavItem
            key={item.id}
            label={t(`nav.${item.id}`)}
            icon={item.icon}
            active={tab === item.id}
            onClick={() => setTab(item.id)}
            badge={item.id === "log" && running ? <span className="block size-2 animate-pulse rounded-full bg-blood-400" /> : undefined}
          />
        ))}
      </nav>
      <div className="no-drag mt-auto">
        <ActiveProfile />
        <PlayButton />
        <div className="mt-3 text-center text-[11px] text-muted-foreground">{t("app.version", { version: config?.version ?? "" })}</div>
      </div>
    </aside>
  );
}
