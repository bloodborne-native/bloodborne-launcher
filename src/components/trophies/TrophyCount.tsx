import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SaveProfile } from "@/lib";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";

type Props = { profile: SaveProfile; className?: string; iconClassName: string };

/** A profile's recorded trophies: the icon and the count. When its trophies are off (edited save)
 * or failed to import: the trophy greyed and slashed (in the style of lucide's "-off" icons), no
 * count, and "Trophies disabled" on hover. */
export function TrophyCount({ profile, className, iconClassName }: Props) {
  const { t } = useTranslation();
  const off = !profile.trophies_eligible || profile.trophy_error;
  if (!off) return <span className={`flex shrink-0 items-center gap-1 tabular-nums ${className ?? ""}`}
    title={t("trophies.recordedCount", { count: profile.trophy_unlocks.length })}>
    <Trophy className={iconClassName} aria-hidden="true" />{profile.trophy_unlocks.length}
  </span>;
  return <Tooltip>
    <TooltipTrigger render={<span className="relative inline-flex shrink-0 text-muted-foreground" aria-label={t("trophies.off")} />}>
      {/* The trophy with a transparent band along the slash (a mask, so it works on any background). */}
      <Trophy className={iconClassName} aria-hidden="true"
        style={{ mask: "linear-gradient(to bottom right, #000 calc(50% - 1.6px), transparent calc(50% - 1.6px) calc(50% + 1.6px), #000 calc(50% + 1.6px))" }} />
      <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox="0 0 24 24" fill="none" strokeLinecap="round" aria-hidden="true">
        <line x1="1" y1="23" x2="23" y2="1" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    </TooltipTrigger>
    <TooltipContent>{t("trophies.off")}</TooltipContent>
  </Tooltip>;
}
