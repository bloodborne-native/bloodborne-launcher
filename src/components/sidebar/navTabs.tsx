import type { ReactNode } from "react";
import { Users, Gamepad2, House, MonitorCog, Package, ScrollText, Settings2, Swords, Wrench, Globe2 } from "lucide-react";
import type { Tab } from "@/stores";

/** Online play is shown once the runtime's online module ships (bloodborne-mac ROADMAP, "Online"). */
export const ONLINE_READY = false;

/** The tabs, in order: the sidebar and the narrow-screen strip show the same ones. */
export const NAV_TABS: { id: Tab; icon: ReactNode }[] = ([
  { id: "home", icon: <House /> },
  { id: "graphics", icon: <MonitorCog /> },
  { id: "controls", icon: <Gamepad2 /> },
  { id: "game", icon: <Swords /> },
  { id: "online", icon: <Globe2 /> },
  { id: "profiles", icon: <Users /> },
  { id: "mods", icon: <Package /> },
  { id: "patches", icon: <Wrench /> },
  { id: "advanced", icon: <Settings2 /> },
  { id: "log", icon: <ScrollText /> },
] as { id: Tab; icon: ReactNode }[]).filter((tab) => ONLINE_READY || tab.id !== "online");
