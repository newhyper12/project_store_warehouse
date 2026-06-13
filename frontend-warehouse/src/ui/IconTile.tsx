import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const SIZE = { sm: "h-9 w-9", md: "h-12 w-12", lg: "h-16 w-16" } as const;
const ICON = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" } as const;

type Tone =
  | "blue" | "violet" | "emerald" | "amber" | "rose" | "sky" | "slate" | "indigo" | "teal" | "orange";

const TONE: Record<Tone, string> = {
  blue:    "bg-gradient-to-br from-brand-500 to-brand-700 text-white",
  violet:  "bg-gradient-to-br from-violet-500 to-violet-700 text-white",
  emerald: "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white",
  amber:   "bg-gradient-to-br from-amber-400 to-amber-600 text-white",
  rose:    "bg-gradient-to-br from-rose-500 to-rose-700 text-white",
  sky:     "bg-gradient-to-br from-sky-500 to-sky-700 text-white",
  slate:   "bg-gradient-to-br from-slate-500 to-slate-700 text-white",
  indigo:  "bg-gradient-to-br from-indigo-500 to-indigo-700 text-white",
  teal:    "bg-gradient-to-br from-teal-500 to-teal-700 text-white",
  orange:  "bg-gradient-to-br from-orange-500 to-orange-700 text-white",
};

export function IconTile({
  icon: Icon, tone = "blue", size = "md", className = "",
}: { icon: LucideIcon; tone?: Tone; size?: keyof typeof SIZE; className?: string }) {
  return (
    <span className={`icon-tile ${SIZE[size]} ${TONE[tone]} ${className}`}>
      <Icon className={ICON[size]} strokeWidth={2.2} />
    </span>
  );
}

export function IconBadge({ icon: Icon, children, tone = "slate" }:
  { icon: LucideIcon; children: ReactNode; tone?: Tone }) {
  return (
    <span className={`badge ${TONE[tone]}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
      {children}
    </span>
  );
}
