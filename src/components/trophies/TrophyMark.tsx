import { Trophy, X } from "lucide-react";
import type { SaveProfile } from "@/lib";

/** A trophy icon, crossed out in red when the profile's trophies are off (edited save) or failed to import. */
export function TrophyMark({ profile, className }: { profile: SaveProfile; className: string }) {
  const off = !profile.trophies_eligible || profile.trophy_error;
  return <span className="relative inline-flex">
    <Trophy className={off ? `${className} opacity-60` : className} aria-hidden="true" />
    {off && <X className="absolute inset-0 m-auto size-full stroke-[3] text-destructive" aria-hidden="true" />}
  </span>;
}
