import { useTranslation } from "react-i18next";
import type { Gem } from "@/lib";

// The shapes' texts (gems: radial 1, triangle 2, waning 4, circle 8, droplet 63).
const SHAPES = { 1: "inventory.radial", 2: "inventory.triangle", 4: "inventory.waning", 8: "inventory.circle", 63: "inventory.droplet" } as const;

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
  const kind = gem.rune ? (gem.shape === 2 ? t("inventory.oathRune") : t("inventory.rune"))
    : gem.shape in SHAPES ? t(SHAPES[gem.shape as keyof typeof SHAPES]) : t("inventory.gem");
  const where = gem.weapon ? t("inventory.in", { weapon: gem.weapon })
    : gem.equipped ? t("inventory.equipped")
    : gem.location === "storage" ? t("inventory.storage") : t("inventory.inventory");
  return <div className="grid gap-2 border-t border-border px-4 py-2 first:border-t-0">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <p className="text-sm font-medium">{kind}</p>
      <span className="text-xs text-muted-foreground">{where}</span>
    </div>
    {gem.effects.map((effect) => effect.options.length > 1
      ? <select key={effect.slot} aria-label={effect.text ?? t("inventory.effect", { id: effect.id })} disabled={disabled}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        value={chosen[effect.slot] ?? effect.id} onChange={(event) => onChoose(effect.slot, Number(event.target.value))}>
        {effect.options.map((option) => <option key={option.id} value={option.id}>{option.text}</option>)}
      </select>
      : <p key={effect.slot} className="text-sm text-muted-foreground">{effect.text ?? t("inventory.effect", { id: effect.id })}</p>)}
  </div>;
}
