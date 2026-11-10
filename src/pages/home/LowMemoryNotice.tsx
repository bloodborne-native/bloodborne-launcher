import { useTranslation } from "react-i18next";
import { MemoryStick } from "lucide-react";
import { Alert, AlertDescription, Button } from "@/components/ui";
import { useConfig, useSettingsData } from "@/hooks";
import { LOW_MEMORY_SUGGESTED_MB } from "@/lib/data";
import { useUiStore } from "@/stores";

/** On a device with 16 GB or less: the low memory mode, while it is off, with a way to it. */
export function LowMemoryNotice() {
  const { t } = useTranslation();
  const { ini } = useSettingsData();
  const { data: config } = useConfig();
  const setTab = useUiStore((s) => s.setTab);
  const total = config?.memory_mb ?? 0;
  if (config?.platform !== "macos" || total <= 0 || total > LOW_MEMORY_SUGGESTED_MB || ini.low_memory === "1") {
    return null;
  }
  return (
    <Alert className="mb-5">
      <MemoryStick />
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{t("home.lowMemory", { gb: Math.round(total / 1024) })}</span>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => setTab("graphics")}>
          {t("home.lowMemoryButton")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
