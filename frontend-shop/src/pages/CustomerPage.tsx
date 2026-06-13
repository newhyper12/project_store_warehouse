import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, Filter, ShoppingCart, Plus, Minus, Package, Tag, Truck, Calendar,
  MessageSquare, ArrowRight, XCircle, Inbox, ChevronDown, ChevronUp,
} from "lucide-react";
import { api } from "../api/client";
import type { Category, OrderApplication, Product } from "../types";
import { ErrorBanner, SuccessBanner, EmptyState, LoadingSkeleton } from "../ui/Feedback";
import { IconTile, IconBadge } from "../ui/IconTile";
import { StatusBadge } from "../ui/Status";
import { RadioCardGroup } from "../ui/RadioCard";
import { Pagination, type PageMeta } from "../ui/Pagination";

type Decision = "accept_partial_warehouse_only" | "accept_split_warehouse_and_supplier" | "cancel_application";
type Sort = "name" | "price_asc" | "price_desc" | "category" | "stock";

interface ProductsPage {
  items: Product[]; page: number; page_size: number;
  total: number; total_pages: number; has_next: boolean; has_prev: boolean;
}

const PAGE_SIZE = 15;
const fmt = (n: number) => Number(n).toLocaleString("ru-RU") + " ₽";
const dateFmt = (s?: string | null) => (s ? new Date(s).toLocaleDateString("ru-RU") : "—");

