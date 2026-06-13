# v3.1 — Product management + supplier approval + RadioCard

## Backend
- **New migration** `backend/migrations/003_v3_product_management.sql` (idempotent):
  - `products`: `sku`, `is_active`, `created_by_user_id`, `created_by_role`
  - `supplier_products`: `quantity_available`, `notes`, `estimated_delivery_date`, `updated_at`
  - `supplier_requests` / `warehouse_requests`: `accepted_at`, `approved_at`, `shipped_at`
  - `req_status` enum: adds `cancelled`
  - `app_status` enum: adds `supplier_approved`

- **New router** `backend/app/routers/products_mgmt.py` registered in `main.py`:
  - `GET  /store/categories`
  - `GET  /store/products-managed`
  - `POST /store/products`
  - `PATCH /store/products/{id}`
  - `GET  /supplier/categories`
  - `GET  /supplier/products-managed`
  - `GET  /supplier/products-catalog` (global products + already_supplied flag)
  - `POST /supplier/products` (connect existing)
  - `POST /supplier/products/create-and-supply`
  - `PATCH /supplier/products/{id}`
  - All `store_id` / `supplier_id` derived from JWT — ownership enforced.

- **Supplier workflow**:
  - New `POST /supplier/requests/{id}/approve` → status `approved` + app log `supplier_approved`.
  - `accept` now sets `accepted_at`. `ship` requires status `processing` or `approved` (no longer accepts directly from `pending`), and writes `shipped_at`.
  - `_ALLOWED` statuses extended to include `approved` and `cancelled` for filtering.

## Frontend — shared
- **New component** `src/ui/RadioCard.tsx` (added to both `frontend-shop` and `frontend-warehouse`):
  - Accessible card-style radio group (`role=radiogroup`, real `<input type=radio>`, keyboard nav).
  - Per-option icon, title, description, optional badge, disabled state.
  - Mobile-friendly (>= 88 px tap targets), dark-mode aware, animated selected state.

## Frontend — shop
- **CustomerPage**: proposal decision UI replaced with `RadioCardGroup`
  (`Только товары со склада` / `Склад + поставщик` / `Отменить заявку`) + a single
  primary “Подтвердить выбор” button. The selected card drives which decision is sent.
- **StorePage**: new **Товары** tab → `StoreProductsTab.tsx`:
  - Search, category filter, grid of products with category/stock/supplier-count badges.
  - “Добавить товар” opens a polished modal form (name, description, price, stock,
    category, SKU, active flag). Same modal edits existing products.

## Frontend — warehouse / supplier
- **SupplierPage**: existing read-only “Мои товары” tab replaced with
  `SupplierProductsTab.tsx`:
  - Lists this supplier’s `supplier_products` only.
  - Edit modal: price, lead time, available quantity, notes, active.
  - Add modal uses **RadioCardGroup** to pick between `Подключить существующий` and
    `Создать новый товар`, then captures both supplier-side fields (price,
    lead time, quantity, notes) and, when creating, retail price + category.
  - Request actions: `Принять` → `Одобрить` (new) → `Отгрузить`; reject blocked once shipped.
  - Status filter row now also includes `approved`.
- **Theme refresh** to differentiate from the shop:
  - `brand` palette switched to indigo (`#6366f1` family).
  - New `accent` (cyan) and `supplier` (emerald) palettes available as Tailwind classes.
  - Page background gradients refreshed (indigo + cyan + emerald glow).
  - Header title gradient → `brand → accent`.

## API client
- Both `frontend-shop` and `frontend-warehouse` now export an additional
  `apiProducts` namespace covering the new endpoints (store + supplier
  product management, supplier approve).

## What was NOT touched
- Existing customer / warehouse business logic is unchanged: the existing flow
  already only creates a `SupplierRequest` after the customer confirms
  `accept_split_warehouse_and_supplier`. The supplier app continues to be the
  only place where supplier requests can be processed.
- Existing seed data is preserved; no destructive migrations.

## Local run

```bash
docker compose down -v
docker compose up -d --build
docker compose exec backend python -m app.scripts.seed

cd frontend-shop && npm install && npm run dev
cd frontend-warehouse && npm install && npm run dev -- --port 5174
```

## Verified in this environment
- `python3 -m py_compile` on all backend modules — OK.
- `tsc --noEmit` for both frontends — OK (no errors).
- Migration SQL: balanced parentheses / BEGIN-COMMIT.
- **Not verified**: full `docker compose` run, runtime end-to-end flows.

## Test scenarios to validate manually
1. **Warehouse-only**: customer orders in-stock items → Store routes to warehouse → warehouse approves+ships → app completed.
2. **Partial — warehouse only**: mixed cart → Store creates proposal → Customer picks `Только товары со склада` → only WarehouseRequest is created; supplier items are marked `excluded`.
3. **Split — warehouse + supplier**: as above → Customer picks `Склад + поставщик` → WarehouseRequest **and** SupplierRequest created; supplier sees the request and runs accept → approve → ship.
4. **Supplier reject**: split flow → supplier rejects with reason → customer & store see `supplier_rejected` + reason.
5. **Supplier product mgmt**: login `supplier1` → `Мои товары` → `Добавить товар` → either connect existing or create-and-supply; the new entry is visible in the store proposal screen as a supplier option.
6. **Store product mgmt**: login `store1` → `Товары` → add / edit / deactivate; active products appear in the customer catalog.
