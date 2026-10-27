/** A generic hunter drawn in thin gold lines (wide-brimmed hat, long coat, cane, a lantern) under a
 * moon, for the character card. Line art in the launcher's colours; not taken from the game. */
export function HunterFigure({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 180" preserveAspectRatio="xMidYMid meet" className={className} aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round">
      {/* The moon and the ground. */}
      <circle cx="70" cy="30" r="12" opacity="0.45" />
      <path d="M8 172 H92" opacity="0.35" />
      {/* Hat: crown and brim. */}
      <path d="M42 32 L44 17 Q50 14 56 17 L58 32" />
      <path d="M29 33 Q50 28 71 33 Q50 37 29 33 Z" />
      {/* Collar, shoulders and the long coat to the ground, parted at the legs. */}
      <path d="M44 35 L42 42 C33 43 27 48 26 58 L23 118 C22 138 19 156 15 170" />
      <path d="M56 35 L58 42 C67 43 73 48 74 58 L77 118 C78 138 81 156 85 170" />
      <path d="M15 170 H43 L48 146 L52 146 L57 170 H85" />
      <path d="M44 35 Q50 39 56 35" />
      <path d="M50 42 V100" opacity="0.5" />
      {/* Arms: the lantern in the left hand, the cane in the right. */}
      <path d="M27 60 C23 78 21 96 20 110" />
      <path d="M73 60 C77 76 79 90 80 103" />
      <path d="M80 103 L85 171" />
      <path d="M20 110 V114" />
      <path d="M16.5 114 H23.5 L22.5 126 H17.5 Z" />
      <path d="M18.5 117.5 H21.5 V123 H18.5 Z" opacity="0.8" />
      <circle cx="20" cy="120" r="7" opacity="0.25" />
    </svg>
  );
}
