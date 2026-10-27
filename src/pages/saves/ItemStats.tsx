import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { InventoryStats } from "@/lib";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { ItemIcon } from "@/pages/saves/ItemIcon";

// The stats' labels: the parameter tables' keys (inventory.rs) to their texts.
const DAMAGE = { physical: "inventory.physical", arcane: "saves.arcane", fire: "inventory.fire", bolt: "inventory.bolt",
  blunt: "inventory.blunt", thrust: "inventory.thrust" } as const;
const ATTRIBUTE = { strength: "saves.strength", skill: "saves.skill", bloodtinge: "saves.bloodtinge", arcane: "saves.arcane" } as const;

type Props = { name: string; description: string | null; icon: number | null; stats: InventoryStats | null; children: ReactNode };

/** A hover card over an inventory row: the icon, the name, the description and the game's numbers. */
export function ItemStats({ name, description, icon, stats, children }: Props) {
  const { t } = useTranslation();
  const group = (title: string, values: Record<string, number> | undefined, label: (key: string) => string) => {
    const shown = Object.entries(values ?? {}).filter(([, value]) => value > 0);
    if (!shown.length) return null;
    return <div>
      <p className="mb-1 font-medium">{title}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {shown.map(([key, value]) => <div key={key} className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{label(key)}</dt><dd className="tabular-nums">{value}</dd></div>)}
      </dl>
    </div>;
  };
  const damage = (key: string) => key in DAMAGE ? t(DAMAGE[key as keyof typeof DAMAGE]) : key;
  const attribute = (key: string) => key in ATTRIBUTE ? t(ATTRIBUTE[key as keyof typeof ATTRIBUTE]) : key;
  return <Tooltip>
    <TooltipTrigger render={<div className="flex min-w-0 flex-1 items-center gap-3" />}>{children}</TooltipTrigger>
    <TooltipContent side="right" align="start" className="flex w-72 max-w-72 flex-col items-stretch gap-2 border border-border bg-popover p-3 text-popover-foreground shadow-lg">
      <div className="flex items-center gap-3">
        <ItemIcon icon={icon} className="size-16" />
        <p className="text-sm font-medium">{name}</p>
      </div>
      {description && <p className="whitespace-pre-line text-muted-foreground">{description}</p>}
      {group(t("inventory.attack"), stats?.attack, damage)}
      {group(t("inventory.scaling"), stats?.scaling, attribute)}
      {group(t("inventory.requirements"), stats?.requirements, attribute)}
      {group(t("inventory.defense"), stats?.defense, damage)}
      {stats?.max ? <p className="text-muted-foreground">{t("inventory.holds", { max: stats.max })}</p> : null}
    </TooltipContent>
  </Tooltip>;
}
