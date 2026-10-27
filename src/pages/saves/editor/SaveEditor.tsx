import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, queryKeys } from "@/lib";
import type { Character } from "@/lib";
import { Button, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui";
import { CharacterSection } from "@/pages/saves/editor/CharacterSection";
import { GemRow } from "@/pages/saves/editor/GemRow";
import { ItemsSection } from "@/pages/saves/editor/ItemsSection";
import { WeaponsSection } from "@/pages/saves/editor/WeaponsSection";
import { useSaveEdits } from "@/pages/saves/editor/useSaveEdits";

const SECTIONS = ["character", "item", "weapon", "armor", "gems", "storage"] as const;
type Section = (typeof SECTIONS)[number];
const TITLES = { character: "inventory.characterTab", item: "inventory.item", weapon: "inventory.weapon", armor: "inventory.armor",
  gems: "inventory.gems", storage: "inventory.storage" } as const;

export type SaveEditorProps = { profileId: string; character: Character; disabled: boolean; onBusy: (busy: boolean) => void; onClose: () => void };

/** The editor window's content: sections on the side, the chosen one beside them, one save for all. */
export function SaveEditor({ profileId, character, disabled, onBusy, onClose }: SaveEditorProps) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [section, setSection] = useState<Section>("character");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const inventory = useQuery({
    queryKey: ["inventory", profileId, character.title_id, character.slot, character.fingerprint, i18n.language],
    queryFn: () => api.characterInventory(profileId, character.title_id, character.slot, i18n.language),
    staleTime: 0,
  });
  const edits = useSaveEdits(character, inventory.data);
  const entries = inventory.data?.entries ?? [];
  const gems = inventory.data?.upgrades ?? [];
  const named = entries.some((entry) => entry.name);
  const locked = disabled || pending;
  const save = async () => {
    setPending(true); onBusy(true); setError(undefined);
    try {
      await api.editSave(profileId, {
        character: edits.characterEdit,
        inventory: edits.changes.length && inventory.data ? { title_id: character.title_id, slot: character.slot, fingerprint: inventory.data.fingerprint, changes: edits.changes } : null,
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: ["inventory", profileId] }),
        client.invalidateQueries({ queryKey: ["characters", profileId] }),
        client.invalidateQueries({ queryKey: queryKeys.saves }),
        client.invalidateQueries({ queryKey: queryKeys.profiles }),
      ]);
      onClose();
    } catch (failure) { setError(String(failure)); }
    finally { setPending(false); onBusy(false); }
  };
  const body = () => {
    if (section === "character") return <CharacterSection character={character} edits={edits} disabled={locked} />;
    if (inventory.isPending) return <p className="text-sm text-muted-foreground">{t("inventory.reading")}</p>;
    if (inventory.error) return <p role="alert" className="text-sm text-destructive">{String(inventory.error)}</p>;
    const notice = !named && <p className="mb-3 text-xs text-muted-foreground">{t("inventory.noNames")}</p>;
    switch (section) {
      case "item": return <>{notice}<ItemsSection entries={entries.filter((e) => e.location === "inventory" && e.kind === "item")} edits={edits} addTo={named ? "inventory" : undefined} disabled={locked} /></>;
      case "weapon": return <>{notice}<WeaponsSection weapons={entries.filter((e) => e.kind === "weapon")} gems={gems} edits={edits} disabled={locked} /></>;
      case "armor": return <>{notice}<p className="mb-3 text-xs text-muted-foreground">{t("inventory.armorReadOnly")}</p>
        <ItemsSection entries={entries.filter((e) => e.location === "inventory" && e.kind === "armor")} edits={edits} disabled={locked} /></>;
      case "gems": return gems.length ? <div className="rounded-md border border-border">{gems.map((gem) => <GemRow key={gem.index} gem={gem}
        chosen={edits.effects[gem.index] ?? {}} disabled={locked}
        onChoose={(slot, effect) => edits.setEffects((all) => ({ ...all, [gem.index]: { ...all[gem.index], [slot]: effect } }))} />)}</div>
        : <p className="text-sm text-muted-foreground">{t("inventory.empty")}</p>;
      case "storage": return <>{notice}<ItemsSection entries={entries.filter((e) => e.location === "storage" && e.kind !== "upgrade")} edits={edits} addTo={named ? "storage" : undefined} disabled={locked} /></>;
    }
  };
  // Full screen on a phone (inside its safe areas), a large window from sm up.
  return <DialogContent showCloseButton={!pending} className="flex h-dvh max-h-dvh w-full max-w-none flex-col gap-0 rounded-none p-0 ring-0
    sm:h-[min(56rem,calc(100dvh-2rem))] sm:max-w-6xl sm:rounded-xl sm:ring-1
    [&>[data-slot=dialog-close]]:top-[calc(0.5rem+env(safe-area-inset-top))] sm:[&>[data-slot=dialog-close]]:top-2">
    <DialogHeader className="border-b border-border px-4 pt-[calc(1rem+env(safe-area-inset-top))] pr-12 pb-3 sm:px-5 sm:pt-4">
      <DialogTitle>{character.name}</DialogTitle>
      <DialogDescription className="text-xs">
        {t("saves.level", { level: edits.characterEdit ? edits.level : character.level })} · {t("saves.slot", { slot: character.slot + 1 })}
        {/* On a phone the warning waits for the first change, above the save button. */}
        <span className="hidden sm:inline"> · {t("saves.editWarning")}</span>
      </DialogDescription>
    </DialogHeader>
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <nav className="flex shrink-0 gap-1 overflow-x-auto [scrollbar-width:none] border-b border-border p-2 md:w-48 md:flex-col md:border-r md:border-b-0">
        {SECTIONS.map((name) => <button key={name} type="button" onClick={() => setSection(name)}
          className={`flex shrink-0 items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm ${section === name ? "bg-accent font-medium" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}>
          {t(TITLES[name])}
          {edits.counts[name] > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">{edits.counts[name]}</span>}
        </button>)}
      </nav>
      <div data-editor-body className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{body()}</div>
    </div>
    <DialogFooter className="m-0 flex-row flex-wrap items-center justify-end rounded-none border-t border-border px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:rounded-b-xl sm:px-5 sm:pb-3">
      {edits.total > 0 && !error && <p className="basis-full text-xs text-muted-foreground sm:hidden">{t("saves.editWarning")}</p>}
      {error ? <p role="alert" className="mr-auto min-w-0 basis-full break-words text-sm text-destructive sm:basis-auto">{error}</p>
        : <span className="mr-auto basis-full text-xs text-muted-foreground sm:basis-auto">{t("inventory.changes", { count: edits.total })}</span>}
      <Button variant="outline" disabled={pending} onClick={edits.total ? edits.reset : onClose}>{edits.total ? t("inventory.discard") : t("saves.cancel")}</Button>
      <Button disabled={locked || !edits.valid || !edits.total} onClick={save}>{t("saves.saveEditedCharacter")}</Button>
    </DialogFooter>
  </DialogContent>;
}
