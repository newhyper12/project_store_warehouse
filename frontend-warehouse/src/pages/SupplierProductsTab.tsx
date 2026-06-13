import { useEffect, useState, useCallback } from "react";
import { Plus, Tag, Package, Pencil, Save, X, Link as LinkIcon, Sparkles, Calendar, Search } from "lucide-react";
import { apiProducts } from "../api/client";
import { ErrorBanner, SuccessBanner, EmptyState, LoadingSkeleton } from "../ui/Feedback";
import { Modal } from "../ui/Modal";
import { IconBadge, IconTile } from "../ui/IconTile";
import { RadioCardGroup } from "../ui/RadioCard";
import { Pagination, type PageMeta } from "../ui/Pagination";

interface Category { id: number; name: string }
interface SupplierProduct {
  id: number; product_id: number; product_name: string;
  category_id?: number | null; category_name?: string | null;
  unit_price: number | string; lead_time_days: number;
  quantity_available?: number | null; notes?: string | null;
  estimated_delivery_date?: string | null; is_active: boolean;
}
interface GlobalProduct {
  id: number; name: string; description: string; price: number | string;
  category_id?: number | null; category_name?: string | null;
  already_supplied: boolean;
}
interface PageResp<T> { items: T[]; page: number; page_size: number; total: number; total_pages: number; has_next: boolean; has_prev: boolean }

const fmt = (n: number | string) => Number(n).toLocaleString("ru-RU") + " ₽";
const dateFmt = (s?: string | null) => (s ? new Date(s).toLocaleDateString("ru-RU") : "—");
const PAGE_SIZE = 15;

type AddMode = "connect" | "create";

export function SupplierProductsTab() {
  const [resp, setResp] = useState<PageResp<SupplierProduct> | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<{ message: string } | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [editFor, setEditFor] = useState<SupplierProduct | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => { const t = setTimeout(() => setQDebounced(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPage(1); }, [qDebounced]);

  const reload = useCallback(async () => {
    try {
      const data: PageResp<SupplierProduct> = await apiProducts.supplierProductsManaged({
        page, page_size: PAGE_SIZE, search: qDebounced || undefined,
      });
      setResp(data);
    } catch (e) { setErr(e as { message: string }); }
  }, [page, qDebounced]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { apiProducts.supplierCategories().then(setCats).catch((e) => setErr(e)); }, []);

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
        <input className="input flex-1 min-w-[180px]" placeholder="Поиск по моим товарам…"
               value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Добавить товар
        </button>
      </div>

      {!resp ? <LoadingSkeleton /> : list.length === 0 ? (
        <EmptyState icon={Package} title="В вашем каталоге пока нет товаров"
                    hint="Подключите существующий товар или создайте новый." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <div key={p.id} className="card p-4 flex flex-col gap-2 animate-fade-up">
                <div className="flex items-start gap-3">
                  <IconTile icon={Package} tone={p.is_active ? "emerald" : "slate"} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{p.product_name}</div>
                    {p.category_name && <IconBadge icon={Tag} tone="indigo">{p.category_name}</IconBadge>}
                  </div>
                  <button className="btn-ghost btn-sm" onClick={() => setEditFor(p)}><Pencil className="h-4 w-4" /></button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="badge bg-slate-100 dark:bg-slate-800">Цена: <b className="ml-1">{fmt(p.unit_price)}</b></span>
                  <span className="badge bg-slate-100 dark:bg-slate-800">Срок: <b className="ml-1">{p.lead_time_days} дн.</b></span>
                  {p.quantity_available != null && (
                    <span className="badge bg-slate-100 dark:bg-slate-800">Остаток: <b className="ml-1">{p.quantity_available}</b></span>
                  )}
                  {!p.is_active && <span className="badge bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">Неактивен</span>}
                </div>
                <div className="text-sm inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" /> Доставка ≈ {dateFmt(p.estimated_delivery_date)}
                </div>
                {p.notes && <div className="muted text-sm line-clamp-2">{p.notes}</div>}
              </div>
            ))}
          </div>
          <Pagination meta={meta} onChange={setPage} />
        </>
      )}

      <EditModal item={editFor} onClose={() => setEditFor(null)}
                 onSaved={async (m) => { setOk(m); setEditFor(null); await reload(); }}
                 onError={setErr} />
      <AddModal open={addOpen} onClose={() => setAddOpen(false)} cats={cats}
                onSaved={async (m) => { setOk(m); setAddOpen(false); await reload(); }}
                onError={setErr} />
    </div>
  );
}

