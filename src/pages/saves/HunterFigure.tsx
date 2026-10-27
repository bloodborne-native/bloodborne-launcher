import { useId } from "react";

/** A generic hunter's silhouette for the character card (wide-brimmed hat, long coat, cane, a lit
 * lantern) under a low moon, in the launcher's colours. Drawn, not taken from the game. */
export function HunterFigure({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 100 180" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f2530" />
          <stop offset="1" stopColor="#07090d" />
        </linearGradient>
        <radialGradient id={`${id}-moon`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.55" stopColor="#ece4d4" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ece4d4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-lamp`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#e3c891" stopOpacity="0.9" />
          <stop offset="0.35" stopColor="#c9a265" stopOpacity="0.35" />
          <stop offset="1" stopColor="#c9a265" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9a265" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#c9a265" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="100" height="180" fill={`url(#${id}-sky)`} />
      <circle cx="68" cy="34" r="22" fill={`url(#${id}-moon)`} />
      <circle cx="68" cy="34" r="11" fill="#ece4d4" opacity="0.35" />
      {/* The ground's mist. */}
      <ellipse cx="50" cy="176" rx="60" ry="10" fill="#1f2530" opacity="0.9" />
      <g fill="#07090d">
        {/* Hat: crown and wide brim. */}
        <path d="M41 33 L43 18 Q50 15 57 18 L59 33 Z" />
        <ellipse cx="50" cy="33" rx="21" ry="3.6" />
        {/* High collar and shoulders, the long coat flaring to the ground. */}
        <path d="M43 35 L57 35 L59 42 C68 43 74 48 75 58 L78 118 C79 138 82 158 87 174 L57 174 L52 146 L48 146 L43 174 L13 174 C18 158 21 138 22 118 L25 58 C26 48 32 43 41 42 Z" />
        {/* Arms: the left one holds the lantern, the right one the cane. */}
        <path d="M25 58 C21 76 19 96 18 112 L23 113 C25 96 28 78 31 62 Z" />
        <path d="M75 58 C79 74 81 90 82 104 L77 105 C75 90 72 76 69 62 Z" />
        <rect x="81" y="102" width="2.6" height="72" rx="1.2" transform="rotate(4 82 102)" />
        <path d="M14 112 L23 112 L22 116 L15 116 Z" />
        <rect x="15.5" y="116" width="6" height="9" rx="1" />
      </g>
      {/* The lantern's light, and its warm edge on the coat. */}
      <circle cx="18.5" cy="121" r="16" fill={`url(#${id}-lamp)`} />
      <rect x="16.8" y="117.5" width="3.4" height="6" rx="0.8" fill="#e3c891" />
      <path d="M25 58 L22 118 C21 138 18 158 13 174 L20 174 C24 150 26 120 28 64 Z" fill={`url(#${id}-rim)`} />
    </svg>
  );
}
