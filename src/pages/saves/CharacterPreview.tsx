import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib";
import { SettingsSection } from "@/components/settings";
import { Message } from "@/components/common";
import { EditCharacterButton } from "@/pages/saves/editor";

export function CharacterPreview({ profileId, running }: { profileId: string; running: boolean }) {
  const { t, i18n } = useTranslation();
  const { data, error, isPending } = useQuery({
    queryKey: ["characters", profileId, running],
    queryFn: () => api.listCharacters(profileId),
    enabled: !running,
    staleTime: 0,
  });
  const number = (value: number) => value.toLocaleString(i18n.language);
  return <SettingsSection>
    {running ? <p className="px-5 py-4 text-sm text-muted-foreground">{t("saves.stopFirst")}</p>
      : error ? <Message tone="error" className="px-5 py-4">{String(error)}</Message>
      : isPending ? <p className="px-5 py-4 text-sm text-muted-foreground">{t("saves.readingCharacters")}</p>
      : !data?.length ? <p className="px-5 py-4 text-sm text-muted-foreground">{t("saves.noCharacters")}</p>
      : data.map((character) => <div key={`${character.title_id}:${character.slot}`} className="border-t border-border px-5 py-4 first:border-t-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-medium">{character.name}</h3>
          <span className="text-xs text-muted-foreground">{character.title_id} · {t("saves.slot", { slot: character.slot + 1 })}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("saves.level", { level: character.level })} · {t("saves.playtime", { hours: (character.playtime_ms / 3_600_000).toLocaleString(i18n.language, { maximumFractionDigits: 1 }) })} · {t("saves.newGameCycle", { cycle: character.new_game_cycle + 1 })}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1 text-sm sm:grid-cols-3">
          {(["vitality", "endurance", "strength", "skill", "bloodtinge", "arcane", "echoes", "insight"] as const).map((field) =>
            <div key={field} className="flex justify-between gap-2"><dt className="text-muted-foreground">{t(`saves.${field}`)}</dt><dd>{number(character[field])}</dd></div>)}
        </dl>
        {!character.stats_consistent && <Message tone="error" className="mt-3 text-xs">{t("saves.inconsistentStats")}</Message>}
        <div className="mt-4 flex flex-wrap gap-2">
          <EditCharacterButton character={character} disabled={running} />
        </div>
      </div>)}
  </SettingsSection>;
}
