import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, queryKeys } from "@/lib";
import { i18n } from "@/i18n";

/** Whether FSR 4.1.1 on Metal can run on this Mac (macOS only: elsewhere it never can). */
export function useFsr411Support(enabled: boolean) {
  return useQuery({ queryKey: queryKeys.fsr411, queryFn: api.fsr411Support, enabled });
}

/** Takes AMD's two FSR 4.1.1 files from the player's own DLL into the data folder. */
export function useAddFsr411Files() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (dll: string) => api.addFsr411Files(dll),
    onSuccess: () => {
      toast.success(i18n.t("graphics.fsr411Added"));
      client.invalidateQueries({ queryKey: queryKeys.fsr411 });
    },
    onError: (error) => toast.error(i18n.t("graphics.fsr411Failed"), { description: String(error) }),
  });
}
