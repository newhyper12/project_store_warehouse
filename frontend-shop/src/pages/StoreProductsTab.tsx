import { useEffect, useState, useCallback } from "react";
import { Plus, Tag, Package, Pencil, Save, X } from "lucide-react";
import { apiProducts } from "../api/client";
import { ErrorBanner, SuccessBanner, EmptyState, LoadingSkeleton } from "../ui/Feedback";
import { Modal } from "../ui/Modal";
import { IconBadge, IconTile } from "../ui/IconTile";
import { Pagination, type PageMeta } from "../ui/Pagination";

interface Category { id: number; name: string }
interface StoreProduct {
  id: number; name: string; description: string;
  price: number | string; stock_quantity: number;
  sku?: string | null; is_active: boolean;
  category_id?: number | null; category_name?: string | null;
  suppliers_count: number;
}
interface PageResp { items: StoreProduct[]; page: number; page_size: number; total: number; total_pages: number; has_next: boolean; has_prev: boolean }

const fmt = (n: number | string) => Number(n).toLocaleString("ru-RU") + " ₽";
const PAGE_SIZE = 15;

export function StoreProductsTab() {
  const [resp, setResp] = useState<PageResp | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [filterCat, setFilterCat] = useState<number | "">("");
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<{ message: string } | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [modal, setModal] = useState<null | StoreProduct | "new">(null);
  const [loading, setLoading] = useState(false);

  // debounce search input
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [qDebounced, filterCat]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data: PageResp = await apiProducts.storeProductsManaged({
        page, page_size: PAGE_SIZE,
        search: qDebounced || undefined,
        category_id: filterCat === "" ? undefined : filterCat,
      });
      setResp(data);
    } catch (e) { setErr(e as { message: string }); }
    finally { setLoading(false); }
  }, [page, qDebounced, filterCat]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { apiProducts.storeCategories().then(setCats).catch((e) => setErr(e)); }, []);

  const list = resp?.items ?? [];
  const meta: PageMeta | null = resp ? {
    page: resp.page, page_size: resp.page_size, total: resp.total,
    total_pages: resp.total_pages, has_next: resp.has_next, has_prev: resp.has_prev,
    items_shown: list.length,
  } : null;

  return (
    <div className="space-y-4">
      <ErrorBanner error={err} onDismiss={() => setErr(null)} />
      <SuccessBanner message={ok} onDismiss={() => setOk(null)} />

      <div className="card p-4 flex flex-wrap items-center gap-3">
        <input className="input flex-1 min-w-[180px]" placeholder="Поиск товара…"
               value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select w-auto min-w-[160px]" value={filterCat}
                onChange={(e) => setFilterCat(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Все категории</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setModal("new")}>
          <Plus className="h-4 w-4" /> Добавить товар
        </button>
      </div>

      {!resp && loading ? <LoadingSkeleton /> : list.length === 0 ? (
        <EmptyState icon={Package} title="Нет товаров по фильтру" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <div key={p.id} className="card p-4 flex flex-col gap-2 animate-fade-up">
                <div className="flex items-start gap-3">
                  <IconTile icon={Package} tone={p.is_active ? "emerald" : "slate"} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{p.name}</div>
                    <div className="text-xs muted">{p.sku || "—"}</div>
                  </div>
                  <button className="btn-ghost btn-sm" onClick={() => setModal(p)}><Pencil className="h-4 w-4" /></button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {p.category_name && <IconBadge icon={Tag} tone="indigo">{p.category_name}</IconBadge>}
                  <span className="badge bg-slate-100 dark:bg-slate-800">Склад: <b className="ml-1">{p.stock_quantity}</b></span>
                  <span className="badge bg-slate-100 dark:bg-slate-800">Поставщиков: <b className="ml-1">{p.suppliers_count}</b></span>
                  {!p.is_active && <span className="badge bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">Неактивен</span>}
                </div>
                <div className="muted text-sm line-clamp-2">{p.description}</div>
                <div className="font-bold mt-1">{fmt(p.price)}</div>
              </div>
            ))}
          </div>
          <Pagination meta={meta} onChange={setPage} />
        </>
      )}

      <ProductFormModal
        open={!!modal}
        onClose={() => setModal(null)}
        initial={modal === "new" ? null : modal}
        cats={cats}
        onSaved={async (msg) => { setOk(msg); setModal(null); await reload(); }}
        onError={setErr}
      />
    </div>
  );
}

function ProductFormModal({ open, onClose, initial, cats, onSaved, onError }: {
  open: boolean; onClose: () => void;
  initial: StoreProduct | null;
  cats: Category[];
  onSaved: (msg: string) => Promise<void>;
  onError: (e: { message: string } | null) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [stock, setStock] = useState("0");
  const [sku, setSku] = useState("");
  const [catId, setCatId] = useState<number | "">("");
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name || "");
    setDescription(initial?.description || "");
    setPrice(String(initial?.price ?? "0"));
    setStock(String(initial?.stock_quantity ?? 0));
    setSku(initial?.sku || "");
    setCatId(initial?.category_id ?? "");
    setIsActive(initial?.is_active ?? true);
  }, [open, initial]);

  const save = async () => {
    if (!name.trim()) { onError({ message: "Укажите название" }); return; }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(), description, price: Number(price),
        stock_quantity: Number(stock), sku: sku || null,
        category_id: catId === "" ? null : catId, is_active: isActive,
      };
      if (initial) await apiProducts.storeUpdateProduct(initial.id, payload);
      else await apiProducts.storeCreateProduct(payload);
      await onSaved(initial ? "Товар обновлён" : "Товар добавлен");
    } catch (e) { onError(e as { message: string }); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Редактировать товар" : "Новый товар"}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}><X className="h-4 w-4" />Отмена</button>
          <button className="btn-primary" disabled={busy} onClick={save}>
            <Save className="h-4 w-4" /> Сохранить
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div><label className="label">Название</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Описание</label>
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Цена</label>
            <input className="input" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <div><label className="label">На складе</label>
            <input className="input" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Категория</label>
            <select className="select" value={catId} onChange={(e) => setCatId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">— без категории —</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="label">Артикул</label>
            <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} /></div>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>Активен (показывать в каталоге)</span>
        </label>
      </div>
    </Modal>
  );
}
