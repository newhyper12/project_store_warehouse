# Changes — v3.2

Focus: 1,000,000-product coursework support + real backend pagination
+ viewport-fixed Add/Edit product modals. Architecture unchanged
(FastAPI + PostgreSQL + Docker Compose / React + Vite + Tailwind).

---

## 1. Database

### New migration: `backend/migrations/004_big_seed_pagination_support.sql`

* `products.source TEXT NOT NULL DEFAULT 'manual'` — marker so the heavy
  generator's rows can be told apart from the demo seed.
* Partial unique index on `products(sku) WHERE sku IS NOT NULL` — makes
  the heavy seed idempotent (re-running it skips already-inserted SKUs).
* B-tree indexes for paginated search:
  `products(name, category_id, is_active, source, created_at)`.
* `pg_trgm` GIN indexes on `products.name` and `products.sku` for fast
  `ILIKE '%foo%'` search on the million-row table.
* `supplier_products(product_id, supplier_id, is_active)` indexes.
* All `CREATE INDEX IF NOT EXISTS` — safe to re-run.

---

## 2. Two seed scripts

### Light seed — `backend/app/scripts/seed.py` *(unchanged)*

Normal demo data — 4 test users, 10 categories, 50 varied products,
4 + 1 suppliers with realistic supplier_products links. Fast.

    docker compose exec backend python -m app.scripts.seed

### Heavy seed (NEW) — `backend/app/scripts/seed_big_products.py`

Generates the data required by the coursework:

* **1,000,000 products** with unique SKU `COURSE-XXXXXXX`,
  generated server-side via `INSERT … SELECT … FROM generate_series(…)`
  in chunks of 50,000 (NOT one-by-one in Python).
  Each row has a different name, SKU, description, category, price
  and stock quantity. Marked `is_active = FALSE` and `source='big_seed'`
  so the customer catalog stays clean for the demo.
* **≥ 100 categories** (`Категория 001 … 100`).
* **≥ 100 suppliers** (`Поставщик 001 … 100`).
* **~2 000 000 supplier_products links** — every generated product gets
  two suppliers (deterministic spread over the 100 supplier rows).

Idempotent: re-running does nothing because of the unique-SKU index
and explicit count checks.

    docker compose exec backend python -m app.scripts.seed_big_products

Verify:

    docker compose exec db psql -U store_app -d store_db \
        -c "SELECT COUNT(*) FROM products;"

Expected runtime on a laptop: ~1-3 min for the 1M products and another
minute for the supplier links.

---

## 3. Backend pagination

New helper: **`backend/app/pagination.py`** — `page_params` FastAPI
dependency + `build_page()` for the envelope:

```json
{
  "items": [...],
  "page": 1,
  "page_size": 15,
  "total": 1000000,
  "total_pages": 66667,
  "has_next": true,
  "has_prev": false
}
```

Default page_size = 15, max 100. Invalid page/page_size values are
rejected by FastAPI with HTTP 422.

Updated endpoints (all use SQL `LIMIT/OFFSET`, never load everything
into Python):

| Endpoint                         | Query params                                              |
| -------------------------------- | --------------------------------------------------------- |
| `GET /customer/products`         | page, page_size, search, category_id, only_available, sort |
| `GET /store/products`            | page, page_size, search, category_id                      |
| `GET /store/products-managed`    | page, page_size, search, category_id, is_active           |
| `GET /supplier/products`         | page, page_size, search                                   |
| `GET /supplier/products-managed` | page, page_size, search, is_active                        |
| `GET /supplier/products-catalog` | page, page_size, search, category_id, only_not_supplied   |
| `GET /warehouse/products`        | page, page_size, search, category_id                      |

Search uses `ILIKE`, accelerated by the new `pg_trgm` GIN index.

---

## 4. Frontend pagination

### New reusable component
`frontend-shop/src/ui/Pagination.tsx` and identical
`frontend-warehouse/src/ui/Pagination.tsx`:

* «Назад» / «Вперед» buttons (disabled on first/last page)
* «Страница N из M» counter with the total formatted as `1 000 000`
* Manual page-number input + «Перейти» button, value clamped to
  `[1, total_pages]`, Enter key applies
* «Найдено товаров: N» / «Показано M из 15»

### Pages updated to use server-side pagination

* `frontend-shop/src/pages/CustomerPage.tsx` — catalog: page_size = 15,
  search/sort/category/in-stock filter all sent to backend, page resets
  to 1 when filters change. Cart now snapshots `{qty, name, price}` per
  product so totals keep working across pages.
* `frontend-shop/src/pages/StoreProductsTab.tsx` — Store «Товары» tab.
* `frontend-warehouse/src/pages/SupplierProductsTab.tsx` — supplier
  «Мои товары» tab AND the «Подключить существующий товар» picker
  inside Add modal (paginated catalog with its own search and
  «только ещё не подключённые» filter).
* `frontend-warehouse/src/pages/WarehousePage.tsx` — stock list tab.

All searches are debounced 300 ms so the user can type without
hammering the API. **No frontend ever fetches more than 15 products
at a time.**

API client wrappers (`apiProducts.*`, `api.*Products`) now accept
`{ page, page_size, search, category_id, … }` and default
`page_size` to 15.

---

## 5. Modal fix (Store + Supplier)

Both `frontend-shop/src/ui/Modal.tsx` and the warehouse copy were
hardened so the Add/Edit product dialogs always appear in the
visible viewport, even on a long product list:

* Root container `fixed inset-0` (was already there) with `z-[100]`
* Backdrop is `bg-slate-900/60 backdrop-blur-sm`, click closes
* Modal panel: `max-h-[90vh]`, internal scrollable body, **sticky**
  header AND optional sticky footer with rounded corners
