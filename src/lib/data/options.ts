// Choices of the settings pages; labels and hints are i18n keys.
import type { Option, TKey } from "@/lib/types";

export const UPSCALERS: Option<string>[] = [
  { value: "fsr3", label: "options.upscaler.fsr3", hint: "options.upscaler.fsr3Hint" },
  { value: "metalfx", label: "options.upscaler.metalfx", hint: "options.upscaler.metalfxHint" },
  { value: "fsr411", label: "options.upscaler.fsr411", hint: "options.upscaler.fsr411Hint" },
  { value: "off", label: "options.upscaler.off", hint: "options.upscaler.offHint" },
];

export const PRESETS: { value: number; label: TKey; scale: number }[] = [
  { value: 0, label: "options.preset.0", scale: 1.0 },
  { value: 1, label: "options.preset.1", scale: 1.5 },
  { value: 2, label: "options.preset.2", scale: 1.7 },
  { value: 3, label: "options.preset.3", scale: 2.0 },
  { value: 4, label: "options.preset.4", scale: 3.0 },
];

/** Output aspect ratios (bbport.ini aspect_ratio). The game's camera, HUD and UI follow the
 *  output's shape (the runtime's game hooks, from bbport 0.6). Auto: the game picks the group of
 *  the monitor it is on. */
export const ASPECT_RATIOS: Option<string>[] = [
  { value: "auto", label: "graphics.aspectAuto" },
  { value: "4:3", label: "4:3", literal: true },
  { value: "16:10", label: "16:10", literal: true },
  { value: "16:9", label: "16:9", literal: true },
  { value: "21:9", label: "21:9", literal: true },
  { value: "32:9", label: "32:9", literal: true },
];

/** Each aspect ratio's outputs, as the runtime's (bbport_settings.cpp Groups). Auto lists 16:9's;
 *  the game picks the monitor's group when it starts. */
const OUTPUTS: Record<string, [number, number][]> = {
  "4:3": [[640, 480], [800, 600], [1024, 768], [1280, 960], [1440, 1080], [1600, 1200], [2048, 1536], [2880, 2160]],
  "16:10": [[640, 400], [960, 600], [1280, 800], [1440, 900], [1680, 1050], [1920, 1200], [2560, 1600], [3840, 2400]],
  "16:9": [[640, 360], [854, 480], [960, 540], [1280, 720], [1600, 900], [1920, 1080], [2560, 1440], [3200, 1800], [3840, 2160]],
  "21:9": [[860, 360], [1280, 540], [1720, 720], [2560, 1080], [3440, 1440], [3840, 1600], [5120, 2160]],
  "32:9": [[1280, 360], [1920, 540], [2560, 720], [3840, 1080], [5120, 1440], [7680, 2160]],
};

/** iOS: the tallest output the iPhone's address space allows (bloodborne-ios's app_main.c). */
export const IOS_MAX_HEIGHT = 540;

/** This device's screen in pixels, landscape (wider than tall). */
export function screenPixels(): [number, number] {
  const ratio = window.devicePixelRatio || 1;
  const a = Math.round(window.screen.width * ratio), b = Math.round(window.screen.height * ratio);
  return a >= b ? [a, b] : [b, a];
}

/** The outputs of an aspect ratio. iOS: up to IOS_MAX_HEIGHT lines, and Auto at the screen's own
 *  ratio (2868 x 1320: 1174 x 540), as the app draws it. */
function outputSizes(aspect: string, ios: boolean): [number, number][] {
  if (!ios) return OUTPUTS[aspect] ?? OUTPUTS["16:9"];
  if (aspect === "auto") {
    const [w, h] = screenPixels();
    const ratio = h > 0 ? w / h : 16 / 9;
    return [360, IOS_MAX_HEIGHT].map((height) => [Math.round((height * ratio) / 2) * 2, height]);
  }
  return (OUTPUTS[aspect] ?? OUTPUTS["16:9"]).filter(([, h]) => h <= IOS_MAX_HEIGHT);
}

/** The output choices of an aspect ratio, with `current` added when it is another size. */
export function outputOptions(aspect: string, current: string, ios = false): Option<string>[] {
  const sizes = outputSizes(aspect, ios);
  const options: Option<string>[] = sizes.map(([w, h]) => ({ value: `${w}x${h}`, label: `${w} × ${h}`, literal: true as const }));
  if (!options.some((o) => o.value === current)) {
    const [w, h] = current.split("x");
    options.push({ value: current, label: `${w} × ${h}`, literal: true });
  }
  return options;
}

/** The output of `aspect` nearest `current` in height (another aspect ratio keeps the height). */
export function nearestOutput(aspect: string, current: string, ios = false): string {
  const height = Number(current.split("x")[1]) || 1080;
  const sizes = outputSizes(aspect, ios);
  const [w, h] = sizes.reduce((best, s) => (Math.abs(s[1] - height) < Math.abs(best[1] - height) ? s : best));
  return `${w}x${h}`;
}

/** The scene size an output and preset render at (scripts/patches.py: even sizes). */
export function renderSize(output: string, preset: number, upscaler: string): string {
  const [w, h] = output.split("x").map(Number);
  const scale = upscaler === "off" ? 1 : (PRESETS.find((p) => p.value === preset)?.scale ?? 1);
  const even = (v: number) => Math.max(2, Math.round(v / scale / 2) * 2);
  return `${even(w || 1920)} × ${even(h || 1080)}`;
}

/** bbport.ini effect switches; all on by default except SSR. All but SSR switch while the game
 *  runs (the runtime's game hooks); SSR applies at the next start. */
