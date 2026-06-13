import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export function Modal({ open, onClose, title, children, footer }:
  { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  // Lock body scroll + close on Escape while the modal is mounted.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    // position:fixed anchors to the viewport regardless of page scroll,
    // so the modal always appears in the centre of the visible screen.
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-contain">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-up" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full sm:max-w-lg card p-0 animate-scale-in max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-200/70 dark:border-slate-700/70 bg-inherit rounded-t-3xl">
          <h3 className="h3">{title}</h3>
          <button onClick={onClose} className="btn-ghost btn-sm" aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 text-sm overflow-y-auto px-5 sm:px-6 py-4">{children}</div>
        {footer && (
          <div className="sticky bottom-0 px-5 sm:px-6 py-3 border-t border-slate-200/70 dark:border-slate-700/70 bg-inherit flex flex-wrap justify-end gap-2 rounded-b-3xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