* `Escape` closes the modal
* `body { overflow: hidden }` while the modal is open (no background
  scroll)
* `role="dialog" aria-modal="true"` for screen readers
* Action buttons moved out of the form body into the modal's
  sticky footer in `StoreProductsTab`, `SupplierProductsTab` Edit
  and Add modals — they stay visible even on a long form.

---

## 6. Files changed

```
backend/migrations/004_big_seed_pagination_support.sql     (new)
backend/app/pagination.py                                  (new)
backend/app/scripts/seed_big_products.py                   (new)
backend/app/routers/customer.py                            (paginate /products)
backend/app/routers/store.py                               (paginate /products)
backend/app/routers/supplier.py                            (paginate /products)
backend/app/routers/warehouse.py                           (paginate /products)
backend/app/routers/products_mgmt.py                       (paginate 3 endpoints)

frontend-shop/src/ui/Modal.tsx                             (sticky header/footer, scroll lock, Esc)
frontend-shop/src/ui/Pagination.tsx                        (new)
frontend-shop/src/api/client.ts                            (paginated wrappers)
frontend-shop/src/pages/CustomerPage.tsx                   (server-side pagination)
frontend-shop/src/pages/StoreProductsTab.tsx               (server-side pagination)

frontend-warehouse/src/ui/Modal.tsx                        (same as shop)
frontend-warehouse/src/ui/Pagination.tsx                   (new)
frontend-warehouse/src/api/client.ts                       (paginated wrappers)
frontend-warehouse/src/pages/SupplierProductsTab.tsx       (server-side pagination,
                                                            paginated catalog picker)
frontend-warehouse/src/pages/WarehousePage.tsx             (paginated stock list)

CHANGES_v3_2.md                                            (this file)
README.md                                                  (run commands updated)
```

---

## 7. Local run commands

```bash
# fresh database
docker compose down -v
docker compose up -d --build

# normal demo (fast, always run this first)
docker compose exec backend python -m app.scripts.seed

# heavy coursework load (1M products, optional, takes minutes)
docker compose exec backend python -m app.scripts.seed_big_products

# verify
docker compose exec db psql -U store_app -d store_db \
    -c "SELECT COUNT(*) FROM products;"
docker compose exec db psql -U store_app -d store_db \
    -c "SELECT source, COUNT(*) FROM products GROUP BY source;"

# frontends
cd frontend-shop      && npm install && npm run dev                  # :5173
cd frontend-warehouse && npm install && npm run dev -- --port 5174   # :5174
```

---

## 8. Manual testing checklist

After light seed (and optionally heavy seed):

- [ ] Customer catalog shows exactly 15 products per page.
- [ ] «Найдено товаров: 1 000 050» (or similar) shown after heavy seed.
- [ ] Type a search term — list refreshes after ~300 ms; page resets to 1.
- [ ] Change category — page resets to 1.
- [ ] Type «100» in page input → «Перейти» → jumps to page 100 directly,
      no clicking «Вперед» 100 times.
- [ ] Page number > total_pages is clamped, < 1 is rejected.
- [ ] «Назад» disabled on page 1, «Вперед» disabled on last page.
- [ ] Add 2 items to cart from page 3, navigate to page 10 — cart total
      and quantities are preserved.
- [ ] Store → Товары: same pagination behaviour. «Добавить товар» opens
      modal anchored to viewport centre — try scrolling the page first
      to confirm.
- [ ] Modal: Escape closes it. Backdrop click closes it. Body does not
      scroll while open. Sticky «Сохранить»/«Отмена» footer always
      visible even with a long description field.
- [ ] Supplier → Мои товары: pagination + viewport-fixed modal.
- [ ] Supplier → Добавить товар → «Подключить существующий»:
      the global catalog picker is itself paginated and searchable.
- [ ] Supplier creates a new product → it appears in «Мои товары»
      after the modal closes and the list refreshes.
- [ ] Warehouse → Остатки склада: paginated, 15 per page.
- [ ] No frontend ever requests `?page_size=` larger than 15 (open
      DevTools → Network and verify).

---

## 9. What was verified in this environment

* `python3 -m py_compile` for `pagination.py`, `seed_big_products.py`
  and every modified router — PASSED.
* `npx tsc --noEmit` for both frontend-shop and frontend-warehouse —
  PASSED with no errors.
* SQL syntax of `004_*.sql` reviewed (BEGIN/COMMIT pair, IF NOT EXISTS
  guards). Not actually executed against PostgreSQL in this environment.
* Docker Compose was NOT run here — start it locally with the commands
  above.

## 10. Limitations / assumptions

* The heavy seed runtime depends on disk I/O; on slow disks the 1M
  insert may take longer than the 1-3 min estimate. The script
  prints chunk-by-chunk progress so you can see it isn't hung.
* `pg_trgm` ships with stock PostgreSQL but is created lazily via
  `CREATE EXTENSION IF NOT EXISTS pg_trgm` in the migration; the
  Docker postgres image supports this out of the box.
* `created_by_role` for big_seed rows is set to `'big_seed'` (not one
  of customer/store/warehouse/supplier) on purpose — the column is a
  free-form TEXT marker, no FK or CHECK constraint exists for it.
* SupplierRequest workflow from v3.1 is unchanged: a SupplierRequest is
  only created when the customer explicitly picks supplier fulfilment,
  and is then processed by the Supplier role from their dashboard.
* The customer-catalog «delivery time» sort option from v3.1 was
  dropped (it required a secondary supplier join that doesn't scale to
  1M rows without an extra index); the remaining sorts cover all
  realistic use cases.
