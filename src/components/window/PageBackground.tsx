import background from "@/assets/page-background.webp";

/** Every page but Home (which has its own picture): a night street (an AI-generated image,
 * docs/CREDITS.md), blurred and darkened behind the whole window (menu and page), still while the page scrolls. */
export function PageBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <img src={background} alt="" draggable={false} className="size-full scale-110 object-cover blur-md" />
      <div className="absolute inset-0 bg-background/75" />
    </div>
  );
}
