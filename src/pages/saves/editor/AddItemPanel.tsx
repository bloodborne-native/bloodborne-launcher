import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CatalogItem, InventoryLocation } from "@/lib";
import { Button, Input } from "@/components/ui";
import { ItemIcon } from "@/pages/saves/editor/ItemIcon";
import { useItemCatalog } from "@/pages/saves/editor/useItemCatalog";
import { Message } from "@/components/common";

const CATEGORIES = ["consumable", "material", "chalice"] as const;

type Props = {
  /** Items already in each section (by item ID): adding them again is refused. */
  held: Record<InventoryLocation, Set<number>>;
  /** Where the item goes (the section it is added from). */
  location: InventoryLocation;
  disabled: boolean;
  onAdd: (item: CatalogItem, amount: number) => void;
};

/** The items the game has that can be added: a category, a search and an amount. */
export function AddItemPanel({ held, location, disabled, onAdd }: Props) {
  const { t, i18n } = useTranslation();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("consumable");
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<CatalogItem>();
  const [amount, setAmount] = useState("1");
  const catalog = useItemCatalog();
  const shown = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(i18n.language);
    return (catalog.data ?? []).filter((item) => item.category === category)
      .filter((item) => !query || item.name.toLocaleLowerCase(i18n.language).includes(query));
  }, [catalog.data, category, search, i18n.language]);
  const max = chosen ? (location === "storage" ? Math.max(99, chosen.max) : chosen.max) : 1;
  const already = chosen ? held[location].has(chosen.id) : false;
  const valid = chosen && !already && /^\d+$/.test(amount) && Number(amount) >= 1 && Number(amount) <= max;
  return <div className="grid gap-3 rounded-xl surface-inset p-3">
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((name) => <Button key={name} size="sm" variant={category === name ? "default" : "outline"} onClick={() => { setCategory(name); setChosen(undefined); }}>
        {t(`inventory.${name}`)}</Button>)}
      <Input className="min-w-40 flex-1" type="search"
        placeholder={t("inventory.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
    </div>
    <div className="grid max-h-48 grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1 overflow-y-auto">
      {catalog.error ? <Message tone="error" className="col-span-full">{String(catalog.error)}</Message>
        : shown.map((item) => <button key={item.id} type="button" title={item.name}
          className={`rounded-md p-0.5 ${chosen?.id === item.id ? "bg-gold-400/25" : "hover:bg-white/[0.06]"}`}
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
      <label className="grid gap-1 text-xs">{t("inventory.amount")}
        <Input className="w-24" type="number" min="1" max={max}
          value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <Button size="sm" disabled={disabled || !valid} onClick={() => { onAdd(chosen, Number(amount)); setChosen(undefined); }}>
        {t("inventory.add")}</Button>
      {already && <p className="basis-full text-xs text-destructive">{t("inventory.alreadyHeld")}</p>}
    </div> : <p className="text-xs text-muted-foreground">{t("inventory.choose")}</p>}
  </div>;
}
