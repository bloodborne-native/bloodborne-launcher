import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Gem, InventoryEntry } from "@/lib";
import { Button, Input } from "@/components/ui";
import { AddItemPanel } from "@/pages/saves/editor/AddItemPanel";
import { ItemIcon } from "@/pages/saves/editor/ItemIcon";
import { PendingAdditions } from "@/pages/saves/editor/PendingAdditions";
import { WeaponDetail, weaponName } from "@/pages/saves/editor/WeaponDetail";
import { entryKey, type SaveEdits } from "@/pages/saves/editor/useSaveEdits";

type Props = { weapons: InventoryEntry[]; gems: Gem[]; edits: SaveEdits; disabled: boolean };

/** The weapons as a list (with weapons to add), and the chosen one in full beside it (below it on
 * narrow windows). */
export function WeaponsSection({ weapons, gems, edits, disabled }: Props) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>();
  const [adding, setAdding] = useState(false);
  // Weapons can be added more than once: nothing is "already held".
  const held = useMemo(() => ({ inventory: new Set<number>(), storage: new Set<number>() }), []);
  const shown = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(i18n.language);
    return weapons.filter((entry) => !query || (entry.name ?? "").toLocaleLowerCase(i18n.language).includes(query));
  }, [weapons, search, i18n.language]);
  const current = weapons.find((entry) => entryKey(entry) === selected) ?? shown[0];
  // Wide: the list and the chosen weapon side by side. Narrow: the list, then the weapon tapped
  // on its own with a way back.
  const picked = selected !== undefined && current !== undefined;
  return <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
    <div className={`content-start gap-2 ${picked ? "hidden lg:grid" : "grid"}`}>
      <div className="flex gap-2">
        <Input className="min-w-0 flex-1" type="search"
          placeholder={t("inventory.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
        <Button size="sm" variant={adding ? "default" : "secondary"} disabled={disabled} onClick={() => setAdding((on) => !on)}>{t("inventory.addWeapon")}</Button>
      </div>
      {adding && <AddItemPanel held={held} location="inventory" categories={["weapon"]} disabled={disabled}
        onAdd={(item) => edits.setAdditions((all) => [...all, { item, location: "inventory", amount: 1 }])} />}
      <div className="own-scroll rounded-2xl surface py-1">
        <PendingAdditions edits={edits} location="inventory" categories={["weapon"]} disabled={disabled} />
        {!shown.length ? <p className="px-3 py-3 text-sm text-muted-foreground">{t("inventory.empty")}</p>
          : shown.map((entry) => {
            const chosen = edits.weapon(entry);
            const active = entry === current;
            return <button key={entryKey(entry)} type="button" onClick={() => setSelected(entryKey(entry))}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left ${active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}>
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
    {current ? <div className={`self-start ${picked ? "grid" : "hidden lg:grid"} gap-3`}>
      <Button variant="ghost" size="sm" className="justify-self-start lg:hidden" onClick={() => setSelected(undefined)}>← {t("inventory.weapon")}</Button>
      <div className="own-scroll rounded-2xl lg:surface lg:p-4">
        <WeaponDetail key={entryKey(current)} entry={current} gems={gems} edits={edits} disabled={disabled} />
      </div>
    </div> : <p className="text-sm text-muted-foreground">{t("inventory.chooseWeapon")}</p>}
  </div>;
}
