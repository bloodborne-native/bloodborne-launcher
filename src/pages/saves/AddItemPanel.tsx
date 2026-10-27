import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib";
import type { CatalogItem, InventoryLocation } from "@/lib";
import { Button } from "@/components/ui";
import { ItemIcon } from "@/pages/saves/ItemIcon";

const CATEGORIES = ["consumable", "material", "chalice"] as const;

type Props = {
  /** Items already in each section (by item ID): adding them again is refused. */
  held: Record<InventoryLocation, Set<number>>;
  disabled: boolean;
  onAdd: (item: CatalogItem, location: InventoryLocation, amount: number) => void;
};

/** The items the game has that can be added: a category, a search, an amount and where. */
export function AddItemPanel({ held, disabled, onAdd }: Props) {
  const { t, i18n } = useTranslation();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("consumable");
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<CatalogItem>();
  const [location, setLocation] = useState<InventoryLocation>("inventory");
  const [amount, setAmount] = useState("1");
  const catalog = useQuery({ queryKey: ["item-catalog", i18n.language], queryFn: () => api.itemCatalog(i18n.language), staleTime: Infinity });
  const shown = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(i18n.language);
    return (catalog.data ?? []).filter((item) => item.category === category)
      .filter((item) => !query || item.name.toLocaleLowerCase(i18n.language).includes(query));
  }, [catalog.data, category, search, i18n.language]);
  const max = chosen ? (location === "storage" ? Math.max(99, chosen.max) : chosen.max) : 1;
  const already = chosen ? held[location].has(chosen.id) : false;
  const valid = chosen && !already && /^\d+$/.test(amount) && Number(amount) >= 1 && Number(amount) <= max;
  return <div className="grid gap-3 rounded-md border border-border p-3">
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((name) => <Button key={name} size="sm" variant={category === name ? "default" : "outline"} onClick={() => { setCategory(name); setChosen(undefined); }}>
        {t(`inventory.${name}`)}</Button>)}
      <input className="min-w-40 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="search"
        placeholder={t("inventory.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
    </div>
    <div className="grid max-h-48 grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1 overflow-y-auto">
      {catalog.error ? <p role="alert" className="col-span-full text-sm text-destructive">{String(catalog.error)}</p>
        : shown.map((item) => <button key={item.id} type="button" title={item.name}
          className={`rounded-md border p-0.5 ${chosen?.id === item.id ? "border-primary" : "border-transparent hover:border-border"}`}
          onClick={() => { setChosen(item); setAmount(String(Math.min(item.max, 1))); }}>
          <ItemIcon icon={item.icon} className="size-full" />
        </button>)}
    </div>
    {chosen ? <div className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-40 flex-1 items-center gap-2">
        <ItemIcon icon={chosen.icon} />
        <div><p className="text-sm">{chosen.name}</p>
          {chosen.description && <p className="line-clamp-2 text-xs text-muted-foreground">{chosen.description}</p>}</div>
      </div>
      <label className="grid gap-1 text-xs">{t("inventory.addTo")}
        <select className="rounded-md border border-input bg-background px-2 py-1 text-sm" value={location}
          onChange={(event) => setLocation(event.target.value as InventoryLocation)}>
          <option value="inventory">{t("inventory.inventory")}</option>
          <option value="storage">{t("inventory.storage")}</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs">{t("inventory.amount")}
        <input className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm" type="number" min="1" max={max}
          value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <Button size="sm" disabled={disabled || !valid} onClick={() => { onAdd(chosen, location, Number(amount)); setChosen(undefined); }}>
        {t("inventory.add")}</Button>
      {already && <p className="basis-full text-xs text-destructive">{t("inventory.alreadyHeld")}</p>}
    </div> : <p className="text-xs text-muted-foreground">{t("inventory.choose")}</p>}
  </div>;
}
