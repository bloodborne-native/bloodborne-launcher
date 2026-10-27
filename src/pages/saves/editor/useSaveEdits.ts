import { useMemo, useState } from "react";
import type { CatalogItem, Character, CharacterEdit, Gem, Inventory, InventoryChange, InventoryEntry, InventoryLocation } from "@/lib";

export const ATTRIBUTES = ["vitality", "endurance", "strength", "skill", "bloodtinge", "arcane"] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
export type CharacterFields = { echoes: string; insight: string } & Record<Attribute, string>;
export type Addition = { item: CatalogItem; location: InventoryLocation; amount: number };
export type WeaponChoice = { level: number; imprint: number };

export const entryKey = (entry: InventoryEntry) => `${entry.location}:${entry.index}`;

const fieldsOf = (character: Character): CharacterFields => ({
  echoes: String(character.echoes), insight: String(character.insight),
  ...Object.fromEntries(ATTRIBUTES.map((field) => [field, String(character[field])])) as Record<Attribute, string>,
});

/** Everything the save editor has changed but not saved, and the edit it makes: the character's
 * fields and the inventory's changes, checked as the backend checks them. */
export function useSaveEdits(character: Character, inventory: Inventory | undefined) {
  const [fields, setFields] = useState(() => fieldsOf(character));
  // Inventory edits by entry (entryKey): amounts, a weapon's level and imprint, its slots' gems
  // (null: empty); gem effects by gem index, then effect slot; items to add.
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [weapons, setWeapons] = useState<Record<string, WeaponChoice>>({});
  const [gemSlots, setGemSlots] = useState<Record<string, Record<number, number | null>>>({});
  const [effects, setEffects] = useState<Record<number, Record<number, number>>>({});
  const [additions, setAdditions] = useState<Addition[]>([]);
  const entries = useMemo(() => inventory?.entries ?? [], [inventory]);
  const gems = useMemo(() => inventory?.upgrades ?? [], [inventory]);

  const reset = () => {
    setFields(fieldsOf(character)); setAmounts({}); setWeapons({}); setGemSlots({}); setEffects({}); setAdditions([]);
  };

  // The character: the level follows the attributes; Vitality and Endurance have the game's minimums.
  const level = ATTRIBUTES.reduce((sum, field) => sum + Number(fields[field]), 0) - 50;
  const characterChanged = (Object.keys(fields) as (keyof CharacterFields)[]).some((field) => Number(fields[field]) !== character[field]);
  const characterValid = /^\d+$/.test(fields.echoes) && /^\d+$/.test(fields.insight)
    && Number(fields.echoes) <= 999_999_999 && Number(fields.insight) <= 99
    && ATTRIBUTES.every((field) => /^\d+$/.test(fields[field]) && Number(fields[field]) >= 1 && Number(fields[field]) <= 99)
    && (Number(fields.vitality) === character.vitality || Number(fields.vitality) >= 7)
    && (Number(fields.endurance) === character.endurance || Number(fields.endurance) >= 8)
    && level >= 4 && level <= 544;
  const characterEdit: CharacterEdit | null = characterChanged ? {
    title_id: character.title_id, slot: character.slot, fingerprint: character.fingerprint,
    echoes: Number(fields.echoes), insight: Number(fields.insight),
    vitality: Number(fields.vitality), endurance: Number(fields.endurance), strength: Number(fields.strength),
    skill: Number(fields.skill), bloodtinge: Number(fields.bloodtinge), arcane: Number(fields.arcane),
  } : null;

  const weapon = (entry: InventoryEntry): WeaponChoice => weapons[entryKey(entry)] ?? { level: entry.level, imprint: entry.imprint };
  const entryChanges = entries.flatMap((entry): InventoryChange[] => {
    const amount = amounts[entryKey(entry)];
    if (entry.kind === "item" && amount !== undefined && Number(amount) !== entry.amount) {
      return [{ type: "amount", location: entry.location, index: entry.index, amount: Number(amount) }];
    }
    const chosen = weapon(entry);
    if (entry.kind === "weapon" && (chosen.level !== entry.level || chosen.imprint !== entry.imprint)) {
      return [{ type: "weapon", location: entry.location, index: entry.index, level: chosen.level, imprint: chosen.imprint }];
    }
    return [];
  });
  // Each weapon slot's gem after the edit; gems are taken out first, so a gem can move between slots.
  const slotted = entries.flatMap((entry) => entry.slots.map((slot) => {
    const chosen = gemSlots[entryKey(entry)] ?? {};
    return { entry, slot, gem: slot.slot in chosen ? chosen[slot.slot] : slot.gem };
  }));
  const moved = slotted.filter(({ slot, gem }) => gem !== slot.gem);
  const slotChanges: InventoryChange[] = [
    ...moved.flatMap(({ slot }): InventoryChange[] => slot.gem === null ? [] : [{ type: "unequip", upgrade: slot.gem }]),
    ...moved.flatMap(({ entry, slot, gem }): InventoryChange[] => gem === null ? []
      : [{ type: "equip", upgrade: gem, location: entry.location, index: entry.index, slot: slot.slot }]),
  ];
  const inSlots = new Set(slotted.map(({ gem }) => gem));
  const takenOut = new Set(moved.map(({ slot }) => slot.gem));
  /** Whether a gem can go in a slot now: in the inventory or taken out in this edit, and in no other slot. */
  const available = (gem: Gem) => !inSlots.has(gem.index) && (gem.location === "inventory" || takenOut.has(gem.index));
  const effectChanges = gems.flatMap((gem) => gem.effects.flatMap((effect): InventoryChange[] => {
    const chosen = effects[gem.index]?.[effect.slot];
    return chosen !== undefined && chosen !== effect.id ? [{ type: "effect", upgrade: gem.index, slot: effect.slot, effect: chosen }] : [];
  }));
  const isEquipment = (addition: Addition) => addition.item.category === "weapon" || addition.item.category === "armor";
  const additionChanges = additions.map((addition): InventoryChange => isEquipment(addition)
    ? { type: "add_equipment", location: addition.location, id: addition.item.id }
    : { type: "add", location: addition.location, id: addition.item.id, amount: addition.amount });
  const changes = [...entryChanges, ...slotChanges, ...effectChanges, ...additionChanges];
  const amountsValid = entries.every((entry) => {
    const value = amounts[entryKey(entry)];
    return value === undefined || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= (entry.max || 999));
  });

  // Pending changes by section, for the editor's navigation.
  const changed = (entry: InventoryEntry) => changes.some((change) => "index" in change && change.location === entry.location && change.index === entry.index);
  const counts = {
    character: characterChanged ? 1 : 0,
    item: entries.filter((e) => e.location === "inventory" && e.kind === "item" && changed(e)).length
      + additions.filter((a) => a.location === "inventory" && !isEquipment(a)).length,
    weapon: entries.filter((e) => e.kind === "weapon" && changed(e)).length
      + additions.filter((a) => a.location === "inventory" && a.item.category === "weapon").length,
    armor: additions.filter((a) => a.location === "inventory" && a.item.category === "armor").length,
    gems: new Set(effectChanges.map((change) => change.type === "effect" && change.upgrade)).size,
    storage: entries.filter((e) => e.location === "storage" && e.kind === "item" && changed(e)).length
      + additions.filter((a) => a.location === "storage").length,
  };
  const total = (characterChanged ? 1 : 0) + changes.length;

  return {
    fields, setFields, level, characterValid, characterEdit,
    amounts, setAmounts, weapon, setWeapons, gemSlots, setGemSlots, effects, setEffects, additions, setAdditions,
    available, changes, counts, total, changed,
    valid: (!characterChanged || characterValid) && amountsValid,
    reset,
  };
}

export type SaveEdits = ReturnType<typeof useSaveEdits>;
