# Store System v3 — change log

## 1. Database / schema

New migration: **`backend/migrations/002_v3_business_logic.sql`** (idempotent,
safe on an existing DB, but you should `docker compose down -v` if you want a
clean reseed).

- New types:
  - `fulfillment_source` = `undecided | warehouse | supplier | excluded`
  - `proposed_action`    = `warehouse | supplier | exclude`
  - `proposal_status`    = `pending_customer_decision | accepted_partial | accepted_split | rejected | expired`
- Extends `app_status` with: `pending_customer_decision`,
  `partially_accepted_by_store`, `customer_approved_partial`,
  `customer_approved_split`, `split_processing`, `cancelled_by_customer`.
- New table **`supplier_products`** — supplier ↔ product, `unit_price`,
  `lead_time_days`, `is_active`. Used everywhere supplier options/ETAs are
  needed.
- Extends **`customer_order_application_items`** with: `approved_quantity`,
  `cancelled_quantity`, `fulfillment_source`,
  `warehouse_available_quantity_snapshot`, `selected_supplier_id`,
  `estimated_delivery_date`, `exclusion_reason`, `item_status`.
- New tables **`customer_order_proposals`** + **`customer_order_proposal_items`**.

The original `001_init.sql` is left unchanged.

## 2. Backend

- `app/orders.py` — new shared helpers: `load_application(...)` (returns
  application + items + status history + pending proposal + live availability +
  supplier options) and `log_status(...)`.
- `app/schemas.py` — rewritten to add `Category`, `SupplierOption`,
  `ProductCatalogEntry`, `ApplicationItemOut` (with availability + suppliers),
  `ProposalItemIn / ProposalCreate`, `ProposalOut / ProposalItemOut`,
  `ProposalDecisionPayload`, `RouteWarehousePayload`.
- `app/routers/customer.py`
  - New `GET /customer/categories`
  - `GET /customer/products` now returns supplier options + in-stock flag
  - `GET /customer/order-applications/{id}` returns the full application incl.
    any pending proposal
  - **`POST /customer/order-applications/{id}/proposal/respond`** — handles
    all three decisions:
    `accept_partial_warehouse_only`, `accept_split_warehouse_and_supplier`,
    `cancel_application` (creates warehouse / supplier requests in one tx,
    marks excluded items, writes history).
- `app/routers/store.py`
  - `GET /store/customer-applications/{id}` returns live warehouse stock +
    supplier options per item.
  - **`POST /store/customer-applications/{id}/proposal`** — store builds a
    proposal with per-item quantities and supplier choice; validations:
    not exceeding requested qty, warehouse qty ≤ stock, supplier must supply
    the product. Application moves to `pending_customer_decision`.
  - **`POST /store/customer-applications/{id}/route-warehouse`** — fast path
    when everything is in stock (replaces old `accept` + `send-to-warehouse`).
    Refuses if any item lacks stock; tells the store to create a partial
    proposal instead.
  - `POST /store/customer-applications/{id}/reject` — full rejection (now with
    state-transition guards: cannot reject after warehouse/supplier processing
    has started). Closes any pending proposal.
- `app/routers/warehouse.py`
  - Items endpoints include category name.
  - On reject: only marks the **application** `warehouse_rejected` if there is
    no other open supplier request (supports split fulfillment).
  - On ship: calls `_maybe_complete_application` (sets `completed` only when
    every warehouse + supplier request is shipped or rejected).
- `app/routers/supplier.py`
  - `GET /supplier/products` returns only products the supplier supplies
    (via `supplier_products`).
  - Request items include the supplier's `estimated_delivery_date` computed
    from `supplier_products.lead_time_days`.
  - On ship: same split-aware completion logic as warehouse.

All `_id` values that determine ownership (store_id / warehouse_id /
supplier_id / customer_id) keep coming from the JWT — never from the request
body. State-transition guards live in each handler.

## 3. Seed data (`backend/app/scripts/seed.py`)

Idempotent (uses upserts). After seeding you have:

- **10 categories** (Электроника, Канцелярия, Бытовая техника, Книги, Одежда,
  Спорт, Продукты, Игрушки, Авто, Сад)
- **50 products** spread across the categories. Stocks are deliberately mixed:
  several items at 0, several at 1–5 (partial), most fully in stock — so you
  can hit every business-flow branch.
- **5 suppliers** (`supplier1` … `supplier5`), each owning 10 supplier_products
  with lead times of 2 / 3 / 5 / 7 / 10 / 14 / 21 days and discounted prices.
- 4 base test users: `customer1`, `store1`, `warehouse1`, `supplier1` (+ 4
  extra supplier users).

## 4. Frontends — design system

