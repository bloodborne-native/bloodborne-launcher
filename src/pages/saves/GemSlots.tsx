import { useTranslation } from "react-i18next";
import type { Gem } from "@/lib";
import { gemName } from "@/pages/saves/gemName";

type Props = {
  slots: { slot: number; shape: number; gem: number | null }[];
  /** The gem chosen for each slot (null: empty), when changed. */
  chosen: Record<number, number | null>;
  gems: Gem[];
  /** Whether a gem can go in a slot now: in the inventory, or taken out of its slot in this edit, and not chosen elsewhere. */
  available: (gem: Gem) => boolean;
  disabled: boolean;
  onChoose: (slot: number, gem: number | null) => void;
};

/** A weapon's open gem slots, each a select of the gems whose shape it takes. */
export function GemSlots({ slots, chosen, gems, available, disabled, onChoose }: Props) {
  const { t } = useTranslation();
  const describe = (gem: Gem) => [gemName(t, gem), ...gem.effects.map((effect) => effect.text ?? t("inventory.effect", { id: effect.id }))].join(" · ");
  return <div className="flex w-full flex-wrap gap-2 pl-13">
    {slots.map((slot) => {
      const current = slot.slot in chosen ? chosen[slot.slot] : slot.gem;
      // A slot takes the gem shapes of its bits; droplet gems have them all.
      const fitting = gems.filter((gem) => !gem.rune && (gem.shape & slot.shape) !== 0 && (gem.index === current || available(gem)));
      return <select key={slot.slot} aria-label={t("inventory.gemSlot", { slot: slot.slot + 1 })} disabled={disabled}
        className="max-w-full min-w-0 flex-1 basis-56 truncate rounded-md border border-input bg-background px-2 py-1 text-xs"
        value={current ?? ""} onChange={(event) => onChoose(slot.slot, event.target.value === "" ? null : Number(event.target.value))}>
        <option value="">{t("inventory.emptySlot", { slot: slot.slot + 1 })}</option>
        {fitting.map((gem) => <option key={gem.index} value={gem.index}>{describe(gem)}</option>)}
      </select>;
    })}
  </div>;
}
