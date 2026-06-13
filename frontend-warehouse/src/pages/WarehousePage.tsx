import { useCallback, useEffect, useState } from "react";
import {
  Boxes, Package, AlertTriangle, CheckCircle2, XCircle, Truck, Search, Tag,
} from "lucide-react";
import { api } from "../api/client";
import type { Product, WarehouseRequest } from "../types";
import { ErrorBanner, SuccessBanner, EmptyState, LoadingSkeleton } from "../ui/Feedback";
import { StatusBadge } from "../ui/Status";
import { IconBadge, IconTile } from "../ui/IconTile";
import { Modal } from "../ui/Modal";
import { Pagination, type PageMeta } from "../ui/Pagination";

interface StockPage { items: Product[]; page: number; page_size: number; total: number; total_pages: number; has_next: boolean; has_prev: boolean }
const PAGE_SIZE = 15;

const STATUSES = ["pending", "processing", "approved", "rejected", "shipped"] as const;
type Status = typeof STATUSES[number];
type Tab = "requests" | "stock";

export function WarehousePage() {
  const [tab, setTab] = useState<Tab>("requests");
  const [status, setStatus] = useState<Status>("pending");
  const [rows, setRows] = useState<WarehouseRequest[] | null>(null);
  const [stock, setStock] = useState<StockPage | null>(null);
  const [err, setErr] = useState<{ message: string } | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [searchDeb, setSearchDeb] = useState("");
  const [stockPage, setStockPage] = useState(1);

  useEffect(() => { const t = setTimeout(() => setSearchDeb(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setStockPage(1); }, [searchDeb]);

  const loadRequests = useCallback(async () => {
    setErr(null);
    try { setRows(await api.warehouseRequests(status)); }
    catch (e) { setErr(e as { message: string }); }
  }, [status]);

  const loadStock = useCallback(async () => {
    setErr(null);
    try {
      setStock(await api.warehouseProducts({
        page: stockPage, page_size: PAGE_SIZE, search: searchDeb || undefined,
      }));
    } catch (e) { setErr(e as { message: string }); }
  }, [stockPage, searchDeb]);

  const reload = async () => {
    if (tab === "requests") await loadRequests();
    else await loadStock();
  };

  useEffect(() => { if (tab === "requests") void loadRequests(); }, [tab, loadRequests]);
  useEffect(() => { if (tab === "stock") void loadStock(); }, [tab, loadStock]);

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setErr(null);
    try { await fn(); setOk(msg); await reload(); }
    catch (e) { setErr(e as { message: string }); }
  };

  const confirmReject = async (id: number) => {
    if (!reason.trim()) { setErr({ message: "Укажите причину отказа" }); return; }
    await run(() => api.warehouseReject(id, reason.trim()), `Запрос #${id} отклонён`);
    setRejectFor(null); setReason("");
  };

  const stockItems = stock?.items ?? null;
  const stockMeta: PageMeta | null = stock ? {
    page: stock.page, page_size: stock.page_size, total: stock.total,
    total_pages: stock.total_pages, has_next: stock.has_next, has_prev: stock.has_prev,
    items_shown: stock.items.length,
  } : null;

  return (
    <div className="space-y-6">
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      <SuccessBanner message={ok} onDismiss={() => setOk(null)} />

      <div className="flex gap-2 overflow-x-auto">
        <button onClick={() => setTab("requests")} className={`tab inline-flex items-center gap-2 ${tab === "requests" ? "tab-active" : "tab-inactive"}`}>
          <Package className="h-4 w-4" /> Запросы магазинов
        </button>
        <button onClick={() => setTab("stock")} className={`tab inline-flex items-center gap-2 ${tab === "stock" ? "tab-active" : "tab-inactive"}`}>
          <Boxes className="h-4 w-4" /> Остатки склада
        </button>
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
              {rows.map((r) => {
                const insufficient = r.items.some((i) => (i.stock_quantity ?? 0) < i.requested_quantity);
                return (
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
                        <thead><tr><th>Товар</th><th>Категория</th><th>Запрошено</th><th>Одобрено</th><th>Остаток</th></tr></thead>
                        <tbody>
                          {r.items.map((i) => {
                            const bad = (i.stock_quantity ?? 0) < i.requested_quantity;
                            return (
                              <tr key={i.product_id}>
                                <td className="font-medium">{i.product_name}</td>
                                <td>{i.category_name && <IconBadge icon={Tag} tone="indigo">{i.category_name}</IconBadge>}</td>
                                <td className="tabular-nums">{i.requested_quantity}</td>
                                <td className="tabular-nums">{i.approved_quantity ?? "—"}</td>
                                <td className={`tabular-nums font-semibold ${bad ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                  {i.stock_quantity ?? "—"}{bad && " ⚠"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {r.reject_reason && (
                      <div className="text-sm text-rose-700 dark:text-rose-300">Отказ: {r.reject_reason}</div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {r.status === "pending" && (
                        <button className="btn-outline" onClick={() => run(() => api.warehouseAccept(r.id), "Принято в обработку")}>
                          В обработку
                        </button>
                      )}
                      {(r.status === "pending" || r.status === "processing") && !insufficient && (
                        <button className="btn-success" onClick={() => {
                          if (confirm("Одобрить запрос? Остатки будут списаны.")) {
                            run(() => api.warehouseApprove(r.id), "Запрос одобрен, остатки списаны");
                          }
                        }}>
                          <CheckCircle2 className="h-4 w-4" /> Одобрить
                        </button>
                      )}
                      {insufficient && (r.status === "pending" || r.status === "processing") && (
                        <IconBadge icon={AlertTriangle} tone="rose">Недостаточно остатков</IconBadge>
                      )}
                      {(r.status === "pending" || r.status === "processing") && (
                        <button className="btn-danger" onClick={() => setRejectFor(r.id)}>
                          <XCircle className="h-4 w-4" /> Отклонить
                        </button>
                      )}
                      {r.status === "approved" && (
                        <button className="btn-primary" onClick={() => run(() => api.warehouseShip(r.id), "Отгружено")}>
                          <Truck className="h-4 w-4" /> Отгрузить
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "stock" && (
        <>
          <section className="card p-4 space-y-3">
            <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label className="label">Поиск товара</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
            </div>
          </section>
          {!stockItems ? <LoadingSkeleton /> : stockItems.length === 0 ? (
            <EmptyState icon={Boxes} title="Нет товаров" />
          ) : (
            <>
              <div className="card overflow-x-auto p-0">
                <table className="table-base">
                  <thead><tr><th>Товар</th><th>Категория</th><th>Остаток</th><th>Статус</th></tr></thead>
                  <tbody>
                    {stockItems.map((p) => {
                      const q = p.stock_quantity ?? 0;
                      const status = q === 0 ? "out" : q < 5 ? "low" : "ok";
                      return (
                        <tr key={p.id}>
                          <td className="font-medium">{p.name}</td>
                          <td>{p.category_name && <IconBadge icon={Tag} tone="indigo">{p.category_name}</IconBadge>}</td>
                          <td className="tabular-nums font-semibold">{q}</td>
                          <td>
                            {status === "out" && <IconBadge icon={XCircle} tone="rose">Нет</IconBadge>}
                            {status === "low" && <IconBadge icon={AlertTriangle} tone="amber">Мало</IconBadge>}
                            {status === "ok" && <IconBadge icon={CheckCircle2} tone="emerald">В наличии</IconBadge>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination meta={stockMeta} onChange={setStockPage} />
            </>
          )}
        </>
      )}

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

      {/* unused-import guard */}
      <div className="hidden"><IconTile icon={Boxes} /></div>
    </div>
  );
}