function EditModal({ item, onClose, onSaved, onError }: {
  item: SupplierProduct | null; onClose: () => void;
  onSaved: (m: string) => Promise<void>;
  onError: (e: { message: string }) => void;
}) {
  const [price, setPrice] = useState("0");
  const [lead, setLead] = useState("7");
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!item) return;
    setPrice(String(item.unit_price ?? 0)); setLead(String(item.lead_time_days ?? 7));
    setQty(item.quantity_available == null ? "" : String(item.quantity_available));
    setNotes(item.notes || ""); setIsActive(item.is_active);
  }, [item]);
  const save = async () => {
    if (!item) return;
    setBusy(true);
    try {
      await apiProducts.supplierUpdateProduct(item.id, {
        unit_price: Number(price), lead_time_days: Number(lead),
        quantity_available: qty === "" ? null : Number(qty),
        notes: notes || null, is_active: isActive,
      });
      await onSaved("Сохранено");
    } catch (e) { onError(e as { message: string }); }
    finally { setBusy(false); }
  };
  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={`Редактировать: ${item?.product_name ?? ""}`}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}><X className="h-4 w-4" />Отмена</button>
          <button className="btn-primary" disabled={busy} onClick={save}><Save className="h-4 w-4" />Сохранить</button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Цена поставщика</label>
            <input className="input" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <div><label className="label">Срок поставки, дн.</label>
            <input className="input" type="number" min="0" value={lead} onChange={(e) => setLead(e.target.value)} /></div>
        </div>
        <div><label className="label">Доступное количество (опц.)</label>
          <input className="input" type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div><label className="label">Заметки</label>
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>Активен</span>
        </label>
      </div>
    </Modal>
  );
}

