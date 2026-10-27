import { useTranslation } from "react-i18next";
import type { Gem } from "@/lib";
import { gemName } from "@/pages/saves/editor/gemName";
import { NativeSelect } from "@/components/common";

type Props = {
  gem: Gem;
  /** The effect chosen for each effect slot, when changed. */
  chosen: Record<number, number>;
  disabled: boolean;
  onChoose: (slot: number, effect: number) => void;
};

/** One gem or rune: its shape, where it is, and its effects, each with the strengths the game has. */
export function GemRow({ gem, chosen, disabled, onChoose }: Props) {
  const { t } = useTranslation();
  const kind = gemName(t, gem);
  const where = gem.weapon ? t("inventory.in", { weapon: gem.weapon })
    : gem.equipped ? t("inventory.equipped")
    : gem.location === "storage" ? t("inventory.storage") : t("inventory.inventory");
  return <div className="grid gap-2 px-4 py-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <p className="text-sm font-medium">{kind}</p>
      <span className="text-xs text-muted-foreground">{where}</span>
    </div>
    {gem.effects.map((effect) => effect.options.length > 1
      ? <NativeSelect key={effect.slot} aria-label={effect.text ?? t("inventory.effect", { id: effect.id })} disabled={disabled}
        
        value={chosen[effect.slot] ?? effect.id} onChange={(event) => onChoose(effect.slot, Number(event.target.value))}>
        {effect.options.map((option) => <option key={option.id} value={option.id}>{option.text}</option>)}
      </NativeSelect>
      : <p key={effect.slot} className="text-sm text-muted-foreground">{effect.text ?? t("inventory.effect", { id: effect.id })}</p>)}
  </div>;
}
