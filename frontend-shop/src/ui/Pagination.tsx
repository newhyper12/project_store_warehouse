import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

export interface PageMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  items_shown?: number;
}

export function Pagination({
  meta,
  onChange,
}: {
  meta: PageMeta | null;
  onChange: (page: number) => void;
}) {
  const [jump, setJump] = useState("");
  useEffect(() => { setJump(""); }, [meta?.page]);

  if (!meta || meta.total === 0) return null;

  const totalPages = Math.max(1, meta.total_pages);
  const shown = meta.items_shown ?? Math.min(meta.page_size, Math.max(0, meta.total - (meta.page - 1) * meta.page_size));
  const apply = () => {
    const n = Math.floor(Number(jump));
    if (!Number.isFinite(n) || n < 1) return;
    const clamped = Math.min(totalPages, Math.max(1, n));
    if (clamped !== meta.page) onChange(clamped);
    setJump("");
  };

  return (
    <div className="card p-3 flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="muted">
        Найдено товаров:{" "}
        <b className="text-slate-700 dark:text-slate-200">{meta.total.toLocaleString("ru-RU")}</b>
        <span className="mx-2">·</span>
        Показано {shown} из {meta.page_size}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn-outline btn-sm"
          disabled={!meta.has_prev}
          onClick={() => onChange(meta.page - 1)}
        >
          <ChevronLeft className="h-4 w-4" /> Назад
        </button>
        <span className="tabular-nums">
          Страница <b>{meta.page}</b> из <b>{totalPages.toLocaleString("ru-RU")}</b>
        </span>
        <button
          className="btn-outline btn-sm"
          disabled={!meta.has_next}
          onClick={() => onChange(meta.page + 1)}
        >
          Вперед <ChevronRight className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1 ml-2">
          <input
            className="input h-9 w-20 text-center"
            type="number"
            min={1}
            max={totalPages}
            value={jump}
            placeholder="№"
            aria-label="Введите номер страницы"
            onChange={(e) => setJump(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
          />
          <button className="btn-primary btn-sm" onClick={apply} disabled={!jump}>
            <ArrowRight className="h-4 w-4" /> Перейти
          </button>
        </div>
      </div>
    </div>
  );
}
