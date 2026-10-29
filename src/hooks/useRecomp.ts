import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, queryKeys } from "@/lib";
import { i18n } from "@/i18n";
import { useRecompStore } from "@/stores";

/** The recompiled library's state: read again whenever the page opens, and every few seconds
 * while a build runs (the backend's status or a build started from this window). */
export function useRecompStatus() {
  const running = useRecompStore((s) => s.running);
  return useQuery({
    queryKey: queryKeys.recomp,
    queryFn: api.recompStatus,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: (query) => (running || query.state.data?.status.state === "building" ? 3000 : false),
  });
}

/** Feeds the recomp store with the build's progress, for the whole window (mounted once). */
export function useRecompConnection() {
  const update = useRecompStore((s) => s.update);
  const client = useQueryClient();
  useEffect(() => {
    let stop: (() => void) | undefined;
    let closed = false;
    void api.onRecompProgress((progress) => {
      update(progress);
      if (progress.step === "done" || progress.step === "error" || progress.step === "cancelled") {
        void client.invalidateQueries({ queryKey: queryKeys.recomp });
      }
    }).then((unlisten) => (closed ? unlisten() : (stop = unlisten)));
    return () => {
      closed = true;
      stop?.();
    };
  }, [update, client]);
}

/** Builds the library; resolves when the build ends. */
export function useRecompBuild() {
  const client = useQueryClient();
  const start = useRecompStore((s) => s.start);
  return useMutation({
    mutationFn: () => {
      start();
      // Settled here rather than in the mutation's callbacks, which do not run once the page is
      // left: a call refused before the build began sends no last event of its own.
      const build = api.recompBuild().finally(() => useRecompStore.getState().stop());
      // The status says "building" as soon as the backend has the job.
      setTimeout(() => void client.invalidateQueries({ queryKey: queryKeys.recomp }), 300);
      return build;
    },
    onSuccess: () => toast.success(i18n.t("recomp.built")),
    onError: (error) => String(error).includes("cancelled") ? undefined : toast.error(i18n.t("recomp.buildFailed"), { description: String(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.recomp }),
  });
}

export function useRecompCancel() {
  return useMutation({ mutationFn: api.recompCancel });
}

export function useRecompDelete() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.recompDelete,
    onError: (error) => toast.error(i18n.t("recomp.deleteFailed"), { description: String(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.recomp }),
  });
}
