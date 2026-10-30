import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SettingRow } from "@/components/settings";
import { Button } from "@/components/ui";
import { useConfig, useSettingsData } from "@/hooks";
import { api, queryKeys } from "@/lib";

type Waiting = { userCode: string; uri: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Signs in to The Hunter's Dream with the device-code flow: the player approves a code on the
 *  server's page (Discord), the backend polls, and the online ID and token land in the settings. */
export function ThdSignIn() {
  const { t } = useTranslation();
  const { settings } = useSettingsData();
  const { data: config } = useConfig();
  const client = useQueryClient();
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [busy, setBusy] = useState(false);
  // Each sign-in has a number; cancelling or leaving the page makes the running one stale.
  const run = useRef(0);
  useEffect(() => () => { run.current += 1; }, []);
  const signedIn = settings.thd_online_id !== "" && !!config?.thd_token_saved;
  const saveOnlineId = (thd_online_id: string) => api.saveSettings({ thd_online_id })
    .finally(() => client.invalidateQueries({ queryKey: queryKeys.config }));

  const signIn = async () => {
    const id = ++run.current;
    const stale = () => run.current !== id;
    setBusy(true);
    try {
      const start = await api.thdSignInStart(settings.thd_server);
      setWaiting({ userCode: start.user_code, uri: start.verification_uri });
      let interval = start.interval;
      const deadline = Date.now() + start.expires_in * 1000;
      while (!stale() && Date.now() < deadline) {
        await sleep(interval * 1000);
        if (stale()) return;
        const poll = await api.thdSignInPoll(settings.thd_server, start.device_code);
        if (poll.status === "slow_down") interval += 5;
        // "retry": the server could not be reached; the next interval asks again until the code expires.
        if (poll.status === "approved" && poll.online_id) {
          await saveOnlineId(poll.online_id);
          toast.success(t("online.signedInAs", { name: poll.online_id }));
          return;
        }
      }
      if (!stale()) toast.error(t("online.signInFailed"), { description: t("online.signInExpired") });
    } catch (error) {
      if (!stale()) toast.error(t("online.signInFailed"), { description: String(error) });
    } finally {
      if (!stale()) { setWaiting(null); setBusy(false); }
    }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      const forgotten = await api.thdSignOut(settings.thd_server).catch(() => false);
      await saveOnlineId("");
      if (!forgotten) toast.warning(t("online.signOutOffline"));
    } catch (error) {
      toast.error(t("common.saveFailed"), { description: String(error) });
    } finally {
      setBusy(false);
    }
  };

  if (waiting) {
    return <SettingRow title={t("online.signInCode")} description={t("online.signInCodeHint")}>
      <span className="select-all font-mono text-base font-semibold tracking-widest">{waiting.userCode}</span>
      <Button variant="secondary" onClick={() => { run.current += 1; setWaiting(null); setBusy(false); }}>{t("online.signInCancel")}</Button>
    </SettingRow>;
  }
  return signedIn
    ? <SettingRow title={t("online.signedInAs", { name: settings.thd_online_id })} description={t("online.signedInHint")}>
        <Button variant="secondary" disabled={busy} onClick={() => void signOut()}>{t("online.signOut")}</Button>
      </SettingRow>
    : <SettingRow title={t("online.signedOut")} description={t("online.signedOutHint")}>
        <Button disabled={busy} onClick={() => void signIn()}>{t("online.signIn")}</Button>
      </SettingRow>;
}