Both `frontend-shop` and `frontend-warehouse` share the same redesigned design
language (inspired by the supplied `ShopHubPage.tsx`):

- New CSS tokens in `src/index.css`: soft page gradient, rounded
  `2xl / 3xl`, soft shadows (`shadow-soft`, `shadow-card`, `shadow-lift`),
  brand-blue gradient buttons, gradient header logo, glass-blur sticky header,
  `prefers-reduced-motion` guard.
- New shared UI primitives under `src/ui/`:
  - `IconTile` (rounded gradient icon container, 10 tones)
  - `IconBadge` (chip with icon)
  - `StatusBadge` + `statusLabel` (centralized status meta with Russian labels
    and Lucide icons, animated dot for live statuses)
  - `Feedback` — `ErrorBanner`, `SuccessBanner`, `EmptyState`,
    `LoadingSkeleton`
  - `Modal` (responsive, sheet on mobile, dialog on desktop)
- New shared components under `src/components/`:
  - `Shell` (responsive glass header, theme toggle, footer, no-flash dark mode)
  - `HubCard` — the role card from the old `ShopHubPage.tsx`, lifted into a
    reusable component
  - `Auth` (polished `LoginPage` with role tiles + autofilled test creds;
    `HubPage` with subtitle + role cards + architecture block; `RequireRole`)
- `lucide-react` added to both `package.json`s.
- All component spacing, table, tab, badge, button styles are now defined as
  Tailwind layer components so individual pages do not hard-code colors.
- Dark theme retained and tuned.

## 5. Frontends — pages

### `frontend-shop`

- **HubPage** at `/` — gradient title, role cards, architecture block.
- **LoginPage** at `/login?role=…` — role tiles, autofilled test creds,
  icon-led layout.
- **CustomerPage** — fully rewritten:
  - Catalog with search, category-tab filter, sort
    (name / price ↑↓ / category / stock / delivery), "only in stock" toggle.
  - Product cards show category badge, availability badge, supplier lead
    time when not in stock, quantity stepper.
  - Sticky cart bar with totals.
  - Order list shows status, items, history.
  - **Pending proposal card** with three response buttons
    (only warehouse / split / cancel), per-item display of which line goes
    where + ETA from supplier.
  - Expandable timeline (StatusTimeline component).
- **StorePage** — fully rewritten:
  - Tabs: incoming · ждут покупателя · запросы на склад · запросы поставщику
    (with counters).
  - Incoming application card with: per-item checkbox, warehouse qty input,
    supplier dropdown (with price + lead time), live ETA preview, summary
    chips (available / partial / unavailable).
  - "Принять и на склад полностью" appears only when all items are in stock.
  - "Создать предложение покупателю" — modal that builds and sends a
    `ProposalCreate` payload.
  - "Отклонить целиком" — modal that requires a reason.

### `frontend-warehouse`

- **WarehousePage** — tabs `Запросы магазинов | Остатки склада`.
  Stock tab has category filter + search and shows low/out indicators.
  Request cards show per-item stock with red/green coloring, accept /
  approve (with confirm) / reject (modal with reason) / ship buttons.
- **SupplierPage** — tabs `Запросы | Поставки | Мои товары`.
  Request items show category and estimated delivery date.
  Ship modal lets you set expected date, notes and per-line unit price.

## 6. Files changed (top-level)

```
backend/
  migrations/002_v3_business_logic.sql        NEW
  app/orders.py                                NEW
  app/schemas.py                               rewritten
  app/routers/customer.py                      rewritten
  app/routers/store.py                         rewritten
  app/routers/warehouse.py                     rewritten
  app/routers/supplier.py                      rewritten
  app/scripts/seed.py                          rewritten
frontend-shop/
  package.json                                 +lucide-react
  tailwind.config.js                           updated tokens
  src/index.css                                rewritten design system
  src/api/client.ts                            new endpoints
  src/types/index.ts                           extended
  src/components/Theme.tsx                     icon toggle + no-flash
  src/components/Shell.tsx                     redesigned
  src/components/HubCard.tsx                   NEW
  src/components/Auth.tsx                      rewritten
  src/ui/IconTile.tsx                          NEW
  src/ui/Status.tsx                            NEW
  src/ui/Feedback.tsx                          NEW
  src/ui/Modal.tsx                             NEW
  src/pages/CustomerPage.tsx                   rewritten
  src/pages/StorePage.tsx                      rewritten
  src/main.tsx                                 updated routes / titles
frontend-warehouse/
  (mirror of frontend-shop infra)
  src/pages/WarehousePage.tsx                  rewritten
  src/pages/SupplierPage.tsx                   rewritten
```

## 7. Manual test checklist

