import { useEffect, useState } from "react";
import { Plus, Tag, Package, Pencil, Save, X, Link as LinkIcon, Sparkles, Calendar } from "lucide-react";
import { apiProducts } from "../api/client";
import { ErrorBanner, SuccessBanner, EmptyState, LoadingSkeleton } from "../ui/Feedback";
import { Modal } from "../ui/Modal";
import { IconBadge, IconTile } from "../ui/IconTile";
import { RadioCardGroup } from "../ui/RadioCard";

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

const fmt = (n: number | string) => Number(n).toLocaleString("ru-RU") + " ₽";
const dateFmt = (s?: string | null) => (s ? new Date(s).toLocaleDateString("ru-RU") : "—");

type AddMode = "connect" | "create";

export function SupplierProductsTab() {
  const [list, setList] = useState<SupplierProduct[] | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<{ message: string } | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [editFor, setEditFor] = useState<SupplierProduct | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const reload = async () => {
    try {
      const [a, b] = await Promise.all([apiProducts.supplierProductsManaged(), apiProducts.supplierCategories()]);
      setList(a); setCats(b);
    } catch (e) { setErr(e as { message: string }); }
  };
  useEffect(() => { reload(); }, []);

  const filtered = (list || []).filter((p) => !q || p.product_name.toLowerCase().includes(q.toLowerCase()));

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

      {!list ? <LoadingSkeleton /> : filtered.length === 0 ? (
        <EmptyState icon={Package} title="В вашем каталоге пока нет товаров"
                    hint="Подключите существующий товар или создайте новый." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
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
    <Modal open={!!item} onClose={onClose} title={`Редактировать: ${item?.product_name ?? ""}`}>
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
        <div className="flex gap-2 pt-2 justify-end">
          <button className="btn-outline" onClick={onClose}><X className="h-4 w-4" />Отмена</button>
          <button className="btn-primary" disabled={busy} onClick={save}><Save className="h-4 w-4" />Сохранить</button>
        </div>
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
  const [global, setGlobal] = useState<GlobalProduct[] | null>(null);
  const [pickedId, setPickedId] = useState<number | null>(null);
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
    setMode("connect"); setPickedId(null);
    setPrice("0"); setLead("7"); setQty(""); setNotes("");
    setName(""); setDesc(""); setRetail("0"); setCatId("");
    apiProducts.supplierGlobalCatalog().then(setGlobal).catch((e) => onError(e));
  }, [open, onError]);

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
      await onSaved("Товар добавлен в каталог");
    } catch (e) { onError(e as { message: string }); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Добавить товар в каталог">
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
          <div>
            <label className="label">Товар</label>
            <select className="select" value={pickedId ?? ""} onChange={(e) => setPickedId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— выберите —</option>
              {(global || []).filter((g) => !g.already_supplied).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}{g.category_name ? ` · ${g.category_name}` : ""}
                </option>
              ))}
            </select>
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

        <div className="flex gap-2 pt-2 justify-end">
          <button className="btn-outline" onClick={onClose}><X className="h-4 w-4" />Отмена</button>
          <button className="btn-primary" disabled={busy} onClick={save}>
            <Save className="h-4 w-4" /> Добавить
          </button>
        </div>
      </div>
    </Modal>
  );
}
