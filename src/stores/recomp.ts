import { create } from "zustand";
import type { RecompProgress } from "@/lib/types";

type RecompState = {
  /** The last progress of the build running now (null: none since the launcher started). */
  progress: RecompProgress | null;
  /** When the running build started (for its elapsed time and estimate). */
  startedAt: number | null;
  /** When compiling started, and how many files were done then (a build resumed after a cancel). */
  compileFrom: { at: number; done: number } | null;
  /** A build started from this window and not yet done, failed or cancelled: the page shows it as
   * running when it comes back, whatever the cached status says (bloodborne-mac issue #9). */
  running: boolean;
  update: (progress: RecompProgress) => void;
  start: () => void;
  /** The build call ended without a last event of its own (refused before it started). */
  stop: () => void;
};

/** The recompiled library's build, kept here so its progress survives leaving the page. */
export const useRecompStore = create<RecompState>((set, get) => ({
  progress: null,
  startedAt: null,
  compileFrom: null,
  running: false,
  start: () => set({ progress: { step: "check" }, startedAt: Date.now(), compileFrom: null, running: true }),
  stop: () => set({ running: false }),
  update: (progress) => {
    const state = get();
    const compileFrom = progress.step === "compile" && !state.compileFrom ? { at: Date.now(), done: progress.done ?? 0 } : state.compileFrom;
    const ended = progress.step === "done" || progress.step === "error" || progress.step === "cancelled";
    set({ progress, compileFrom, startedAt: state.startedAt ?? Date.now(), running: !ended });
  },
}));