function AddModal({ open, onClose, cats, onSaved, onError }: {
  open: boolean; onClose: () => void; cats: Category[];
  onSaved: (m: string) => Promise<void>;
  onError: (e: { message: string }) => void;
}) {
  const [mode, setMode] = useState<AddMode>("connect");
  // connect: paginated global catalog with search
  const [gResp, setGResp] = useState<PageResp<GlobalProduct> | null>(null);
  const [gQ, setGQ] = useState(""); const [gQD, setGQD] = useState(""); const [gPage, setGPage] = useState(1);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [pickedName, setPickedName] = useState<string>("");

  const [price, setPrice] = useState("0");
  const [lead, setLead] = useState("7");
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");

  // create-new fields
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [retail, setRetail] = useState("0");
  const [catId, setCatId] = useState<number | "">("");

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode("connect"); setPickedId(null); setPickedName("");
    setPrice("0"); setLead("7"); setQty(""); setNotes("");
    setName(""); setDesc(""); setRetail("0"); setCatId("");
    setGQ(""); setGQD(""); setGPage(1);
  }, [open]);

  useEffect(() => { const t = setTimeout(() => setGQD(gQ.trim()), 300); return () => clearTimeout(t); }, [gQ]);
  useEffect(() => { setGPage(1); }, [gQD]);

  useEffect(() => {
    if (!open || mode !== "connect") return;
    apiProducts.supplierGlobalCatalog({
      page: gPage, page_size: PAGE_SIZE, search: gQD || undefined, only_not_supplied: true,
    }).then(setGResp).catch((e) => onError(e));
  }, [open, mode, gPage, gQD, onError]);

  const save = async () => {
    setBusy(true);
    try {
      if (mode === "connect") {
        if (!pickedId) { onError({ message: "Выберите товар" }); setBusy(false); return; }
        await apiProducts.supplierConnectProduct({
          product_id: pickedId, unit_price: Number(price),
          lead_time_days: Number(lead),
          quantity_available: qty === "" ? null : Number(qty),
          notes: notes || null, is_active: true,
        });
      } else {
        if (!name.trim()) { onError({ message: "Введите название" }); setBusy(false); return; }
        await apiProducts.supplierCreateAndSupply({
          name: name.trim(), description: desc, price: Number(retail),
          category_id: catId === "" ? null : catId,
          unit_price: Number(price), lead_time_days: Number(lead),
          quantity_available: qty === "" ? null : Number(qty),
          notes: notes || null,
        });
      }
      await onSaved(mode === "connect" ? "Товар подключён" : "Товар создан");
    } catch (e) { onError(e as { message: string }); }
    finally { setBusy(false); }
  };

  const gItems = gResp?.items ?? [];
  const gMeta: PageMeta | null = gResp ? {
    page: gResp.page, page_size: gResp.page_size, total: gResp.total,
    total_pages: gResp.total_pages, has_next: gResp.has_next, has_prev: gResp.has_prev,
    items_shown: gItems.length,
  } : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить товар"
      footer={
        <>
          <button className="btn-outline" onClick={onClose}><X className="h-4 w-4" />Отмена</button>
          <button className="btn-primary" disabled={busy} onClick={save}>
            <Save className="h-4 w-4" /> Добавить
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <RadioCardGroup<AddMode>
          name="add-mode"
          value={mode}
          onChange={setMode}
          columns={2}
          options={[
            { value: "connect", title: "Подключить существующий",
              description: "Выбрать товар из общего каталога и задать свою цену и срок.",
              icon: <LinkIcon className="h-5 w-5" /> },
            { value: "create", title: "Создать новый товар",
              description: "Добавить новый товар в систему и сразу указать вашу поставку.",
              icon: <Sparkles className="h-5 w-5" /> },
          ]}
        />

        {mode === "connect" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" placeholder="Поиск по каталогу…"
                     value={gQ} onChange={(e) => setGQ(e.target.value)} />
            </div>
            <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-200 dark:divide-slate-700">
              {gItems.length === 0 && (
                <div className="p-4 text-sm muted text-center">
                  {gResp ? "Ничего не найдено" : "Загрузка…"}
                </div>
              )}
              {gItems.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => { setPickedId(g.id); setPickedName(g.name); }}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 ${
                    pickedId === g.id ? "bg-brand-50 dark:bg-brand-900/30" : ""
                  }`}
                >
                  <Package className="h-4 w-4 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{g.name}</div>
                    <div className="text-xs muted truncate">
                      {g.category_name || "—"} · {fmt(g.price)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <Pagination meta={gMeta} onChange={setGPage} />
            {pickedName && (
              <div className="text-xs muted">Выбрано: <b>{pickedName}</b></div>
            )}
          </div>
        )}

        {mode === "create" && (
          <>
            <div><label className="label">Название</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label className="label">Описание</label>
              <textarea className="textarea" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Розничная цена</label>
                <input className="input" type="number" min="0" step="0.01" value={retail} onChange={(e) => setRetail(e.target.value)} /></div>
              <div><label className="label">Категория</label>
                <select className="select" value={catId} onChange={(e) => setCatId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">— без категории —</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Цена поставщика</label>
            <input className="input" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <div><label className="label">Срок поставки, дн.</label>
            <input className="input" type="number" min="0" value={lead} onChange={(e) => setLead(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Доступное кол-во</label>
            <input className="input" type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div><label className="label">Заметки</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
      </div>
    </Modal>
  );
}
