/** A hunter as an outline icon, on the launcher's icons' 24-unit grid with round strokes: a
 * wide-brimmed hat, the face under it, a high collar and the coat's shoulders and lapels. Generic;
 * not taken from the game. */
export function HunterFigure({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      {/* Hat: crown and brim. */}
      <path d="M8.6 7.2 9.1 3.4h5.8l.5 3.8" />
      <path d="M4.6 7.6c4.8-1 10-1 14.8 0" />
      {/* The face under the brim. */}
      <path d="M8.7 8.2a3.3 3.6 0 0 0 6.6 0" />
      {/* High collar. */}
      <path d="M9.3 11.4 8.4 14.6M14.7 11.4l.9 3.2" />
      {/* Shoulders and lapels. */}
      <path d="M4.5 22c0-4.4 3.3-7.2 7.5-7.2s7.5 2.8 7.5 7.2" />
      <path d="M9.8 15.1 12 18.6l2.2-3.5" />
    </svg>
  );
}
