import { Trophy } from "lucide-react";
import type { SaveProfile } from "@/lib";

type Props = { profile: SaveProfile; className?: string; iconClassName: string; numberClassName?: string };

/** A profile's recorded trophies: the icon and the count, of the same height. When its trophies
 * are off (edited save) or failed to import, both are the avatar's red and a diagonal stroke
 * crosses the count. */
export function TrophyCount({ profile, className, iconClassName, numberClassName }: Props) {
  const off = !profile.trophies_eligible || profile.trophy_error;
  return <span className={`flex shrink-0 items-center gap-1.5 tabular-nums ${className ?? ""} ${off ? "text-blood-400!" : ""}`}>
    <Trophy className={iconClassName} aria-hidden="true" />
    <span className={`relative leading-none ${numberClassName ?? ""}`}>
      {profile.trophy_unlocks.length}
      {/* Corner to corner, past the digits' edges. */}
      {off && <svg className="pointer-events-none absolute -inset-x-0.5 -inset-y-0.5 h-[calc(100%+0.25rem)] w-[calc(100%+0.25rem)] overflow-visible" viewBox="0 0 10 10" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="10" x2="10" y2="0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>}
    </span>
  </span>;
}
