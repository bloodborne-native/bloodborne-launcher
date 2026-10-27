import { MobileBar, MobileHeader } from "@/components/mobile";
import { UpdateNotice } from "@/components/updates";
import { Sidebar } from "@/components/sidebar";
import { PageOutlet } from "@/components/window/PageOutlet";
import { TitleBar } from "@/components/window/TitleBar";
import { PageBackground } from "@/components/window/PageBackground";
import { useConfig } from "@/hooks";
import { useUiStore } from "@/stores";

/** The launcher window: sidebar with the tabs and Play, the chosen page on the right. Narrow
 *  screens (phones, small windows): the tabs in a strip at the top and Play in a bar at the bottom. */
export function AppWindow() {
  const { data: config } = useConfig();
  const tab = useUiStore((s) => s.tab);
  return (
    <div className="flex h-full flex-col md:flex-row">
      <Sidebar />
      <MobileHeader />
      {/* The page's area: its background stays put (an experiment: every page but Home) while the page scrolls. */}
      <div className="relative isolate flex min-h-0 flex-1 flex-col">
      {tab !== "home" && <PageBackground />}
      <main className="relative isolate flex flex-1 flex-col overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,rgba(201,162,101,0.05),transparent_55%)]">
        {config?.platform === "macos" ? <TitleBar /> : <div className="hidden h-6 shrink-0 md:block" />}
        <div className="mx-auto w-full max-w-4xl px-4 pb-28 pt-4 sm:px-6 md:px-10 md:pb-12 md:pt-0">
          <UpdateNotice />
          <PageOutlet />
        </div>
      </main>
      </div>
      <MobileBar />
    </div>
  );
}
