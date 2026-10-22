import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, queryKeys } from "@/lib";
import type { SaveChange } from "@/lib";
import { i18n } from "@/i18n";
import { useGameStore } from "@/stores";

/** Refetch on entering the tab and after gameplay; file operations are confirmed by the backend. */
export function useSaves(profileId: string) {
  const client = useQueryClient();
  const running = useGameStore((s) => s.running);
  const query = useQuery({ queryKey: [...queryKeys.saves, profileId, running], queryFn: () => api.listSaves(profileId), staleTime: 0 });
  const mutation = useMutation({
    mutationFn: (change: SaveChange) => api.changeSave(change),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["characters", profileId] }),
        client.invalidateQueries({ queryKey: queryKeys.saves }),
        client.invalidateQueries({ queryKey: queryKeys.config }),
        client.invalidateQueries({ queryKey: queryKeys.profiles }),
      ]);
    },
    onError: (error) => toast.error(i18n.t("common.saveFailed"), { description: String(error) }),
  });
  return { ...query, change: mutation.mutateAsync, busy: mutation.isPending, running };
}
