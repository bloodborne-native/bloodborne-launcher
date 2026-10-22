import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { PageHeader, SettingsSection } from "@/components/settings";
import { TrophyGroup, TrophyStatus } from "@/components/trophies";
import { useUiStore } from "@/stores";
import { useSaves } from "@/hooks";
import { SaveProfileCard } from "@/pages/saves/SaveProfileCard";
import { CharacterPreview } from "@/pages/saves/CharacterPreview";

export function ProfileDetailsPage({ profileId }: { profileId: string }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const { data, error, refetch, isFetching, change, busy, running } = useSaves(profileId);
  const section = useUiStore((state) => state.profileSection);
  const openProfile = useUiStore((state) => state.openProfile);
  const setTab = useUiStore((state) => state.setTab);
  const disabled = running || busy || isFetching;
  const selected = data?.profiles[0];
  return (
    <>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => setTab("profiles")}>
        <ArrowLeft aria-hidden="true" /> {t("profiles.title")}
      </Button>
      <PageHeader title={selected?.name ?? t("profiles.title")} actions={
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => {
          void refetch();
          void client.invalidateQueries({ queryKey: ["characters", profileId] });
        }}>
          <RefreshCw className={isFetching ? "animate-spin" : undefined} /> {t("common.refresh")}
        </Button>
      } />
      {running && section === "saves" && <p className="mb-4 text-sm text-blood-400">{t("saves.stopFirst")}</p>}
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{String(error)}</p>}
      {selected && <Tabs value={section} onValueChange={(value) => openProfile(profileId, value === "trophies" ? "trophies" : "saves")}>
        <TabsList className="mb-4">
          <TabsTrigger value="saves">{t("saves.title")} · {t("saves.backups")}</TabsTrigger>
          <TabsTrigger value="trophies">{t("profiles.trophies")}</TabsTrigger>
        </TabsList>
        <TabsContent value="saves">
          <SaveProfileCard profile={selected} disabled={disabled} onChange={change} />
          <CharacterPreview profileId={profileId} running={running} />
        </TabsContent>
        <TabsContent value="trophies" className="space-y-5">
          <p className="text-sm text-muted-foreground">{t("trophies.local")}</p>
          <TrophyStatus profile={selected} />
          <SettingsSection><div className="px-5 py-4"><TrophyGroup group="base" unlocks={selected.trophy_unlocks} /></div></SettingsSection>
          <SettingsSection><div className="px-5 py-4"><TrophyGroup group="old_hunters" unlocks={selected.trophy_unlocks} /></div></SettingsSection>
          {selected.trophy_unlocks.some((u) => !u.group) && <SettingsSection><div className="px-5 py-4"><TrophyGroup group="other" unlocks={selected.trophy_unlocks.filter((u) => !u.group)} /></div></SettingsSection>}
        </TabsContent>
      </Tabs>}
    </>
  );
}