After `docker compose up -d --build` + seed, run the shop on :5173 and the
warehouse app on :5174.

### Scenario A — full warehouse availability
1. Login as `customer1`. Add **«Ручка шариковая» × 3** and **«Бумага A4 …» × 2**
   to cart, submit. Status → `pending_store_review`.
2. Login as `store1`. Open the incoming application — summary shows
   `В наличии: 2/2`. Click **«Принять и на склад полностью»**.
3. Login as `warehouse1`. Tab «Запросы магазинов» → **Принять в обработку**
   → **Одобрить** (stock decreases) → **Отгрузить**.
4. Back as `customer1` the order shows **«Выполнено»** with full timeline.

### Scenario B — partial availability (warehouse-only)
1. As `customer1`, add **«Кофемашина MiniBrew» × 10** (only 3 in stock) and
   **«Чайник Express» × 2** (in stock). Submit.
2. As `store1`, see the incoming application: chip shows `В наличии: 1/2 ·
   Частично: 1`. The "Принять полностью" button is hidden.
3. Open the proposal modal: for MiniBrew uncheck supplier or set
   supplier qty 0; warehouse qty = 3. Send proposal.
4. As `customer1`, the application is now `Ожидает решения покупателя`.
   Click **«Только доступное со склада»**.
5. Warehouse request is created only for MiniBrew × 3 + Чайник × 2.
   Customer sees MiniBrew approved 3, cancelled 7 with reason in details.

### Scenario C — split warehouse + supplier
1. As `customer1`, add an item that has both partial stock and a supplier
   (e.g. **«Микроволновка Easy» × 2** which has 0 in stock and is supplied
   by some supplier in seed). Submit.
2. As `store1`, in the proposal pick supplier from the dropdown (you'll see
   price + lead time + ETA), set supplier qty = 2. Send proposal.
3. As `customer1`, choose **«Склад + поставщик»**.
4. Two requests are created — a warehouse request for warehouse items and a
   supplier request for supplier items. Application status →
   `split_processing` (or `customer_approved_partial` if one side is empty).
5. As `warehouse1` ship the warehouse part; as the matching `supplierN`
   ship the supplier part. Only after both are shipped the application
   becomes `Выполнено`.

### Scenario D — full rejection
1. As `store1`, open any incoming application, **«Отклонить целиком»**,
   give a reason. Status → `rejected_by_store`. Customer sees the reason.

### Scenario E — supplier-only
1. As `customer1`, order something that is only supplier-fulfilled
   (any item with 0 stock that has a supplier). Submit.
2. As `store1`, in proposal set warehouse qty = 0 and supplier qty = full,
   pick a supplier. Send.
3. As `customer1` choose **«Склад + поставщик»** (supplier portion only).
4. The supplier role ships; application becomes `Выполнено`.

### Scenario F — customer cancel
1. While an application is in `pending_customer_decision`, customer clicks
   **«Отменить заявку»** → status `cancelled_by_customer`, no warehouse
   or supplier requests created.

## 8. Limitations / assumptions

- The proposal flow assumes one supplier per line (the store picks one).
  Splitting a single line across multiple suppliers isn't part of the UI;
  the schema can support it because each line has at most one
  `selected_supplier_id`.
- "Approve" on the warehouse uses the live `stock_quantity` at the moment of
  approval (with `FOR UPDATE`). If stock dropped after the proposal was
  shown, approve will return HTTP 409 — the store has to create a new
  proposal.
- There is no admin role UI; the `admin` enum value exists but no admin app
  is built.
- Email/notification side-effects are out of scope.
- `ALTER TYPE app_status ADD VALUE` runs in a `BEGIN/COMMIT` block; PG 16
  permits this as long as the new values aren't used in the same
  transaction (they aren't).
- The two frontends are independent Vite apps; choose different ports
  (`5173` and `5174`).

## 9. Local verification status

This codebase was prepared as a downloadable patch in an environment that
**cannot run Docker or PostgreSQL** and therefore cannot perform the full
end-to-end docker-compose / seed / browser run.

What WAS verified in this environment:
- `tsc --noEmit` passes for both `frontend-shop` and `frontend-warehouse`.
- `python -m compileall` passes for the entire `backend/app` tree.
- SQL migration is syntactically valid; written to be idempotent so it can
  be applied to an existing v2 database.

What WAS NOT executed here (you need to run these locally):
- `docker compose up -d --build`
- `docker compose exec backend python -m app.scripts.seed`
- `npm install && npm run build` for either frontend
- end-to-end manual test scenarios above

If any local test fails, the most likely candidates are environment-specific
issues (port conflicts, lingering volumes from v2 that still have the old
enum without the new values — solved by `docker compose down -v`).
