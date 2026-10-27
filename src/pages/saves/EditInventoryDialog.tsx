import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, queryKeys } from "@/lib";
import type { CatalogItem, Character, InventoryChange, InventoryEntry, InventoryLocation } from "@/lib";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui";
import { AddItemPanel } from "@/pages/saves/AddItemPanel";
import { ItemIcon } from "@/pages/saves/ItemIcon";
import { ItemStats } from "@/pages/saves/ItemStats";

type Filter = "item" | "weapon" | "armor" | "storage";
const FILTERS: Filter[] = ["item", "weapon", "armor", "storage"];
const key = (entry: InventoryEntry) => `${entry.location}:${entry.index}`;

type Addition = { item: CatalogItem; location: InventoryLocation; amount: number };

/** The inventory and storage of one character: amounts of items, weapons' level and imprint, and
 * items to add. Names, icons and stats come from the player's game files. */
export function EditInventoryDialog({ profileId, character, disabled }: { profileId: string; character: Character; disabled: boolean }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("item");
  const [search, setSearch] = useState("");
  // Edited values by entry: amounts for items, level and imprint for weapons.
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [weapons, setWeapons] = useState<Record<string, { level: number; imprint: number }>>({});
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
  const changes: InventoryChange[] = [...edits, ...additions.map(({ item, location, amount }): InventoryChange =>
    ({ type: "add", location, id: item.id, amount }))];
  const valid = entries.every((entry) => {
    const value = amounts[key(entry)];
    return value === undefined || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= (entry.max || 999));
  });
  const reset = () => { setAmounts({}); setWeapons({}); setAdditions([]); setAdding(false); setSearch(""); setError(undefined); };
  const label = (entry: InventoryEntry) => entry.name ?? t("inventory.unnamed", { id: entry.id });
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
          : !shown.length ? <p className="px-4 py-3 text-sm text-muted-foreground">{t("inventory.empty")}</p>
          : shown.map((entry) => <div key={key(entry)} className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-2 first:border-t-0">
            <ItemStats name={label(entry)} description={entry.description} icon={entry.icon} stats={entry.stats}>
              <ItemIcon icon={entry.icon} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{label(entry)}{entry.kind === "weapon" && entry.level > 0 ? ` +${entry.level}` : ""}</p>
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
