import type { ComponentProps } from "react";
import { cn } from "@/lib";

/** The system's own dropdown (best for long lists and on phones), in the launcher's input style:
 * borderless and translucent, like Input and Select. */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn("h-8 min-w-0 rounded-lg bg-white/[0.06] px-2.5 text-sm outline-none transition-colors hover:bg-white/[0.1] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50", className)} {...props} />;
}
