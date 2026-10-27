import type { TFunction } from "i18next";
import type { Gem } from "@/lib";

// The shapes' texts (gems: radial 1, triangle 2, waning 4, circle 8, droplet 63).
const SHAPES = { 1: "inventory.radial", 2: "inventory.triangle", 4: "inventory.waning", 8: "inventory.circle", 63: "inventory.droplet" } as const;

/** A gem's or rune's kind as the game calls it: its shape, or Caryll/Oath rune. */
export function gemName(t: TFunction, gem: Pick<Gem, "rune" | "shape">) {
  if (gem.rune) return gem.shape === 2 ? t("inventory.oathRune") : t("inventory.rune");
  return gem.shape in SHAPES ? t(SHAPES[gem.shape as keyof typeof SHAPES]) : t("inventory.gem");
}
