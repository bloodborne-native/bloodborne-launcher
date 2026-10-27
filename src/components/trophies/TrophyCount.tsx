import { Trophy } from "lucide-react";
import type { SaveProfile } from "@/lib";

/** A profile's recorded trophies: the icon and the count. When its trophies are off (edited save)
 * or failed to import, the count is struck through in red. */
export function TrophyCount({ profile, className, iconClassName }: { profile: SaveProfile; className?: string; iconClassName: string }) {
  const off = !profile.trophies_eligible || profile.trophy_error;
  return <span className={`flex shrink-0 items-center gap-1 tabular-nums ${className ?? ""}`}>
    <Trophy className={iconClassName} aria-hidden="true" />
    <span className={off ? "px-px line-through decoration-blood-400 decoration-2" : undefined}>{profile.trophy_unlocks.length}</span>
  </span>;
}
