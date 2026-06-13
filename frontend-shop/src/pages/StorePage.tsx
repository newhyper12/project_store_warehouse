import { useEffect, useMemo, useState } from "react";
import {
  Inbox, Warehouse, Factory, Package, Truck, CheckSquare, Square,
  AlertTriangle, MessageSquare, ChevronDown, ChevronUp, XCircle, Send, Calendar,
} from "lucide-react";
import { api } from "../api/client";
import type { ApplicationItem, OrderApplication, ProposalItemPayload, SupplierRequest, WarehouseRequest } from "../types";
import { ErrorBanner, SuccessBanner, EmptyState, LoadingSkeleton } from "../ui/Feedback";
import { StatusBadge } from "../ui/Status";
import { IconTile, IconBadge } from "../ui/IconTile";
import { Modal } from "../ui/Modal";
import { StoreProductsTab } from "./StoreProductsTab";

type Tab = "incoming" | "pending_customer" | "warehouse" | "supplier" | "products";

const fmt = (n: number) => Number(n).toLocaleString("ru-RU") + " ₽";
const dateFmt = (s?: string | null) => (s ? new Date(s).toLocaleDateString("ru-RU") : "—");

export function StorePage() {
  const [tab, setTab] = useState<Tab>("incoming");
  const [apps, setApps] = useState<OrderApplication[] | null>(null);
  const [whr, setWhr] = useState<WarehouseRequest[] | null>(null);
  const [supr, setSupr] = useState<SupplierRequest[] | null>(null);
  const [err, setErr] = useState<{ message: string } | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const reload = async () => {
    try {
      const [a, w, s] = await Promise.all([
        api.storeApplications(), api.storeWarehouseReqs(), api.storeSupplierReqs(),
      ]);
      setApps(a); setWhr(w); setSupr(s);
    } catch (e) { setErr(e as { message: string }); }
  };
  useEffect(() => { reload(); }, []);

  const incoming = useMemo(
    () => apps?.filter((a) => ["pending_store_review"].includes(a.status)) || [],
    [apps],
  );
  const pendingCust = useMemo(
    () => apps?.filter((a) => a.status === "pending_customer_decision") || [],
    [apps],
  );
  const allOther = useMemo(
    () => apps?.filter((a) => !["pending_store_review", "pending_customer_decision"].includes(a.status)) || [],
    [apps],
  );

  const TABS: { id: Tab; label: string; icon: typeof Inbox; count: number }[] = [
    { id: "incoming",         label: "Входящие",            icon: Inbox,     count: incoming.length },
    { id: "pending_customer", label: "Ждут покупателя",     icon: MessageSquare, count: pendingCust.length },
    { id: "warehouse",        label: "Запросы на склад",    icon: Warehouse, count: whr?.length ?? 0 },
    { id: "supplier",         label: "Запросы поставщику",  icon: Factory,   count: supr?.length ?? 0 },
    { id: "products",         label: "Товары",              icon: Package,   count: 0 },
  ];

  return (
    <div className="space-y-6">
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      <SuccessBanner message={ok} onDismiss={() => setOk(null)} />

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
                    className={`tab inline-flex items-center gap-2 ${active ? "tab-active" : "tab-inactive"}`}>
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
              {t.count > 0 && (
                <span className={`ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold
                  ${active ? "bg-white/25 text-white" : "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"}`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "incoming" && (
        !apps ? <LoadingSkeleton /> :
        incoming.length === 0 ? <EmptyState icon={Inbox} title="Нет новых заявок" /> :
        <div className="space-y-3">
          {incoming.map((a) => <StoreIncomingCard key={a.id} app={a} onChanged={reload} setErr={setErr} setOk={setOk} />)}
          {allOther.length > 0 && (
            <details className="card p-4 mt-4">
              <summary className="cursor-pointer font-semibold">Другие заявки ({allOther.length})</summary>
              <div className="mt-3 space-y-2">
                {allOther.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                    <span className="font-medium">#{a.id}</span>
                    <span className="muted text-xs">{new Date(a.created_at).toLocaleDateString("ru-RU")}</span>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {tab === "pending_customer" && (
        !apps ? <LoadingSkeleton /> :
        pendingCust.length === 0 ? <EmptyState icon={MessageSquare} title="Нет заявок, ожидающих решения покупателя" /> :
        <div className="space-y-3">
          {pendingCust.map((a) => (
            <div key={a.id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-bold">Заявка #{a.id}</div>
                <StatusBadge status={a.status} animated />
              </div>
              <div className="muted text-sm">Покупатель должен принять или отклонить предложение.</div>
              {a.proposal && (
                <ul className="text-sm space-y-1">
                  {a.proposal.items.map((i) => (
                    <li key={i.id}>· {i.product_name}: склад {i.proposed_warehouse_quantity}, поставщик {i.proposed_supplier_quantity}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "warehouse" && (
        !whr ? <LoadingSkeleton /> :
        whr.length === 0 ? <EmptyState icon={Warehouse} title="Нет запросов на склад" /> :
        <div className="space-y-3">
          {whr.map((r) => (
            <div key={r.id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-bold">Запрос #{r.id} → склад #{r.warehouse_id ?? "?"} (заявка #{r.application_id})</div>
                <StatusBadge status={r.status} />
              </div>
              <ul className="text-sm muted">
                {r.items.map((i) => <li key={i.product_id}>· {i.product_name} × {i.requested_quantity}{i.approved_quantity != null && ` (одобрено: ${i.approved_quantity})`}</li>)}
              </ul>
              {r.reject_reason && <div className="text-sm text-rose-600">Отказ: {r.reject_reason}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === "supplier" && (
        !supr ? <LoadingSkeleton /> :
        supr.length === 0 ? <EmptyState icon={Factory} title="Нет запросов поставщику" /> :
        <div className="space-y-3">
          {supr.map((r) => (
            <div key={r.id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-bold">Запрос #{r.id} → поставщик #{r.supplier_id ?? "?"} (заявка #{r.application_id})</div>
                <StatusBadge status={r.status} />
              </div>
              <ul className="text-sm muted">
                {r.items.map((i) => (
                  <li key={i.product_id}>· {i.product_name} × {i.requested_quantity}
                    {i.estimated_delivery_date && <> · до {dateFmt(i.estimated_delivery_date)}</>}
                  </li>
                ))}
              </ul>
              {r.reject_reason && <div className="text-sm text-rose-600">Отказ: {r.reject_reason}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === "products" && <StoreProductsTab />}
    </div>
  );
}

interface Decision {
  selected: boolean;
  warehouseQty: number;
  supplierId: number | null;
  supplierQty: number;
}

function StoreIncomingCard({ app, onChanged, setErr, setOk }:
  { app: OrderApplication; onChanged: () => Promise<void>;
    setErr: (e: { message: string } | null) => void;
    setOk: (m: string | null) => void }) {
  const [expanded, setExpanded] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [proposalOpen, setProposalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [decisions, setDecisions] = useState<Record<number, Decision>>(() => {
    const out: Record<number, Decision> = {};
    for (const it of app.items) {
      const have = it.warehouse_available_quantity ?? 0;
      out[it.id] = {
        selected: have >= it.quantity,
        warehouseQty: Math.min(have, it.quantity),
        supplierId: it.suppliers?.[0]?.supplier_id ?? null,
        supplierQty: Math.max(0, it.quantity - Math.min(have, it.quantity)),
      };
    }
    return out;
  });

  const totals = useMemo(() => {
    let avail = 0, unavail = 0, partial = 0;
    for (const it of app.items) {
      const have = it.warehouse_available_quantity ?? 0;
      if (have >= it.quantity) avail++;
      else if (have > 0) partial++;
      else unavail++;
    }
    return { avail, unavail, partial, total: app.items.length };
  }, [app.items]);

  const allInStock = totals.avail === totals.total;

  const setDec = (id: number, patch: Partial<Decision>) =>
    setDecisions((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const selectAllAvailable = () => {
    const next: Record<number, Decision> = {};
    for (const it of app.items) {
      const have = it.warehouse_available_quantity ?? 0;
      const cur = decisions[it.id];
      next[it.id] = { ...cur, selected: have > 0, warehouseQty: Math.min(have, it.quantity) };
    }
    setDecisions(next);
  };

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true); setErr(null);
    try { await fn(); setOk(msg); await onChanged(); }
    catch (e) { setErr(e as { message: string }); }
    finally { setBusy(false); }
  };

  const routeWh = () => run(() => api.storeRouteWarehouse(app.id), `Заявка #${app.id} отправлена на склад`);

  const submitProposal = async () => {
    const items: ProposalItemPayload[] = [];
    for (const it of app.items) {
      const d = decisions[it.id];
      if (!d.selected) {
        items.push({
          application_item_id: it.id,
          proposed_warehouse_quantity: 0,
          proposed_supplier_quantity: 0,
          proposed_action: "exclude",
          supplier_id: null,
        });
        continue;
      }
      const wq = Math.max(0, Math.min(d.warehouseQty, it.warehouse_available_quantity ?? 0, it.quantity));
      const sq = Math.max(0, Math.min(d.supplierQty, it.quantity - wq));
      const action: "warehouse" | "supplier" = sq > 0 ? "supplier" : "warehouse";
      items.push({
        application_item_id: it.id,
        proposed_warehouse_quantity: wq,
        proposed_supplier_quantity: sq,
        proposed_action: action,
        supplier_id: action === "supplier" ? d.supplierId : null,
      });
    }
    await run(() => api.storeCreateProposal(app.id, message.trim(), items),
              `Предложение по заявке #${app.id} отправлено покупателю`);
    setProposalOpen(false); setMessage("");
  };

  const confirmReject = async () => {
    if (!reason.trim()) { setErr({ message: "Укажите причину отказа" }); return; }
    await run(() => api.storeRejectApp(app.id, reason.trim()), `Заявка #${app.id} отклонена`);
    setRejectOpen(false); setReason("");
  };

  return (
    <div className="card p-4 sm:p-5 space-y-3 animate-fade-up">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="font-bold text-base">Заявка #{app.id} · покупатель #{app.customer_id}</div>
          <div className="muted text-xs">
            {new Date(app.created_at).toLocaleString("ru-RU")} · сумма {fmt(Number(app.total_amount))}
          </div>
        </div>
        <StatusBadge status={app.status} animated />
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <IconBadge icon={Package} tone="emerald">В наличии: {totals.avail}/{totals.total}</IconBadge>
        {totals.partial > 0 && <IconBadge icon={AlertTriangle} tone="amber">Частично: {totals.partial}</IconBadge>}
        {totals.unavail > 0 && <IconBadge icon={XCircle} tone="rose">Нет: {totals.unavail}</IconBadge>}
      </div>

      <button onClick={() => setExpanded((v) => !v)} className="text-sm font-semibold text-brand-600 inline-flex items-center gap-1">
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {expanded ? "Свернуть позиции" : "Развернуть позиции"}
      </button>

      {expanded && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline btn-sm" onClick={selectAllAvailable}>
              <CheckSquare className="h-4 w-4" /> Выбрать всё доступное
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Вкл.</th><th>Товар</th><th>Заказано</th><th>На складе</th><th>Со склада</th><th>От поставщика</th>
                </tr>
              </thead>
              <tbody>
                {app.items.map((it) => {
                  const d = decisions[it.id];
                  const have = it.warehouse_available_quantity ?? 0;
                  const enough = have >= it.quantity;
                  return (
                    <tr key={it.id} className={!d.selected ? "opacity-60" : ""}>
                      <td>
                        <button onClick={() => setDec(it.id, { selected: !d.selected })} aria-label="Toggle">
                          {d.selected ? <CheckSquare className="h-5 w-5 text-brand-600" /> : <Square className="h-5 w-5 text-slate-400" />}
                        </button>
                      </td>
                      <td>
                        <div className="font-medium">{it.product_name}</div>
                        <div className="muted text-xs">{it.category_name || "—"} · {fmt(Number(it.unit_price))}</div>
                      </td>
                      <td className="tabular-nums">{it.quantity}</td>
                      <td className={`tabular-nums font-semibold ${!enough ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {have}{!enough && have > 0 ? " (частично)" : ""}
                      </td>
                      <td>
                        <input type="number" min={0} max={Math.min(have, it.quantity)}
                               className="input h-9 w-20 tabular-nums" value={d.warehouseQty}
                               onChange={(e) => setDec(it.id, { warehouseQty: Math.max(0, Number(e.target.value || 0)) })}
                               disabled={!d.selected || have === 0} />
                      </td>
                      <td>
                        {it.suppliers && it.suppliers.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            <select className="select h-9 min-w-[10rem]" value={d.supplierId ?? ""}
                                    disabled={!d.selected}
                                    onChange={(e) => setDec(it.id, { supplierId: e.target.value ? Number(e.target.value) : null })}>
                              <option value="">— не использовать —</option>
                              {it.suppliers.map((s) => (
                                <option key={s.supplier_id} value={s.supplier_id}>
                                  {s.supplier_name} · {s.lead_time_days} дн · {fmt(Number(s.unit_price))}
                                </option>
                              ))}
                            </select>
                            <input type="number" min={0} max={it.quantity - d.warehouseQty}
                                   className="input h-9 w-20 tabular-nums" value={d.supplierQty}
                                   disabled={!d.selected || !d.supplierId}
                                   onChange={(e) => setDec(it.id, { supplierQty: Math.max(0, Number(e.target.value || 0)) })} />
                            {d.supplierId && (
                              <span className="muted text-xs">
                                <Calendar className="inline h-3 w-3 mr-1" />
                                ~{dateFmt(it.suppliers.find((s) => s.supplier_id === d.supplierId)?.estimated_delivery_date)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="muted text-xs">нет поставщиков</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {allInStock && (
          <button disabled={busy} className="btn-success" onClick={routeWh}>
            <Send className="h-4 w-4" /> Принять и на склад полностью
          </button>
        )}
        <button disabled={busy} className="btn-primary" onClick={() => setProposalOpen(true)}>
          <MessageSquare className="h-4 w-4" /> Создать предложение покупателю
        </button>
        <button disabled={busy} className="btn-danger" onClick={() => setRejectOpen(true)}>
          <XCircle className="h-4 w-4" /> Отклонить целиком
        </button>
      </div>

      <Modal open={proposalOpen} onClose={() => setProposalOpen(false)}
             title={`Предложение по заявке #${app.id}`}
             footer={
               <>
                 <button className="btn-ghost" onClick={() => setProposalOpen(false)}>Отмена</button>
                 <button className="btn-primary" onClick={submitProposal} disabled={busy}>
                   <Send className="h-4 w-4" /> Отправить покупателю
                 </button>
               </>
             }>
        <p className="muted">
          Покупатель сможет выбрать: получить только доступное со склада, заказать часть у поставщика, или отменить заявку.
          Уточните позиции выше перед отправкой.
        </p>
        <div>
          <label className="label">Сообщение покупателю (опционально)</label>
          <textarea className="textarea" rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
                    placeholder="Часть товаров можем поставить со склада, остальное — через поставщика…" />
        </div>
      </Modal>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)}
             title={`Отклонить заявку #${app.id}`}
             footer={
               <>
                 <button className="btn-ghost" onClick={() => setRejectOpen(false)}>Отмена</button>
                 <button className="btn-danger" onClick={confirmReject} disabled={busy}>Подтвердить</button>
               </>
             }>
        <label className="label">Причина отказа</label>
        <textarea className="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  );
}

// silence unused import for ApplicationItem helper
export type _Unused = ApplicationItem;
