import type { LucideIcon } from "lucide-react";
import { ChevronRight, Check } from "lucide-react";
import { IconTile } from "../ui/IconTile";

type Tone = Parameters<typeof IconTile>[0]["tone"];

export function HubCard({
  title, description, icon, points = [], tone = "blue", onClick,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  points?: string[];
  tone?: Tone;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="role-card group w-full">
      <div className="flex items-start gap-4">
        <IconTile icon={icon} tone={tone} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="h3">{title}</h3>
            <ChevronRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1" />
          </div>
          <p className="muted mt-1 text-sm">{description}</p>
        </div>
      </div>
      {points.length > 0 && (
        <ul className="mt-5 grid gap-2">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" strokeWidth={2.6} />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}
