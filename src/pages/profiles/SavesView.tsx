import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Message } from "@/components/common";
import { PageHeader } from "@/components/settings";
import { Button } from "@/components/ui";
import { useSaves } from "@/hooks";
import { CharacterPreview } from "@/pages/saves/CharacterPreview";
import { SaveProfileCard } from "@/pages/saves/SaveProfileCard";

/** A profile's save set, backups and save editor (the Saves tab shows the active one's). */
export function SavesView({ profileId }: { profileId: string }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const { data, error, refetch, isFetching, change, busy, running } = useSaves(profileId);
  const selected = data?.profiles[0];
  return (
    <>
      <PageHeader title={t("nav.saves")} subtitle={selected?.name} actions={
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => {
          void refetch();
          void client.invalidateQueries({ queryKey: ["characters", profileId] });
        }}>
          <RefreshCw className={isFetching ? "animate-spin" : undefined} /> {t("common.refresh")}
        </Button>
      } />
      {running && <Message tone="warning" className="mb-4">{t("saves.stopFirst")}</Message>}
      {error && <Message tone="error" className="mb-4">{String(error)}</Message>}
      {selected && <>
        <SaveProfileCard profile={selected} disabled={running || busy || isFetching} onChange={change} />
        <CharacterPreview profileId={profileId} running={running} />
      </>}
    </>
  );
}
