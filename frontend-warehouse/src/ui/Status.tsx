import {
  CheckCircle2, Clock, XCircle, Truck, PackageCheck, AlertTriangle,
  Hourglass, ArrowRightCircle, PackageX, MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Meta { label: string; classes: string; icon: LucideIcon }

const M: Record<string, Meta> = {
  pending_store_review: { label: "Ожидает магазин", icon: Hourglass,
    classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  pending_customer_decision: { label: "Ожидает решения покупателя", icon: MessageSquare,
    classes: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200" },
  accepted_by_store: { label: "Принята магазином", icon: CheckCircle2,
    classes: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  partially_accepted_by_store: { label: "Частично принята", icon: AlertTriangle,
    classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  customer_approved_partial: { label: "Покупатель: только склад", icon: CheckCircle2,
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  customer_approved_split: { label: "Покупатель: склад + поставщик", icon: ArrowRightCircle,
    classes: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200" },
  rejected_by_store: { label: "Отклонена магазином", icon: XCircle,
    classes: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200" },
  sent_to_warehouse: { label: "Отправлено на склад", icon: ArrowRightCircle,
    classes: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200" },
  sent_to_supplier: { label: "Отправлено поставщику", icon: ArrowRightCircle,
    classes: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200" },
  warehouse_processing: { label: "Склад: в обработке", icon: Clock,
    classes: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  warehouse_approved: { label: "Склад: одобрено", icon: CheckCircle2,
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  warehouse_rejected: { label: "Склад: отклонено", icon: PackageX,
    classes: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200" },
  warehouse_shipped: { label: "Склад: отгружено", icon: Truck,
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  supplier_processing: { label: "Поставщик: в обработке", icon: Clock,
    classes: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  supplier_approved: { label: "Поставщик: одобрено", icon: CheckCircle2,
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  supplier_shipped: { label: "Поставщик: отгружено", icon: Truck,
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  supplier_rejected: { label: "Поставщик: отклонено", icon: PackageX,
    classes: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200" },
  split_processing: { label: "Параллельно: склад + поставщик", icon: ArrowRightCircle,
    classes: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200" },
  completed: { label: "Выполнено", icon: PackageCheck,
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  cancelled: { label: "Отменено", icon: XCircle,
    classes: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  cancelled_by_customer: { label: "Отменено покупателем", icon: XCircle,
    classes: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  // request-level
  pending: { label: "Ожидает", icon: Hourglass,
    classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  processing: { label: "В обработке", icon: Clock,
    classes: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  approved: { label: "Одобрено", icon: CheckCircle2,
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  rejected: { label: "Отклонено", icon: XCircle,
    classes: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200" },
  shipped: { label: "Отгружено", icon: Truck,
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
};

export function StatusBadge({ status, animated = false }: { status: string; animated?: boolean }) {
  const m = M[status] || { label: status, icon: AlertTriangle,
    classes: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
  const Icon = m.icon;
  return (
    <span className={`badge ${m.classes} ${animated ? "badge-dot" : ""}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
      {m.label}
    </span>
  );
}

export function statusLabel(s: string): string {
  return M[s]?.label || s;
}