export function CustomerPage() {
  const [resp, setResp] = useState<ProductsPage | null>(null);
  const [cats, setCats] = useState<Category[] | null>(null);
  const [apps, setApps] = useState<OrderApplication[] | null>(null);
  // Cart stores both quantity and a snapshot of name+price from the time the
  // user added the item, so that the cart UI keeps working when the user
  // navigates to other pages of the paginated catalog.
  const [cart, setCart] = useState<Record<number, { qty: number; name: string; price: number }>>({});
  const [err, setErr] = useState<{ message: string } | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [searchDeb, setSearchDeb] = useState("");
  const [catFilter, setCatFilter] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>("name");
  const [onlyAvail, setOnlyAvail] = useState(false);
  const [page, setPage] = useState(1);

  // debounce search
  useEffect(() => { const t = setTimeout(() => setSearchDeb(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  // reset page when filters/search change
  useEffect(() => { setPage(1); }, [searchDeb, catFilter, sort, onlyAvail]);

  const loadProducts = useCallback(async () => {
    try {
      const data: ProductsPage = await api.customerProducts({
        page, page_size: PAGE_SIZE,
        search: searchDeb || undefined,
        category_id: catFilter ?? undefined,
        only_available: onlyAvail || undefined,
        sort,
      });
      setResp(data);
    } catch (e) { setErr(e as { message: string }); }
  }, [page, searchDeb, catFilter, sort, onlyAvail]);

  const loadMeta = useCallback(async () => {
    try {
      const [c, a] = await Promise.all([api.customerCategories(), api.customerMyApplications()]);
      setCats(c); setApps(a);
    } catch (e) { setErr(e as { message: string }); }
  }, []);

  useEffect(() => { void loadProducts(); }, [loadProducts]);
  useEffect(() => { void loadMeta(); }, [loadMeta]);

  const reload = async () => { await Promise.all([loadProducts(), loadMeta()]); };

  const add = (p: Product, delta: number) =>
    setCart((c) => {
      const cur = c[p.id]?.qty || 0;
      const n = Math.max(0, cur + delta);
      const out = { ...c };
      if (n === 0) delete out[p.id];
      else out[p.id] = { qty: n, name: p.name, price: Number(p.price) };
      return out;
    });

  const submit = async () => {
    const items = Object.entries(cart).map(([pid, v]) => ({ product_id: Number(pid), quantity: v.qty }));
    if (!items.length) { setErr({ message: "Корзина пуста" }); return; }
    setBusy(true);
    try {
      await api.customerCreateApplication(items);
      setCart({}); setOk("Заявка отправлена в магазин на рассмотрение");
      await reload();
    } catch (e) { setErr(e as { message: string }); }
    finally { setBusy(false); }
  };

  const filtered = resp?.items ?? null;
  const meta: PageMeta | null = resp ? {
    page: resp.page, page_size: resp.page_size, total: resp.total,
    total_pages: resp.total_pages, has_next: resp.has_next, has_prev: resp.has_prev,
    items_shown: resp.items.length,
  } : null;

  const cartTotal = useMemo(
    () => Object.values(cart).reduce((acc, v) => acc + v.price * v.qty, 0),
    [cart],
  );
  const cartQty = (id: number) => cart[id]?.qty || 0;

  return (
    <div className="space-y-6">
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      <SuccessBanner message={ok} onDismiss={() => setOk(null)} />

      {/* Filters */}
      <section className="card p-4 sm:p-5 space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
          <div>
            <label className="label">Поиск</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Название товара…"
                     value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <div>
              <label className="label">Сортировка</label>
              <select className="select min-w-[180px]" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="name">По названию</option>
                <option value="price_asc">Цена ↑</option>
                <option value="price_desc">Цена ↓</option>
                <option value="category">По категории</option>
                <option value="stock">По остатку</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <button onClick={() => setCatFilter(null)}
                  className={`tab ${catFilter === null ? "tab-active" : "tab-inactive"}`}>Все</button>
          {cats?.map((c) => (
            <button key={c.id} onClick={() => setCatFilter(c.id)}
                    className={`tab ${catFilter === c.id ? "tab-active" : "tab-inactive"}`}>{c.name}</button>
          ))}
          <label className="ml-auto inline-flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded accent-brand-600"
                   checked={onlyAvail} onChange={(e) => setOnlyAvail(e.target.checked)} />
            Только в наличии
          </label>
        </div>
      </section>

      {/* Catalog */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="h2">Каталог</h2>
          {meta && <span className="muted text-sm">Найдено товаров: {meta.total.toLocaleString("ru-RU")}</span>}
        </div>
        {!filtered ? <LoadingSkeleton rows={3} /> : filtered.length === 0 ? (
          <EmptyState icon={Package} title="Ничего не найдено" hint="Сбросьте фильтры или измените запрос" />
        ) : (
          <>
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => {
                const inStock = (p.stock_quantity ?? 0) > 0;
                const supplier = p.suppliers?.[0];
                return (
                  <div key={p.id} className="card card-hover p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <IconTile icon={Package} tone={inStock ? "blue" : "slate"} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold leading-tight truncate">{p.name}</div>
                        {p.category_name && <IconBadge icon={Tag} tone="indigo">{p.category_name}</IconBadge>}
                      </div>
                    </div>
                    <p className="muted text-sm line-clamp-2 min-h-[2.5rem]">{p.description}</p>
                    <div className="flex items-center gap-2 text-xs">
                      {inStock ? (
                        <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                          Доступно: {p.stock_quantity}
                        </span>
                      ) : supplier ? (
                        <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          <Truck className="h-3.5 w-3.5" /> Под заказ ~{supplier.lead_time_days} дн.
                        </span>
                      ) : (
                        <span className="badge bg-slate-200 text-slate-700">Нет в наличии</span>
                      )}
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <div className="text-lg font-black">{fmt(Number(p.price))}</div>
                      <div className="flex items-center gap-1.5">
                        <button className="btn-outline btn-sm h-9 w-9 p-0" onClick={() => add(p, -1)} aria-label="−">
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-7 text-center font-bold tabular-nums">{cartQty(p.id)}</span>
                        <button className="btn-primary btn-sm h-9 w-9 p-0" onClick={() => add(p, +1)} aria-label="+">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination meta={meta} onChange={setPage} />
          </>
        )}
      </section>

      {/* Sticky cart bar */}
      <section className="card p-4 flex items-center justify-between gap-3 flex-wrap sticky bottom-3 z-10">
        <div className="flex items-center gap-3">
          <IconTile icon={ShoppingCart} tone="emerald" />
          <div>
            <div className="font-bold">Корзина</div>
            <div className="muted text-xs">
              {Object.keys(cart).length} поз. · {fmt(cartTotal)}
            </div>
          </div>
        </div>
        <button className="btn-primary" disabled={busy || Object.keys(cart).length === 0} onClick={submit}>
          <ArrowRight className="h-4 w-4" /> Отправить заявку
        </button>
      </section>

      {/* My applications */}
      <section className="space-y-3">
        <h2 className="h2">Мои заявки</h2>
        {!apps ? <LoadingSkeleton rows={2} /> : apps.length === 0 ? (
          <EmptyState icon={Inbox} title="Заявок пока нет" hint="Соберите корзину и отправьте первую заявку" />
        ) : (
          <div className="space-y-3">
            {apps.map((a) => <CustomerAppCard key={a.id} app={a} onChanged={reload} setErr={setErr} setOk={setOk} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function CustomerAppCard({ app, onChanged, setErr, setOk }:
  { app: OrderApplication; onChanged: () => Promise<void>;
    setErr: (e: { message: string } | null) => void;
    setOk: (m: string | null) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const proposal = app.proposal && app.proposal.status === "pending_customer_decision" ? app.proposal : null;
  const [decision, setDecision] = useState<Decision | null>(null);

  const respond = async (d: Decision) => {
    setBusy(true);
    try {
      await api.customerRespondProposal(app.id, d);
      setOk("Решение отправлено");
      await onChanged();
    } catch (e) { setErr(e as { message: string }); }
    finally { setBusy(false); }
  };

  const wantsWarehouse = proposal?.items.filter((i) => i.proposed_warehouse_quantity > 0) || [];
  const wantsSupplier  = proposal?.items.filter((i) => i.proposed_action === "supplier" && i.proposed_supplier_quantity > 0) || [];

  return (
    <div className="card p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-bold text-base">Заявка #{app.id}</div>
          <div className="muted text-xs">{new Date(app.created_at).toLocaleString("ru-RU")} · {fmt(Number(app.total_amount))}</div>
        </div>
        <StatusBadge status={app.status} animated={app.status === "pending_customer_decision"} />
      </div>

      {app.reject_reason && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
          Причина отказа: {app.reject_reason}
        </div>
      )}

      {proposal && (
        <div className="rounded-2xl border-2 border-violet-300 dark:border-violet-700 bg-violet-50/70 dark:bg-violet-950/30 p-4 space-y-3 animate-scale-in">
          <div className="flex items-start gap-3">
            <IconTile icon={MessageSquare} tone="violet" size="md" />
            <div>
              <div className="font-bold">Магазин предложил частичное выполнение</div>
              {proposal.message && <div className="muted text-sm mt-1">{proposal.message}</div>}
            </div>
          </div>
          <ul className="space-y-1.5 text-sm">
            {proposal.items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{i.product_name}</span>
                <span className="muted">×{i.requested_quantity}</span>
                {i.proposed_warehouse_quantity > 0 && (
                  <IconBadge icon={Package} tone="emerald">Со склада: {i.proposed_warehouse_quantity}</IconBadge>
                )}
                {i.proposed_action === "supplier" && i.proposed_supplier_quantity > 0 && (
                  <IconBadge icon={Truck} tone="amber">
                    Поставщик{i.supplier_name ? ` «${i.supplier_name}»` : ""}: {i.proposed_supplier_quantity}
                    {i.estimated_delivery_date && ` · до ${dateFmt(i.estimated_delivery_date)}`}
                  </IconBadge>
                )}
                {i.proposed_action === "exclude" && (
                  <IconBadge icon={XCircle} tone="slate">Исключено</IconBadge>
                )}
              </li>
            ))}
          </ul>
          <div className="space-y-3 pt-1">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Выберите способ выполнения заявки:
            </div>
            <RadioCardGroup<Decision>
              name={`decision-${app.id}`}
              value={decision}
              onChange={setDecision}
              options={[
                {
                  value: "accept_partial_warehouse_only",
                  title: "Только товары со склада",
                  description: "Получить сразу только те позиции, что есть на складе. Остальные будут исключены из заявки.",
                  icon: <Package className="h-5 w-5" />,
                  badge: wantsWarehouse.length > 0 ? `${wantsWarehouse.length} поз.` : undefined,
                  disabled: wantsWarehouse.length === 0,
                },
                {
                  value: "accept_split_warehouse_and_supplier",
                  title: "Склад + поставщик",
                  description: "Получить доступные товары со склада, а недостающие — от поставщика. Поставка от поставщика занимает больше времени.",
                  icon: <Truck className="h-5 w-5" />,
                  badge: wantsSupplier.length > 0 ? `${wantsSupplier.length} от поставщика` : undefined,
                  disabled: wantsSupplier.length === 0,
                },
                {
                  value: "cancel_application",
                  title: "Отменить заявку",
                  description: "Полностью отменить заявку. Никакие запросы на склад или поставщику созданы не будут.",
                  icon: <XCircle className="h-5 w-5" />,
                },
              ]}
            />
            <div className="flex gap-2 pt-1">
              <button
                disabled={busy || !decision}
                className={decision === "cancel_application" ? "btn-danger" : "btn-primary"}
                onClick={() => decision && respond(decision)}
              >
                <ArrowRight className="h-4 w-4" /> Подтвердить выбор
              </button>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => setExpanded((v) => !v)} className="text-sm font-semibold text-brand-600 hover:underline inline-flex items-center gap-1">
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {expanded ? "Свернуть" : "Подробности и история"}
      </button>

      {expanded && (
        <div className="space-y-3 pt-1">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="table-base">
              <thead><tr><th>Товар</th><th>Заказано</th><th>Подтверждено</th><th>Источник</th><th>Дата</th></tr></thead>
              <tbody>
                {app.items.map((i) => (
                  <tr key={i.id}>
                    <td><div className="font-medium">{i.product_name}</div><div className="muted text-xs">{i.category_name}</div></td>
                    <td className="tabular-nums">{i.quantity}</td>
                    <td className="tabular-nums">{i.approved_quantity ?? "—"}</td>
                    <td>
                      {i.fulfillment_source === "warehouse" && <IconBadge icon={Package} tone="emerald">Склад</IconBadge>}
                      {i.fulfillment_source === "supplier" && <IconBadge icon={Truck} tone="amber">Поставщик</IconBadge>}
                      {i.fulfillment_source === "excluded" && <IconBadge icon={XCircle} tone="slate">Исключён</IconBadge>}
                      {i.fulfillment_source === "undecided" && <span className="muted text-xs">—</span>}
                    </td>
                    <td className="text-xs"><Calendar className="inline h-3 w-3 mr-1 text-slate-400" />{dateFmt(i.estimated_delivery_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {app.history.length > 0 && <StatusTimeline app={app} />}
        </div>
      )}
    </div>
  );
}

function StatusTimeline({ app }: { app: OrderApplication }) {
  return (
    <div>
      <div className="font-semibold text-sm mb-2">История</div>
      <ul className="space-y-2">
        {app.history.map((h, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <StatusBadge status={h.status} />
            <div className="min-w-0 flex-1">
              <div className="muted text-xs">{new Date(h.created_at).toLocaleString("ru-RU")}</div>
              {h.note && <div>{h.note}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
