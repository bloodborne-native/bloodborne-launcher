import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { InventoryStats } from "@/lib";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { ItemIcon } from "@/pages/saves/editor/ItemIcon";
import { StatsTable } from "@/pages/saves/editor/StatsTable";

type Props = { name: string; description: string | null; caption?: string | null; icon: number | null; stats: InventoryStats | null; children: ReactNode };

/** A hover card over an inventory row: the icon, the name, the description and the game's numbers. */
export function ItemStats({ name, description, caption, icon, stats, children }: Props) {
  const { t } = useTranslation();
  return <Tooltip>
    <TooltipTrigger render={<div className="flex min-w-0 flex-1 items-center gap-3" />}>{children}</TooltipTrigger>
    <TooltipContent side="right" align="start" className="flex max-h-[min(36rem,80dvh)] w-80 max-w-80 flex-col overflow-y-auto items-stretch gap-2 border border-border bg-popover p-3 text-popover-foreground shadow-lg">
      <div className="flex items-center gap-3">
        <ItemIcon icon={icon} className="size-16" />
        <p className="text-sm font-medium">{name}</p>
      </div>
      {description && <p className="whitespace-pre-line">{description}</p>}
      {caption && <p className="whitespace-pre-line text-muted-foreground">{caption}</p>}
      {stats && <StatsTable columns={[{ label: "", stats }]} />}
      {stats?.max ? <p className="text-muted-foreground">{t("inventory.holds", { max: stats.max })}</p> : null}
    </TooltipContent>
  </Tooltip>;
}
