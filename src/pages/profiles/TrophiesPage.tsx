import { useTranslation } from "react-i18next";
import { PageHeader, SettingsSection } from "@/components/settings";
import { TrophyGroup, TrophyStatus } from "@/components/trophies";
import { useProfiles } from "@/hooks";

/** The Trophies tab: the active profile's recorded trophies, by game. */
export function TrophiesPage() {
  const { t } = useTranslation();
  const { data } = useProfiles();
  const profile = data?.profiles.find((entry) => entry.id === data.active);
  if (!profile) return null;
  const other = profile.trophy_unlocks.filter((unlock) => !unlock.group);
  return (
    <>
      <PageHeader title={t("profiles.trophies")} subtitle={profile.name} />
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">{t("trophies.local")}</p>
        <TrophyStatus profile={profile} />
        <SettingsSection><div className="px-5 py-4"><TrophyGroup group="base" unlocks={profile.trophy_unlocks} /></div></SettingsSection>
        <SettingsSection><div className="px-5 py-4"><TrophyGroup group="old_hunters" unlocks={profile.trophy_unlocks} /></div></SettingsSection>
        {other.length > 0 && <SettingsSection><div className="px-5 py-4"><TrophyGroup group="other" unlocks={other} /></div></SettingsSection>}
      </div>
    </>
  );
}
