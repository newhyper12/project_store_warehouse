import { AlertCircle, CheckCircle2, X, Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function ErrorBanner({ error, onDismiss }:
  { error: { message: string } | null; onDismiss?: () => void }) {
  if (!error) return null;
  return (
    <div className="animate-scale-in flex items-start gap-3 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <span className="flex-1">{error.message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="opacity-70 hover:opacity-100" aria-label="Закрыть">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function SuccessBanner({ message, onDismiss }:
  { message: string | null; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <div className="animate-scale-in flex items-start gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="opacity-70 hover:opacity-100" aria-label="Закрыть">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, hint }:
  { icon?: typeof Inbox; title: string; hint?: ReactNode }) {
  return (
    <div className="card p-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500">
        <Icon className="h-7 w-7" />
      </div>
      <div className="text-base font-semibold">{title}</div>
      {hint && <div className="muted mt-1 text-sm">{hint}</div>}
    </div>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card p-4">
          <div className="skeleton h-4 w-1/3 mb-3" />
          <div className="skeleton h-3 w-2/3 mb-2" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
