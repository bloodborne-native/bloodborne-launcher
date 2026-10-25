// The memory the game uses at its next start for these settings, as run.sh and the runtime size
// it. The game's memory: the PS4's 5056 MiB, plus 448 bytes per scene pixel above 1080p (run.sh),
// plus 1024 MiB the runtime adds. The renderer's: about 1000 MiB plus 360 MiB per million scene
// pixels (measured on an M3 Pro, 2026-10-20: 1465 MiB at 1506x848, 1655 at 1920x1080, 2051 at
// 2258x1270, 2200 at 2400x1350, about 2330 at 2560x1440; the output size made no difference).
// Keep in step with run.sh and the runtime's menu (gpu/shim/bbport_overlay.cpp MemoryEstimate).
import { PRESETS } from "@/lib/data/options";

const NATIVE = [1920, 1080] as const;

/** The scene the game renders (scripts/patches.py scaled_sizes), and whether it is patched. */
export function sceneSize(ini: Record<string, string>): { size: [number, number]; patched: boolean } {
  const [w, h] = (ini.output_res ?? "1920x1080").split("x").map(Number);
  const out: [number, number] = w > 0 && h > 0 ? [w, h] : [NATIVE[0], NATIVE[1]];
  const upscaler = ini.upscaler ?? "off";
  const live = ini.live_resolution === "1";
  if (upscaler === "taa" || live) return { size: out, patched: false };
  const scale = upscaler === "off" ? 1 : (PRESETS.find((p) => p.value === Number(ini.preset ?? 0))?.scale ?? 1);
  if (out[0] === NATIVE[0] && out[1] === NATIVE[1] && scale === 1) return { size: out, patched: false };
  const even = (v: number) => Math.max(2, Math.round(v / scale / 2) * 2);
  let size: [number, number] = [even(out[0]), even(out[1])];
  if (size[0] === NATIVE[0] && size[1] === NATIVE[1]) size = [1916, 1078];
  return { size, patched: true };
}

/** Estimated MiB: the game's memory and the renderer's. */
export function estimateMemoryMb(ini: Record<string, string>): number {
  const { size, patched } = sceneSize(ini);
  const pixels = size[0] * size[1];
  const extra = patched ? Math.max(0, (pixels - NATIVE[0] * NATIVE[1]) * 448) : 0;
  const game = 5056 + Math.ceil(extra / (64 << 20)) * 64 + 1024;
  const renderer = 1000 + (360 * pixels) / 1e6;
  return Math.round(game + renderer);
}

/** Above this share of the Mac's memory the game may slow down or lose its GPU device. */
export const MEMORY_WARNING_SHARE = 0.75;
