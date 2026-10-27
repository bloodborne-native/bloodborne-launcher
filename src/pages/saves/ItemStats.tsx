import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { InventoryStats } from "@/lib";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { ItemIcon } from "@/pages/saves/ItemIcon";
import { STAT_GROUPS, groupTitle, statLabel, type StatGroup } from "@/pages/saves/statLabels";

type Props = {
  name: string; description: string | null; icon: number | null; stats: InventoryStats | null;
  /** The numbers after the pending change (a weapon's other level or imprint), shown beside the current ones. */
  preview?: InventoryStats | null;
  /** Weapons: the same level in each imprint, for comparing them (the chosen one marked). */
  variations?: { label: string; stats: InventoryStats; chosen: boolean }[];
  /** The level the variations are at. */
  level?: number;
  children: ReactNode;
};

/** A hover card over an inventory row: the icon, the name, the description and the game's numbers. */
export function ItemStats({ name, description, icon, stats, preview, variations = [], level = 0, children }: Props) {
  const { t } = useTranslation();
  const group = (part: StatGroup) => {
    const now = stats?.[part] ?? {};
    const next = preview?.[part];
    const keys = [...new Set([...Object.keys(now), ...Object.keys(next ?? {})])]
      .filter((key) => (now[key] ?? 0) > 0 || (next?.[key] ?? 0) > 0);
    if (!keys.length) return null;
    return <div key={part}>
      <p className="mb-1 font-medium">{groupTitle(t, part)}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {keys.map((key) => {
          const value = now[key] ?? 0;
          const after = next?.[key] ?? value;
          return <div key={key} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{statLabel(t, part, key)}</dt>
            <dd className="tabular-nums">{after === value ? value : <>
              <span className="text-muted-foreground">{value} → </span>
              <span className={after > value ? "text-emerald-500" : "text-destructive"}>{after}</span>
            </>}</dd>
          </div>;
        })}
      </dl>
    </div>;
  };
  // The variations table: the stats where the imprints differ, one column each.
  const differing = STAT_GROUPS.flatMap((part) => [...new Set(variations.flatMap((v) => Object.keys(v.stats[part] ?? {})))]
    .map((key) => ({ part, key, values: variations.map((v) => v.stats[part]?.[key] ?? 0) }))
    .filter(({ values }) => values.some((value) => value !== values[0])));
  return <Tooltip>
    <TooltipTrigger render={<div className="flex min-w-0 flex-1 items-center gap-3" />}>{children}</TooltipTrigger>
    <TooltipContent side="right" align="start" className="flex w-72 max-w-72 flex-col items-stretch gap-2 border border-border bg-popover p-3 text-popover-foreground shadow-lg">
      <div className="flex items-center gap-3">
        <ItemIcon icon={icon} className="size-16" />
        <p className="text-sm font-medium">{name}</p>
      </div>
      {description && <p className="whitespace-pre-line text-muted-foreground">{description}</p>}
      {STAT_GROUPS.map(group)}
      {variations.length > 1 && differing.length > 0 && <div>
        <p className="mb-1 font-medium">{t("inventory.variations", { level })}</p>
        <table className="w-full tabular-nums">
          <thead><tr>
            <th />
            {variations.map((v) => <th key={v.label} className={`text-right font-normal ${v.chosen ? "text-foreground" : "text-muted-foreground"}`}>{v.label}</th>)}
          </tr></thead>
          <tbody>{differing.map(({ part, key, values }) => {
            const best = part === "requirements" ? Math.min(...values) : Math.max(...values);
            return <tr key={`${part}:${key}`}>
              <td className="text-muted-foreground">{statLabel(t, part, key)}</td>
              {values.map((value, at) => <td key={at} className={`text-right ${value === best ? "text-emerald-500" : ""} ${variations[at].chosen ? "font-medium" : ""}`}>{value}</td>)}
            </tr>;
          })}</tbody>
        </table>
      </div>}
      {stats?.max ? <p className="text-muted-foreground">{t("inventory.holds", { max: stats.max })}</p> : null}
    </TooltipContent>
  </Tooltip>;
}
