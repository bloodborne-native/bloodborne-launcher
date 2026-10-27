import { Trophy, X } from "lucide-react";
import type { SaveProfile } from "@/lib";

/** A trophy icon with a red "off" badge (a white X in a red circle at its corner) when the
 * profile's trophies are off (edited save) or failed to import. `badge`: the badge's size class. */
export function TrophyMark({ profile, className, badge = "size-3" }: { profile: SaveProfile; className: string; badge?: string }) {
  const off = !profile.trophies_eligible || profile.trophy_error;
  // The badge hangs off the corner: room for it before the count.
  return <span className={off ? "relative mr-1.5 inline-flex" : "relative inline-flex"}>
    <Trophy className={off ? `${className} opacity-50` : className} aria-hidden="true" />
    {off && <span className={`absolute -right-1.5 -bottom-1 flex items-center justify-center rounded-full bg-destructive text-white ring-2 ring-background ${badge}`} aria-hidden="true">
      <X className="size-[75%] stroke-[3.5]" />
    </span>}
  </span>;
}
