import type { TFunction } from "i18next";
import type { InventoryStats } from "@/lib";

// The stats' labels: the parameter tables' keys (inventory.rs) to their texts.
const DAMAGE = { physical: "inventory.physical", arcane: "saves.arcane", fire: "inventory.fire", bolt: "inventory.bolt",
  blunt: "inventory.blunt", thrust: "inventory.thrust" } as const;
const ATTRIBUTE = { strength: "saves.strength", skill: "saves.skill", bloodtinge: "saves.bloodtinge", arcane: "saves.arcane" } as const;

export type StatGroup = keyof Omit<InventoryStats, "max">;
export const STAT_GROUPS: StatGroup[] = ["attack", "scaling", "requirements", "defense"];
const GROUP_TITLES = { attack: "inventory.attack", scaling: "inventory.scaling", requirements: "inventory.requirements", defense: "inventory.defense" } as const;

export const groupTitle = (t: TFunction, group: StatGroup) => t(GROUP_TITLES[group]);

/** A stat's label within its group (damage kinds for attack and defense, attributes otherwise). */
export function statLabel(t: TFunction, group: StatGroup, key: string) {
  if (group === "attack" || group === "defense") return key in DAMAGE ? t(DAMAGE[key as keyof typeof DAMAGE]) : key;
  return key in ATTRIBUTE ? t(ATTRIBUTE[key as keyof typeof ATTRIBUTE]) : key;
}

/** The stats that differ between two sets: (group, key, before, after). */
export function statChanges(before: InventoryStats | null, after: InventoryStats | null) {
  return STAT_GROUPS.flatMap((group) => {
    const now = before?.[group] ?? {};
    const next = after?.[group] ?? {};
    return [...new Set([...Object.keys(now), ...Object.keys(next)])]
      .map((key) => ({ group, key, before: now[key] ?? 0, after: next[key] ?? 0 }))
      .filter((change) => change.before !== change.after);
  });
}
