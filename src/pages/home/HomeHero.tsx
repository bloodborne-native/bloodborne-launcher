import { useTranslation } from "react-i18next";
import { Moon } from "@/components/brand";
import { PlayButton } from "@/components/sidebar";

/** The night sky banner with the moon and a large Play button. */
export function HomeHero() {
  const { t } = useTranslation();
  return (
    <div className="relative mb-6 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-blood-700/40 via-night-800 to-night-950 px-6 py-8 shadow-2xl sm:px-10 sm:py-12 shadow-black/50">
      {/* Below lg (phones, small windows, the sidebar beside it): a small moon in the corner, and the text keeps clear of it (any language). */}
      <div className="pointer-events-none absolute right-2 top-2 opacity-90 lg:-right-10 lg:-top-10">
        <Moon className="size-24 sm:size-32 lg:size-72" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(161,29,34,0.35),transparent_60%)]" />
      <div className="relative max-w-md pr-20 sm:pr-28 lg:pr-0">
        <h1 className="font-display text-3xl font-semibold sm:text-5xl tracking-wide text-parchment drop-shadow-lg">{t("home.title")}</h1>
        <p className="mt-3 text-sm text-parchment/70">{t("home.subtitle")}</p>
        <PlayButton className="mt-8 hidden max-w-56 py-3.5 text-base md:flex" />
      </div>
    </div>
  );
}
