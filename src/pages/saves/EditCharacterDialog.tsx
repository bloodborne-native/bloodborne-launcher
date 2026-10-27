import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, queryKeys } from "@/lib";
import type { Character } from "@/lib";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui";
import { Message } from "@/components/common";

export function EditCharacterDialog({ profileId, character, disabled }: { profileId: string; character: Character; disabled: boolean }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [echoes, setEchoes] = useState(String(character.echoes));
  const [insight, setInsight] = useState(String(character.insight));
  const [attributes, setAttributes] = useState({ vitality: String(character.vitality), endurance: String(character.endurance),
    strength: String(character.strength), skill: String(character.skill),
    bloodtinge: String(character.bloodtinge), arcane: String(character.arcane) });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const fields = ["vitality", "endurance", "strength", "skill", "bloodtinge", "arcane"] as const;
  const level = fields.reduce((sum, field) => sum + Number(attributes[field]), 0) - 50;
  const valid = /^\d+$/.test(echoes) && /^\d+$/.test(insight)
    && Number(echoes) <= 999_999_999 && Number(insight) <= 99
    && fields.every((field) => /^\d+$/.test(attributes[field]) && Number(attributes[field]) >= 1 && Number(attributes[field]) <= 99)
    && (Number(attributes.vitality) === character.vitality || Number(attributes.vitality) >= 7)
    && (Number(attributes.endurance) === character.endurance || Number(attributes.endurance) >= 8)
    && level >= 4 && level <= 544
    && (Number(echoes) !== character.echoes || Number(insight) !== character.insight
      || fields.some((field) => Number(attributes[field]) !== character[field]));
  return <Dialog open={open} onOpenChange={(next, details) => {
    if (pending) { details.cancel(); return; }
    setOpen(next);
    if (next) {
      setEchoes(String(character.echoes)); setInsight(String(character.insight));
      setAttributes({ vitality: String(character.vitality), endurance: String(character.endurance),
        strength: String(character.strength), skill: String(character.skill),
        bloodtinge: String(character.bloodtinge), arcane: String(character.arcane) });
    }
    setError(undefined);
  }}>
    <DialogTrigger render={<Button variant="secondary" size="sm" disabled={disabled || !character.stats_consistent} />}>{t("saves.editCharacter")}</DialogTrigger>
    <DialogContent showCloseButton={!pending} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{t("saves.editCharacter")}: {character.name}</DialogTitle>
        <DialogDescription>{t("saves.editWarning")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">{t("saves.echoes")}
          <input className="w-full rounded-md border border-input bg-background px-3 py-2" type="number" min="0" max="999999999" step="1" value={echoes} disabled={pending} onChange={(event) => setEchoes(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">{t("saves.insight")}
          <input className="w-full rounded-md border border-input bg-background px-3 py-2" type="number" min="0" max="99" step="1" value={insight} disabled={pending} onChange={(event) => setInsight(event.target.value)} />
        </label>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-2"><p className="text-sm font-medium">{t("saves.attributes")}</p>
          <Button variant="outline" size="sm" disabled={pending} onClick={() => {
            setEchoes("999999999"); setInsight("99");
            setAttributes({ vitality: "99", endurance: "99", strength: "99", skill: "99", bloodtinge: "99", arcane: "99" });
          }}>{t("saves.maxAll")}</Button></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => <label key={field} className="grid gap-1 text-sm">{t(`saves.${field}`)}
            <input className="w-full rounded-md border border-input bg-background px-3 py-2" type="number" min={field === "vitality" ? "7" : field === "endurance" ? "8" : "1"} max="99" step="1"
              value={attributes[field]} disabled={pending} onChange={(event) => setAttributes((current) => ({ ...current, [field]: event.target.value }))} />
          </label>)}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("saves.resultingLevel", { level: Number.isFinite(level) ? level : "—" })}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("saves.derivedValuesHint")}</p>
      </div>
      {error && <Message tone="error">{error}</Message>}
      <DialogFooter>
        <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>{t("saves.cancel")}</Button>
        <Button disabled={disabled || pending || !valid} onClick={async () => {
          setPending(true); setError(undefined);
          try {
            await api.editCharacter(profileId, {
              title_id: character.title_id, slot: character.slot, fingerprint: character.fingerprint,
              echoes: Number(echoes), insight: Number(insight),
              vitality: Number(attributes.vitality), endurance: Number(attributes.endurance),
              strength: Number(attributes.strength), skill: Number(attributes.skill),
              bloodtinge: Number(attributes.bloodtinge), arcane: Number(attributes.arcane),
            });
            await Promise.all([
              client.invalidateQueries({ queryKey: ["characters", profileId] }),
              client.invalidateQueries({ queryKey: queryKeys.saves }),
              client.invalidateQueries({ queryKey: queryKeys.profiles }),
            ]);
            setOpen(false);
          } catch (failure) { setError(String(failure)); }
          finally { setPending(false); }
        }}>{t("saves.saveEditedCharacter")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
