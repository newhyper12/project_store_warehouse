import { ReactNode, KeyboardEvent } from "react";
import { Check } from "lucide-react";

export interface RadioCardOption<T extends string> {
  value: T;
  title: string;
  description?: string;
  icon?: ReactNode;
  badge?: string;
  disabled?: boolean;
}

interface Props<T extends string> {
  name: string;
  value: T | null;
  onChange: (value: T) => void;
  options: RadioCardOption<T>[];
  columns?: 1 | 2 | 3;
}

/**
 * Accessible card-style radio group.
 * - real <input type="radio"> for screen readers / form submission
 * - keyboard: Tab to focus, Space/Enter to select
 * - mobile-friendly tap target (>= 44px), works in dark mode
 */
export function RadioCardGroup<T extends string>({
  name, value, onChange, options, columns = 1,
}: Props<T>) {
  const grid =
    columns === 3 ? "sm:grid-cols-3" :
    columns === 2 ? "sm:grid-cols-2" : "";
  return (
    <div role="radiogroup" className={`grid grid-cols-1 gap-3 ${grid}`}>
      {options.map((o) => {
        const selected = value === o.value;
        const onKey = (e: KeyboardEvent<HTMLLabelElement>) => {
          if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!o.disabled) onChange(o.value); }
        };
        return (
          <label
            key={o.value}
            tabIndex={o.disabled ? -1 : 0}
            onKeyDown={onKey}
            aria-disabled={o.disabled || undefined}
            className={[
              "relative block cursor-pointer rounded-2xl border p-4 transition-all duration-200",
              "min-h-[88px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
              selected
                ? "border-brand-500 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/40 dark:to-slate-900/50 shadow-lift"
                : "border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 hover:border-brand-400 hover:shadow-soft",
              o.disabled ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={selected}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <div className="flex items-start gap-3">
              {o.icon && (
                <span className={[
                  "shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl",
                  selected
                    ? "bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
                ].join(" ")}>
                  {o.icon}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{o.title}</span>
                  {o.badge && (
                    <span className="badge bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200">{o.badge}</span>
                  )}
                </div>
                {o.description && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{o.description}</p>
                )}
              </div>
              <span
                aria-hidden
                className={[
                  "shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
                  selected
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-slate-300 dark:border-slate-600",
                ].join(" ")}
              >
                {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
            </div>
          </label>
        );
      })}
    </div>
  );
}
