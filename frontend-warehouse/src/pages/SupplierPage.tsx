import { useEffect, useMemo, useState } from "react";
import {
  Factory, Truck, Calendar, Package, XCircle, CheckCircle2, Tag, Send, History,
} from "lucide-react";
import { api, apiProducts } from "../api/client";
import type { Product, Shipment, SupplierRequest } from "../types";
import { ErrorBanner, SuccessBanner, EmptyState, LoadingSkeleton } from "../ui/Feedback";
import { StatusBadge } from "../ui/Status";
import { IconBadge, IconTile } from "../ui/IconTile";
import { Modal } from "../ui/Modal";
import { SupplierProductsTab } from "./SupplierProductsTab";

const STATUSES = ["pending", "processing", "approved", "rejected", "shipped"] as const;
type Status = typeof STATUSES[number];
type Tab = "requests" | "shipments" | "catalog";

const dateFmt = (s?: string | null) => (s ? new Date(s).toLocaleDateString("ru-RU") : "—");
const fmt = (n: number) => Number(n).toLocaleString("ru-RU") + " ₽";

export function SupplierPage() {
  const [tab, setTab] = useState<Tab>("requests");
  const [status, setStatus] = useState<Status>("pending");
  const [rows, setRows] = useState<SupplierRequest[] | null>(null);
  const [ships, setShips] = useState<Shipment[] | null>(null);
  // products tab is managed by SupplierProductsTab
  const [err, setErr] = useState<{ message: string } | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [shipFor, setShipFor] = useState<SupplierRequest | null>(null);
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [unitPrices, setUnitPrices] = useState<Record<number, string>>({});

  const reload = async () => {
    setErr(null);
    try {
      if (tab === "requests") setRows(await api.supplierRequests(status));
      else if (tab === "shipments") setShips(await api.supplierMyShipments());
    } catch (e) { setErr(e as { message: string }); }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [tab, status]);

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setErr(null);
    try { await fn(); setOk(msg); await reload(); }
    catch (e) { setErr(e as { message: string }); }
  };

  const confirmReject = async (id: number) => {
    if (!reason.trim()) { setErr({ message: "Укажите причину отказа" }); return; }
    await run(() => api.supplierReject(id, reason.trim()), `Запрос #${id} отклонён`);
    setRejectFor(null); setReason("");
  };

  const startShip = (r: SupplierRequest) => {
    setShipFor(r);
    setExpected(r.items[0]?.estimated_delivery_date ?? "");
    setNotes("");
    setUnitPrices({});
  };

  const confirmShip = async () => {
    if (!shipFor) return;
    const items = shipFor.items.map((i) => ({
      product_id: i.product_id,
      quantity: i.requested_quantity,
      unit_price: Number(unitPrices[i.product_id] || 0),
    }));
    await run(
      () => api.supplierShip(shipFor.id, { items, expected_date: expected || null, notes: notes || null }),
      `Поставка по запросу #${shipFor.id} отгружена`,
    );
    setShipFor(null);
  };




  const TABS: { id: Tab; label: string; icon: typeof Factory }[] = [
    { id: "requests",  label: "Запросы",         icon: Package },
    { id: "shipments", label: "Поставки",        icon: Truck },
    { id: "catalog",   label: "Мои товары",      icon: Factory },
  ];

  return (
    <div className="space-y-6">
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      <SuccessBanner message={ok} onDismiss={() => setOk(null)} />

      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
                    className={`tab inline-flex items-center gap-2 ${tab === t.id ? "tab-active" : "tab-inactive"}`}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "requests" && (
        <>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={`tab ${status === s ? "tab-active" : "tab-inactive"}`}>
                <StatusBadge status={s} />
              </button>
            ))}
          </div>
          {!rows ? <LoadingSkeleton /> : rows.length === 0 ? (
            <EmptyState icon={Package} title="Нет запросов в этом статусе" />
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="card p-4 space-y-3 animate-fade-up">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <div className="font-bold">Запрос #{r.id} · магазин #{r.store_id} (заявка #{r.application_id})</div>
                      <div className="muted text-xs">{new Date(r.created_at).toLocaleString("ru-RU")}</div>
                    </div>
                    <StatusBadge status={r.status} animated={r.status === "pending"} />
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className="table-base">
                      <thead><tr><th>Товар</th><th>Категория</th><th>Кол-во</th><th>Ожид. дата</th></tr></thead>
                      <tbody>
                        {r.items.map((i) => (
                          <tr key={i.product_id}>
                            <td className="font-medium">{i.product_name}</td>
                            <td>{i.category_name && <IconBadge icon={Tag} tone="indigo">{i.category_name}</IconBadge>}</td>
                            <td className="tabular-nums">{i.requested_quantity}</td>
                            <td>
                              <span className="inline-flex items-center gap-1 text-sm">
                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                {dateFmt(i.estimated_delivery_date)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {r.reject_reason && <div className="text-sm text-rose-700 dark:text-rose-300">Отказ: {r.reject_reason}</div>}
                  <div className="flex flex-wrap gap-2">
                    {r.status === "pending" && (
                      <button className="btn-outline" onClick={() => run(() => api.supplierAccept(r.id), "Принято в обработку")}>
                        <CheckCircle2 className="h-4 w-4" /> Принять
                      </button>
                    )}
                    {(r.status === "pending" || r.status === "processing") && (
                      <button className="btn-primary" onClick={() => run(() => apiProducts.supplierApprove(r.id), "Запрос одобрен")}>
                        <CheckCircle2 className="h-4 w-4" /> Одобрить
                      </button>
                    )}
                    {(r.status === "processing" || r.status === "approved") && (
                      <button className="btn-success" onClick={() => startShip(r)}>
                        <Truck className="h-4 w-4" /> Отгрузить
                      </button>
                    )}
                    {r.status !== "shipped" && r.status !== "rejected" && (
                      <button className="btn-danger" onClick={() => setRejectFor(r.id)}>
                        <XCircle className="h-4 w-4" /> Отклонить
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "shipments" && (
        !ships ? <LoadingSkeleton /> : ships.length === 0 ? (
          <EmptyState icon={Truck} title="Поставок ещё нет" />
        ) : (
          <div className="space-y-3">
            {ships.map((s) => (
              <div key={s.id} className="card p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="font-bold inline-flex items-center gap-2">
                    <IconTile icon={History} tone="emerald" size="sm" /> Поставка #{s.id}
                  </div>
                  <span className="muted text-xs">{new Date(s.created_at).toLocaleString("ru-RU")}</span>
                </div>
                {s.expected_date && (
                  <div className="text-sm inline-flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-slate-400" /> Ожидается: {dateFmt(s.expected_date)}
                  </div>
                )}
                <ul className="text-sm muted">
                  {s.items.map((i) => (
                    <li key={i.product_id}>· {i.product_name} × {i.quantity} ({fmt(Number(i.unit_price))})</li>
                  ))}
                </ul>
                {s.notes && <div className="text-sm">{s.notes}</div>}
              </div>
            ))}
          </div>
        )
      )}

      {tab === "catalog" && <SupplierProductsTab />}

      <Modal open={rejectFor !== null} onClose={() => setRejectFor(null)}
             title={`Отклонить запрос #${rejectFor}`}
             footer={
               <>
                 <button className="btn-ghost" onClick={() => { setRejectFor(null); setReason(""); }}>Отмена</button>
                 <button className="btn-danger" onClick={() => rejectFor && confirmReject(rejectFor)}>Подтвердить</button>
               </>
             }>
        <label className="label">Причина отказа</label>
        <textarea className="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>

      <Modal open={shipFor !== null} onClose={() => setShipFor(null)}
             title={shipFor ? `Отгрузка по запросу #${shipFor.id}` : ""}
             footer={
               <>
                 <button className="btn-ghost" onClick={() => setShipFor(null)}>Отмена</button>
                 <button className="btn-primary" onClick={confirmShip}>
                   <Send className="h-4 w-4" /> Отгрузить
                 </button>
               </>
             }>
        {shipFor && (
          <>
            <div>
              <label className="label">Ожидаемая дата прибытия</label>
              <input type="date" className="input" value={expected} onChange={(e) => setExpected(e.target.value)} />
            </div>
            <div>
              <label className="label">Заметки</label>
              <textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div>
              <label className="label">Цены позиций</label>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="table-base">
                  <thead><tr><th>Товар</th><th>Кол-во</th><th>Цена</th></tr></thead>
                  <tbody>
                    {shipFor.items.map((i) => (
                      <tr key={i.product_id}>
                        <td>{i.product_name}</td>
                        <td className="tabular-nums">{i.requested_quantity}</td>
                        <td>
                          <input type="number" min={0} step="0.01" className="input h-9 w-32 tabular-nums"
                                 value={unitPrices[i.product_id] || ""}
                                 onChange={(e) => setUnitPrices((u) => ({ ...u, [i.product_id]: e.target.value }))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
