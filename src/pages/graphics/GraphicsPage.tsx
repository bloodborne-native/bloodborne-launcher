import { useTranslation } from "react-i18next";
import { NumberRow, PageHeader, SelectRow, SettingsSection, SliderRow, SwitchRow } from "@/components/settings";
import { useConfig, useFsr411Support, useIni, useSetting, useSettingsData } from "@/hooks";
import { ASPECT_RATIOS, EFFECTS, FPS_MODES, FPS_POSITIONS, FPS_SIZES, MODEL_LOD, PRESENT_MODES, PRESETS, UPSCALERS, nearestOutput, outputOptions, renderSize } from "@/lib/data";
import type { Option } from "@/lib";
import { DisplayPicker } from "@/pages/graphics/DisplayPicker";
import { Fsr411FilesRow } from "@/pages/graphics/Fsr411FilesRow";
import { MemoryEstimate } from "@/pages/graphics/MemoryEstimate";

export function GraphicsPage() {
  const { t } = useTranslation();
  const { settings, ini } = useSettingsData();
  const { data: config } = useConfig();
  const setIni = useIni();
  const setSetting = useSetting();
  const flag = (key: string, fallback: boolean) => (key in ini ? ini[key] === "1" : fallback);
  const upscaler = ini.upscaler ?? "fsr3";
  const output = ini.output_res ?? "1920x1080";
  const aspect = ini.aspect_ratio ?? "16:9";
  const preset = Number(ini.preset ?? 2);
  const fsrOff = upscaler === "off";
  // MetalFX and FSR 4.1.1 on Metal are macOS-only; FSR 4.1.1 is offered when this Mac can run it
  // (bb-gpu-capabilities --fsr411), or while it is the setting, so the choice stays visible.
  const macos = config?.platform === "macos";
  const fsr411 = useFsr411Support(macos);
  const fsr411Ready = fsr411.data?.supported ?? false;
  const fsr411NeedsFiles = !fsr411Ready && (fsr411.data?.reason.includes("initializers") ?? false);
  const upscalers = UPSCALERS.filter((o) =>
    o.value === "metalfx" ? macos : o.value === "fsr411" ? macos && (fsr411Ready || upscaler === "fsr411") : true,
  );
  const presets: Option<number>[] = PRESETS.map((p) => ({
    value: p.value,
    label: t("graphics.presetRender", { name: t(p.label), size: renderSize(output, p.value, upscaler) }),
    literal: true,
  }));
  return (
    <>
      <PageHeader title={t("graphics.title")} subtitle={t("graphics.subtitle")} />
      <SettingsSection title={t("graphics.display")}>
        <SelectRow
          title={t("graphics.aspectRatio")}
          description={t("graphics.aspectRatioHint")}
          value={aspect}
          options={ASPECT_RATIOS}
          onChange={(v) => {
            setIni("aspect_ratio", v);
            setIni("output_res", nearestOutput(v, output));
          }}
        />
        <SelectRow
          title={t("graphics.outputRes")}
          description={`${t("graphics.outputResHint")} ${t("common.restartNote")}`}
          value={output}
          options={outputOptions(aspect, output)}
          onChange={(v) => setIni("output_res", v)}
        />
        <MemoryEstimate />
        <DisplayPicker />
        <SwitchRow title={t("graphics.fullscreen")} checked={settings.fullscreen} onChange={(v) => setSetting("fullscreen", v)} />
        <SelectRow
          title={t("graphics.presentMode")}
          value={settings.present_mode}
          options={PRESENT_MODES}
          onChange={(v) => setSetting("present_mode", v)}
        />
      </SettingsSection>
      <SettingsSection title={t("graphics.frameRate")}>
        <SelectRow title={t("graphics.fpsMode")} value={settings.fps_mode} options={FPS_MODES} onChange={(v) => setSetting("fps_mode", v)} />
        <NumberRow title={t("graphics.fpsLimit")} description={t("graphics.fpsLimitHint")}
          value={settings.fps_limit ?? 0} min={0} max={480} onChange={(v) => setSetting("fps_limit", v)} />
        <SwitchRow title={t("graphics.showFps")} checked={ini.show_fps !== "0"} onChange={(v) => setIni("show_fps", v ? "1" : "0")} />
        <SelectRow title={t("graphics.fpsSize")} value={ini.fps_size ?? "small"} options={FPS_SIZES}
          onChange={(v) => setIni("fps_size", v)} disabled={ini.show_fps === "0"} />
        <SelectRow title={t("graphics.fpsPosition")} value={ini.fps_position ?? "top_center"} options={FPS_POSITIONS}
          onChange={(v) => setIni("fps_position", v)} disabled={ini.show_fps === "0"} />
        {config?.platform === "macos" && (
          <SwitchRow title={t("graphics.metalHud")} description={t("graphics.metalHudHint")}
            checked={settings.metal_hud ?? false} onChange={(v) => setSetting("metal_hud", v)} />
        )}
      </SettingsSection>
      <SettingsSection title={t("graphics.upscaling")} description={t("graphics.upscalingHint")}>
        <SelectRow title={t("graphics.upscaler")} value={upscaler} options={upscalers} onChange={(v) => setIni("upscaler", v)} />
        {macos && (fsr411Ready || fsr411NeedsFiles) && <Fsr411FilesRow ready={fsr411Ready} />}
        <SelectRow
          title={t("graphics.preset")}
          description={t("common.restartNote")}
          value={preset}
          options={presets}
          onChange={(v) => setIni("preset", String(v))}
          disabled={fsrOff}
        />
        <SwitchRow
          title={t("graphics.sharpen")}
          checked={ini.sharpen !== "0"}
          onChange={(v) => setIni("sharpen", v ? "1" : "0")}
          disabled={fsrOff}
        />
        <SliderRow
          title={t("graphics.sharpness")}
          value={Number(ini.sharpness ?? 0.5)}
          min={0}
          max={2}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(v) => setIni("sharpness", v.toFixed(2))}
          disabled={fsrOff || ini.sharpen === "0"}
        />
        <SwitchRow
          title={t("graphics.objectMotion")}
          description={t("graphics.objectMotionHint")}
          checked={ini.object_motion === "1"}
          onChange={(v) => setIni("object_motion", v ? "1" : "0")}
          disabled={fsrOff}
        />
      </SettingsSection>
      <SettingsSection title={t("graphics.detail")}>
        <SelectRow
          title={t("graphics.modelLod")}
          description={t("common.restartNote")}
          value={ini.model_lod ?? "0"}
          options={MODEL_LOD}
          onChange={(v) => setIni("model_lod", v)}
        />
      </SettingsSection>
      <SettingsSection title={t("graphics.effects")} description={t("graphics.effectsHint")}>
        {/* Effects switch while the game runs; SSR (with a hint) applies at the next start. */}
        {EFFECTS.map((effect) => (
          <SwitchRow key={effect.key} title={t(effect.label)}
            description={effect.hint && `${t(effect.hint)}. ${t("common.restartNote")}`}
            checked={flag(effect.key, effect.defaultOn)} onChange={(v) => setIni(effect.key, v ? "1" : "0")} />
        ))}
      </SettingsSection>
    </>
  );
}
