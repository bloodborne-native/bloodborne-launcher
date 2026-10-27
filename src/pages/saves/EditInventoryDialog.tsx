import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, queryKeys } from "@/lib";
import type { CatalogItem, Character, Gem, InventoryChange, InventoryEntry, InventoryLocation } from "@/lib";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui";
import { AddItemPanel } from "@/pages/saves/AddItemPanel";
import { GemRow } from "@/pages/saves/GemRow";
import { GemSlots } from "@/pages/saves/GemSlots";
import { ItemIcon } from "@/pages/saves/ItemIcon";
import { ItemStats } from "@/pages/saves/ItemStats";

type Filter = "item" | "weapon" | "armor" | "gems" | "storage";
const FILTERS: Filter[] = ["item", "weapon", "armor", "gems", "storage"];
const key = (entry: InventoryEntry) => `${entry.location}:${entry.index}`;

type Addition = { item: CatalogItem; location: InventoryLocation; amount: number };

/** The inventory and storage of one character: amounts of items, weapons' level, imprint and gems,
 * gem effects, and items to add. Names, icons and stats come from the player's game files. */
export function EditInventoryDialog({ profileId, character, disabled }: { profileId: string; character: Character; disabled: boolean }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("item");
  const [search, setSearch] = useState("");
  // Edited values by entry: amounts for items, level and imprint for weapons.
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [weapons, setWeapons] = useState<Record<string, { level: number; imprint: number }>>({});
  // Chosen gem effects by gem index, then effect slot.
  const [effects, setEffects] = useState<Record<number, Record<number, number>>>({});
  // Gems chosen for weapons' slots by entry, then slot (null: empty).
  const [gemSlots, setGemSlots] = useState<Record<string, Record<number, number | null>>>({});
  const [additions, setAdditions] = useState<Addition[]>([]);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const inventory = useQuery({
    queryKey: ["inventory", profileId, character.title_id, character.slot, character.fingerprint, i18n.language],
    queryFn: () => api.characterInventory(profileId, character.title_id, character.slot, i18n.language),
    enabled: open,
    staleTime: 0,
  });
  const entries = useMemo(() => inventory.data?.entries ?? [], [inventory.data]);
  const named = entries.some((entry) => entry.name);
  const shown = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(i18n.language);
    return entries.filter((entry) => entry.kind !== "upgrade")
      .filter((entry) => filter === "storage" ? entry.location === "storage" : entry.location === "inventory" && entry.kind === filter)
      .filter((entry) => !query || (entry.name ?? "").toLocaleLowerCase(i18n.language).includes(query));
  }, [entries, filter, search, i18n.language]);
  const held = useMemo(() => {
    const sets: Record<InventoryLocation, Set<number>> = { inventory: new Set(), storage: new Set() };
    for (const entry of entries) if (entry.kind === "item") sets[entry.location].add(entry.id);
    for (const addition of additions) sets[addition.location].add(addition.item.id);
    return sets;
  }, [entries, additions]);
  const edits: InventoryChange[] = entries.flatMap((entry): InventoryChange[] => {
    const amount = amounts[key(entry)];
    if (entry.kind === "item" && amount !== undefined && Number(amount) !== entry.amount) {
      return [{ type: "amount", location: entry.location, index: entry.index, amount: Number(amount) }];
    }
    const weapon = weapons[key(entry)];
    if (entry.kind === "weapon" && weapon && (weapon.level !== entry.level || weapon.imprint !== entry.imprint)) {
      return [{ type: "weapon", location: entry.location, index: entry.index, level: weapon.level, imprint: weapon.imprint }];
    }
    return [];
  });
  const gems = inventory.data?.upgrades ?? [];
  const effectChanges = gems.flatMap((gem) => gem.effects.flatMap((effect): InventoryChange[] => {
    const chosen = effects[gem.index]?.[effect.slot];
    return chosen !== undefined && chosen !== effect.id ? [{ type: "effect", upgrade: gem.index, slot: effect.slot, effect: chosen }] : [];
  }));
  // Each weapon slot's gem after the edit; gems taken out first, so a gem can move between slots.
  const slotted = entries.flatMap((entry) => entry.slots.map((slot) => ({ entry, slot,
    gem: slot.slot in (gemSlots[key(entry)] ?? {}) ? gemSlots[key(entry)][slot.slot] : slot.gem })));
  const moved = slotted.filter(({ slot, gem }) => gem !== slot.gem);
  const slotChanges: InventoryChange[] = [
    ...moved.flatMap(({ slot }): InventoryChange[] => slot.gem === null ? [] : [{ type: "unequip", upgrade: slot.gem }]),
    ...moved.flatMap(({ entry, slot, gem }): InventoryChange[] => gem === null ? []
      : [{ type: "equip", upgrade: gem, location: entry.location, index: entry.index, slot: slot.slot }]),
  ];
  const inSlots = new Set(slotted.map(({ gem }) => gem));
  const takenOut = new Set(moved.map(({ slot }) => slot.gem));
  const available = (gem: Gem) => !inSlots.has(gem.index) && (gem.location === "inventory" || takenOut.has(gem.index));
  const changes: InventoryChange[] = [...edits, ...slotChanges, ...effectChanges, ...additions.map(({ item, location, amount }): InventoryChange =>
    ({ type: "add", location, id: item.id, amount }))];
  const valid = entries.every((entry) => {
    const value = amounts[key(entry)];
    return value === undefined || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= (entry.max || 999));
  });
  const reset = () => { setAmounts({}); setWeapons({}); setEffects({}); setGemSlots({}); setAdditions([]); setAdding(false); setSearch(""); setError(undefined); };
  const label = (entry: InventoryEntry) => entry.name ?? t("inventory.unnamed", { id: entry.id });
  // A weapon's numbers at the level and imprint chosen, when they differ from its own.
  const preview = (entry: InventoryEntry) => {
    const chosen = weapons[key(entry)];
    if (entry.kind !== "weapon" || !chosen || (chosen.level === entry.level && chosen.imprint === entry.imprint)) return null;
    return entry.variants[String(entry.id + (chosen.level - entry.level) * 100 + (chosen.imprint - entry.imprint) * 10000)] ?? null;
  };
  return <Dialog open={open} onOpenChange={(next, details) => {
    if (pending) { details.cancel(); return; }
    setOpen(next);
    reset();
  }}>
    <DialogTrigger render={<Button variant="secondary" size="sm" disabled={disabled} />}>{t("inventory.edit")}</DialogTrigger>
    <DialogContent showCloseButton={!pending} className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{t("inventory.edit")}: {character.name}</DialogTitle>
        <DialogDescription>{t("saves.editWarning")}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((name) => <Button key={name} size="sm" variant={filter === name ? "default" : "outline"} onClick={() => setFilter(name)}>
          {t(`inventory.${name}`)}</Button>)}
        <input className="min-w-40 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="search"
          placeholder={t("inventory.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      {inventory.data && !named && <p className="text-xs text-muted-foreground">{t("inventory.noNames")}</p>}
      {named && <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant={adding ? "default" : "outline"} disabled={pending} onClick={() => setAdding((on) => !on)}>{t("inventory.add")}</Button>
          {additions.map((addition, at) => <span key={at} className="flex items-center gap-1 rounded-md border border-border py-0.5 pr-1 pl-0.5 text-xs">
            <ItemIcon icon={addition.item.icon} className="size-6" />
            {addition.item.name} ×{addition.amount}{addition.location === "storage" ? ` · ${t("inventory.storage")}` : ""}
            <button type="button" aria-label={t("inventory.remove")} className="px-1 text-muted-foreground hover:text-foreground"
              onClick={() => setAdditions((all) => all.filter((_, other) => other !== at))}>×</button>
          </span>)}
        </div>
        {adding && <AddItemPanel held={held} disabled={pending} onAdd={(item, location, amount) => setAdditions((all) => [...all, { item, location, amount }])} />}
      </div>}
      <div className="min-h-40 flex-1 overflow-y-auto rounded-md border border-border">
        {inventory.isPending ? <p className="px-4 py-3 text-sm text-muted-foreground">{t("inventory.reading")}</p>
          : inventory.error ? <p role="alert" className="px-4 py-3 text-sm text-destructive">{String(inventory.error)}</p>
          : filter === "gems" ? (gems.length ? gems.map((gem) => <GemRow key={gem.index} gem={gem} chosen={effects[gem.index] ?? {}} disabled={pending}
            onChoose={(slot, effect) => setEffects((all) => ({ ...all, [gem.index]: { ...all[gem.index], [slot]: effect } }))} />)
            : <p className="px-4 py-3 text-sm text-muted-foreground">{t("inventory.empty")}</p>)
          : !shown.length ? <p className="px-4 py-3 text-sm text-muted-foreground">{t("inventory.empty")}</p>
          : shown.map((entry) => <div key={key(entry)} className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-2 first:border-t-0">
            <ItemStats name={label(entry)} description={entry.description} icon={entry.icon} stats={entry.stats} preview={preview(entry)}>
              <ItemIcon icon={entry.icon} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{label(entry)}</p>
                {entry.description && <p className="line-clamp-1 text-xs text-muted-foreground">{entry.description}</p>}
              </div>
            </ItemStats>
            {entry.kind === "item" && <input aria-label={t("inventory.amount")} className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
              type="number" min="1" max={entry.max || 999} step="1" disabled={pending}
              value={amounts[key(entry)] ?? String(entry.amount)}
              onChange={(event) => setAmounts((current) => ({ ...current, [key(entry)]: event.target.value }))} />}
            {entry.kind === "weapon" && (() => {
              const current = weapons[key(entry)] ?? { level: entry.level, imprint: entry.imprint };
              const set = (next: Partial<typeof current>) => setWeapons((all) => ({ ...all, [key(entry)]: { ...current, ...next } }));
              return <>
                <select aria-label={t("inventory.level")} className="rounded-md border border-input bg-background px-2 py-1 text-sm" disabled={pending}
                  value={current.level} onChange={(event) => set({ level: Number(event.target.value) })}>
                  {(entry.levels.length ? entry.levels : [entry.level]).map((level) => <option key={level} value={level}>+{level}</option>)}
                </select>
                {entry.imprints.length > 1 && <select aria-label={t("inventory.imprint")} className="rounded-md border border-input bg-background px-2 py-1 text-sm" disabled={pending}
                  value={current.imprint} onChange={(event) => set({ imprint: Number(event.target.value) })}>
                  {entry.imprints.map((imprint, at) => <option key={imprint} value={imprint}>{entry.imprint_names[at]}</option>)}
                </select>}
              </>;
            })()}
            {entry.kind === "weapon" && entry.slots.length > 0 && <GemSlots slots={entry.slots} chosen={gemSlots[key(entry)] ?? {}}
              gems={inventory.data?.upgrades ?? []} available={available} disabled={pending}
              onChoose={(slot, gem) => setGemSlots((all) => ({ ...all, [key(entry)]: { ...all[key(entry)], [slot]: gem } }))} />}
            {entry.kind === "armor" && <span className="text-xs text-muted-foreground">{t("inventory.armorReadOnly")}</span>}
          </div>)}
      </div>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <span className="mr-auto self-center text-xs text-muted-foreground">{t("inventory.changes", { count: changes.length })}</span>
        <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>{t("saves.cancel")}</Button>
        <Button disabled={disabled || pending || !valid || !changes.length || !inventory.data} onClick={async () => {
          if (!inventory.data) return;
          setPending(true); setError(undefined);
          try {
            await api.editInventory(profileId, { title_id: character.title_id, slot: character.slot, fingerprint: inventory.data.fingerprint, changes });
            await Promise.all([
              client.invalidateQueries({ queryKey: ["inventory", profileId] }),
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
