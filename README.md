# Store System v3

FastAPI + PostgreSQL backend with two independent React + Vite + TypeScript
frontends. Roles: **customer / store / warehouse / supplier**. JWT auth.
Docker Compose for local dev.

> v3 adds: partial-availability + customer-confirmed split fulfillment,
> supplier catalog with lead times, richer product/category seed data,
> redesigned dashboards.

## Quick start

```bash
# 1) Backend + DB
docker compose down -v          # wipe old data (optional, but safer between versions)
docker compose up -d --build
docker compose exec backend python -m app.scripts.seed

# 2) API docs
open http://localhost:8000/docs

# 3) Shop frontend (customer + store)
cd frontend-shop
npm install
npm run dev          # http://localhost:5173

# 4) Warehouse frontend (warehouse + supplier) — separate terminal
cd frontend-warehouse
npm install
npm run dev          # http://localhost:5174  (run on different port)
```

If both frontends try to use 5173, set the warehouse one to another port:
`npm run dev -- --port 5174`.

## Test users (all password `password123`)

| role      | username    |
|-----------|-------------|
| customer  | customer1   |
| store     | store1      |
| warehouse | warehouse1  |
| supplier  | supplier1 … supplier5 |

## What's new in v3 — at a glance

- New migration `backend/migrations/002_v3_business_logic.sql`
  - `supplier_products` (supplier ↔ product, price, lead time)
  - extended `customer_order_application_items` (per-item decisions, supplier, ETA)
  - `customer_order_proposals` + `customer_order_proposal_items`
  - extended `app_status` enum
- Store can build a **partial proposal** (per-item checkboxes, warehouse
  quantity, supplier choice, expected delivery date) and send it to the
  customer instead of rejecting the whole order.
- Customer can answer the proposal with one of three buttons:
  *only warehouse*, *warehouse + supplier (split)*, *cancel*.
- Warehouse and supplier requests now ship in parallel for split orders;
  the application becomes `completed` only when both parts are shipped.
- Seed: 5 suppliers, 10 categories, 50 products, ~50 supplier_products,
  varied stock so partial / split / supplier-only scenarios work.
- Both frontends share the same redesigned design system
  (ShopHubPage style: rounded 2xl/3xl cards, soft blue accent, Lucide icons,
  responsive grid, dark/light theme, reduced-motion respected).

See `CHANGES.md` for the detailed change list.
