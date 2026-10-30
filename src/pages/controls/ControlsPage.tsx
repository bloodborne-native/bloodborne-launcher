import { useTranslation } from "react-i18next";
import { Gamepad2, Keyboard, RotateCcw } from "lucide-react";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { PageHeader, SettingsSection } from "@/components/settings";
import { BindingList } from "@/pages/controls/BindingList";
import { GamepadPicker } from "@/pages/controls/GamepadPicker";
import { SelectRow } from "@/components/settings";
import { useConfig, useIni, useSetting, useSettingsData } from "@/hooks";
import { CONTROLS, TOUCH_CONTROLS } from "@/lib/data";

export function ControlsPage() {
  const { t } = useTranslation();
  const { ini, settings } = useSettingsData();
  const { data: config } = useConfig();
  const setIni = useIni();
  const setSetting = useSetting();
  // The on-screen pad: on touch devices (the iPhone; Android once it has the launcher).
  const touch = config?.platform === "ios" || config?.platform === "android";
  const resetAll = () => {
    for (const control of CONTROLS) {
      for (const kind of ["pad", "key"]) {
        if (`${kind}.${control.id}` in ini) setIni(`${kind}.${control.id}`, null);
      }
    }
  };
  return (
    <>
      <PageHeader
        title={t("controls.title")}
        subtitle={t("controls.subtitle")}
        actions={
          <Button variant="secondary" size="sm" onClick={resetAll}>
            <RotateCcw /> {t("controls.resetAll")}
          </Button>
        }
      />
      <SettingsSection>
        {touch && (
          <SelectRow
            title={t("controls.touchControls")}
            description={t("controls.touchControlsHint")}
            value={settings.touch_controls ?? ""}
            options={TOUCH_CONTROLS}
            onChange={(v) => setSetting("touch_controls", v)}
          />
        )}
        <GamepadPicker />
      </SettingsSection>
      {/* ?keys (browser preview, screenshots): the keyboard's tab first. */}
      <Tabs defaultValue={new URLSearchParams(window.location.search).has("keys") ? "key" : "pad"}>
        <TabsList className="mb-3">
          <TabsTrigger value="pad">
            <Gamepad2 /> {t("controls.gamepad")}
          </TabsTrigger>
          <TabsTrigger value="key">
            <Keyboard /> {t("controls.keyboard")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pad">
          <SettingsSection>
            <BindingList kind="pad" />
          </SettingsSection>
        </TabsContent>
        <TabsContent value="key">
          <SettingsSection>
            <BindingList kind="key" />
          </SettingsSection>
        </TabsContent>
      </Tabs>
    </>
  );
}