export const EFFECTS: { key: string; label: TKey; hint?: TKey; defaultOn: boolean }[] = [
  { key: "effect_chromatic_aberration", label: "options.effects.effect_chromatic_aberration", defaultOn: true },
  { key: "effect_dof", label: "options.effects.effect_dof", defaultOn: true },
  { key: "effect_motion_blur", label: "options.effects.effect_motion_blur", defaultOn: true },
  { key: "effect_ssao", label: "options.effects.effect_ssao", defaultOn: true },
  { key: "effect_game_aa", label: "options.effects.effect_game_aa", defaultOn: true },
  { key: "effect_dynamic_shadows", label: "options.effects.effect_dynamic_shadows", defaultOn: true },
  { key: "effect_ssr", label: "options.effects.effect_ssr", hint: "options.effects.effect_ssrHint", defaultOn: false },
  { key: "effect_bloom", label: "options.effects.effect_bloom", defaultOn: true },
];

/** The PS4 system language the game sees (BB_LANGUAGE, SCE language codes): names in their own
 *  language. Every one has its text in the game (dvdroot_ps4/msg). */
export const GAME_LANGUAGES: Option<string>[] = [
  { value: "1", label: "English (US)", literal: true },
  { value: "18", label: "English (UK)", literal: true },
  { value: "17", label: "Português (Brasil)", literal: true },
  { value: "7", label: "Português (Portugal)", literal: true },
  { value: "3", label: "Español (España)", literal: true },
  { value: "20", label: "Español (Latinoamérica)", literal: true },
  { value: "2", label: "Français", literal: true },
  { value: "4", label: "Deutsch", literal: true },
  { value: "5", label: "Italiano", literal: true },
  { value: "6", label: "Nederlands", literal: true },
  { value: "16", label: "Polski", literal: true },
  { value: "8", label: "Русский", literal: true },
  { value: "19", label: "Türkçe", literal: true },
  { value: "12", label: "Suomi", literal: true },
  { value: "13", label: "Svenska", literal: true },
  { value: "14", label: "Dansk", literal: true },
  { value: "15", label: "Norsk", literal: true },
  { value: "0", label: "日本語", literal: true },
  { value: "9", label: "한국어", literal: true },
  { value: "11", label: "简体中文", literal: true },
  { value: "10", label: "繁體中文", literal: true },
];

/** The on-screen pad (the launcher setting touch_controls, BB_TOUCH_CONTROLS). */
export const TOUCH_CONTROLS: Option<string>[] = [
  { value: "", label: "options.touch.auto" },
  { value: "1", label: "options.touch.on" },
  { value: "0", label: "options.touch.off" },
];

export const FPS_MODES: Option<string>[] = [
  { value: "uncap", label: "options.fps.uncap", hint: "options.fps.uncapHint" },
  { value: "60", label: "options.fps.60" },
  { value: "90", label: "options.fps.90" },
  { value: "30", label: "options.fps.30", hint: "options.fps.30Hint" },
];

export const FPS_SIZES: Option<string>[] = [
  { value: "small", label: "options.fpsSize.small" },
  { value: "big", label: "options.fpsSize.big" },
];

/** Where the in-game FPS counter is (bbport.ini fps_position). */
export const FPS_POSITIONS: Option<string>[] = [
  { value: "top_left", label: "options.fpsPosition.top_left" },
  { value: "top_center", label: "options.fpsPosition.top_center" },
  { value: "top_right", label: "options.fpsPosition.top_right" },
  { value: "bottom_left", label: "options.fpsPosition.bottom_left" },
  { value: "bottom_center", label: "options.fpsPosition.bottom_center" },
  { value: "bottom_right", label: "options.fpsPosition.bottom_right" },
];

export const MODEL_LOD: Option<string>[] = [
  { value: "-2", label: "options.lod.-2" },
  { value: "0", label: "options.lod.0" },
  { value: "1", label: "options.lod.1" },
  { value: "2", label: "options.lod.2" },
];

export const PRESENT_MODES: Option<string>[] = [
  { value: "Fifo", label: "options.present.Fifo" },
  { value: "FifoRelaxed", label: "options.present.FifoRelaxed" },
  { value: "Mailbox", label: "options.present.Mailbox" },
  { value: "Immediate", label: "options.present.Immediate" },
];

/** macOS: what draws the frame (the launcher setting `renderer`, BB_METAL_FRAME). */
export const RENDERERS: Option<string>[] = [
  { value: "moltenvk", label: "options.renderer.moltenvk", hint: "options.renderer.moltenvkHint" },
  { value: "metal", label: "options.renderer.metal", hint: "options.renderer.metalHint" },
];

export const DRAW_PIPE: Option<string>[] = [
  { value: "", label: "options.drawPipe.auto", hint: "options.drawPipe.autoHint" },
  { value: "1", label: "options.drawPipe.on" },
  { value: "0", label: "options.drawPipe.off", hint: "options.drawPipe.offHint" },
];

export const READBACKS: Option<string>[] = [
  { value: "", label: "options.readbacks.relaxed" },
  { value: "2", label: "options.readbacks.precise" },
  { value: "0", label: "options.readbacks.off" },
];

export const PREUPLOAD: Option<string>[] = [
  { value: "", label: "options.preupload.normal" },
  { value: "2", label: "options.preupload.full", hint: "options.preupload.fullHint" },
  { value: "0", label: "options.preupload.off" },
];

export const LIVE_RESOLUTION: Option<string>[] = [
  { value: "0", label: "options.live.0" },
  { value: "1", label: "options.live.1" },
  { value: "auto", label: "options.live.auto" },
];
