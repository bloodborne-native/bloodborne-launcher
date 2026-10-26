import { useTranslation } from "react-i18next";
import { Moon } from "@/components/brand";
import { NAV_TABS } from "@/components/sidebar";
import { cn } from "@/lib";
import { useGameStore, useUiStore } from "@/stores";

/** Narrow screens (phones, small windows): the name and the tabs in a strip that scrolls sideways. */
export function MobileHeader() {
  const { t } = useTranslation();
  const { tab, setTab } = useUiStore();
  const running = useGameStore((s) => s.running);
  return (
    <header className="sticky top-0 z-20 border-b border-sidebar-border bg-sidebar/95 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
      <div className="flex items-center gap-2.5 px-4 pt-3">
        <Moon className="size-7" />
        <div className="font-display text-base font-semibold tracking-wider">{t("app.name")}</div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{t("app.tagline")}</div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV_TABS.map((item) => (
          <button key={item.id} type="button" onClick={() => setTab(item.id)}
            aria-current={tab === item.id ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition [&_svg]:size-4",
              tab === item.id ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-blood-600/40 [&_svg]:text-blood-400"
                : "text-muted-foreground active:bg-white/5",
            )}>
            {item.icon}
            {t(`nav.${item.id}`)}
            {item.id === "log" && running && <span className="block size-2 animate-pulse rounded-full bg-blood-400" />}
          </button>
        ))}
      </nav>
    </header>
  );
}
