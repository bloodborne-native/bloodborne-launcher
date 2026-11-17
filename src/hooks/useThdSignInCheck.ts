import { useQuery } from "@tanstack/react-query";
import { api, queryKeys } from "@/lib";

const FIVE_MINUTES = 5 * 60 * 1000;

/** What the server says of the saved Hunter's Dream sign-in. Asked while the Online page is shown and a
 *  token is saved; a failure never blocks the page (the backend answers "unchecked" for it). */
export function useThdSignInCheck(server: string, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.thdSignInCheck, server],
    queryFn: () => api.thdSignInCheck(server),
    enabled,
    staleTime: FIVE_MINUTES,
    retry: false,
  });
}
