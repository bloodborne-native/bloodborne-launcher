import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Gem, InventoryEntry } from "@/lib";
import { ItemIcon } from "@/pages/saves/editor/ItemIcon";
import { WeaponDetail, weaponName } from "@/pages/saves/editor/WeaponDetail";
import { entryKey, type SaveEdits } from "@/pages/saves/editor/useSaveEdits";

type Props = { weapons: InventoryEntry[]; gems: Gem[]; edits: SaveEdits; disabled: boolean };

/** The weapons as a list, and the chosen one in full beside it (below it on narrow windows). */
export function WeaponsSection({ weapons, gems, edits, disabled }: Props) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>();
  const shown = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(i18n.language);
    return weapons.filter((entry) => !query || (entry.name ?? "").toLocaleLowerCase(i18n.language).includes(query));
  }, [weapons, search, i18n.language]);
  const current = weapons.find((entry) => entryKey(entry) === selected) ?? shown[0];
  return <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
    <div className="grid content-start gap-2">
      <input className="rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="search"
        placeholder={t("inventory.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="rounded-md border border-border">
        {!shown.length ? <p className="px-3 py-3 text-sm text-muted-foreground">{t("inventory.empty")}</p>
          : shown.map((entry) => {
            const chosen = edits.weapon(entry);
            const active = entry === current;
            return <button key={entryKey(entry)} type="button" onClick={() => setSelected(entryKey(entry))}
              className={`flex w-full items-center gap-3 border-t border-border px-3 py-2 text-left first:border-t-0 ${active ? "bg-accent" : "hover:bg-muted/50"}`}>
              <ItemIcon icon={entry.icon} className="size-9" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{weaponName(entry, chosen.level, chosen.imprint) || t("inventory.unnamed", { id: entry.id })}</span>
                {(entry.slots.length > 0 || entry.location === "storage") && <span className="block text-xs text-muted-foreground">
                  {entry.slots.length > 0 && t("inventory.slotsUsed", { used: entry.slots.filter((slot) => slot.gem !== null).length, count: entry.slots.length })}
                  {entry.slots.length > 0 && entry.location === "storage" && " · "}
                  {entry.location === "storage" && t("inventory.storage")}
                </span>}
              </span>
              {edits.changed(entry) && <span aria-label={t("inventory.edited")} className="size-2 shrink-0 rounded-full bg-primary" />}
            </button>;
          })}
      </div>
    </div>
    {current ? <div className="self-start rounded-md border border-border p-4 lg:sticky lg:top-0">
      <WeaponDetail key={entryKey(current)} entry={current} gems={gems} edits={edits} disabled={disabled} />
    </div> : <p className="text-sm text-muted-foreground">{t("inventory.chooseWeapon")}</p>}
  </div>;
}
