import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Modal({ open, onClose, title, children, footer }:
  { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-up" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg card p-5 sm:p-6 animate-scale-in max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="h3">{title}</h3>
          <button onClick={onClose} className="btn-ghost btn-sm" aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 text-sm">{children}</div>
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
