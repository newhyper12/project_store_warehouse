-- ============================================================
--  Store / Warehouse / Supplier — initial schema
-- ============================================================
-- All FK + status columns are indexed. Timestamps on every table.
-- Status flow lives in `status_history` (audit log).
-- ============================================================

BEGIN;

-- -------- enums --------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer','store','warehouse','supplier','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE app_status AS ENUM (
    'pending_store_review',
    'accepted_by_store',
    'rejected_by_store',
    'sent_to_warehouse',
    'sent_to_supplier',
    'warehouse_processing',
    'warehouse_approved',
    'warehouse_rejected',
    'warehouse_shipped',
    'supplier_processing',
    'supplier_shipped',
    'supplier_rejected',
    'completed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE req_status AS ENUM ('pending','processing','approved','rejected','shipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -------- core entities --------
CREATE TABLE IF NOT EXISTS stores (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS warehouses (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  contact     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id          SERIAL PRIMARY KEY,
  full_name   TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL,
  entity_id     INTEGER NOT NULL,    -- FK to stores/warehouses/suppliers/customers depending on role
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_users_role ON users(role);

-- -------- catalog --------
CREATE TABLE IF NOT EXISTS categories (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  price           NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_quantity  INTEGER NOT NULL DEFAULT 0,
  category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_products_category ON products(category_id);

-- -------- customer order applications --------
CREATE TABLE IF NOT EXISTS customer_order_applications (
  id            SERIAL PRIMARY KEY,
  customer_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  store_id      INTEGER REFERENCES stores(id) ON DELETE SET NULL,
  status        app_status NOT NULL DEFAULT 'pending_store_review',
  total_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  reject_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_coa_customer ON customer_order_applications(customer_id);
CREATE INDEX IF NOT EXISTS ix_coa_store    ON customer_order_applications(store_id);
CREATE INDEX IF NOT EXISTS ix_coa_status   ON customer_order_applications(status);

CREATE TABLE IF NOT EXISTS customer_order_application_items (
  id              SERIAL PRIMARY KEY,
  application_id  INTEGER NOT NULL REFERENCES customer_order_applications(id) ON DELETE CASCADE,
  product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  unit_price      NUMERIC(12,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_coai_app     ON customer_order_application_items(application_id);
CREATE INDEX IF NOT EXISTS ix_coai_product ON customer_order_application_items(product_id);

-- -------- warehouse requests (store → warehouse) --------
CREATE TABLE IF NOT EXISTS warehouse_requests (
  id              SERIAL PRIMARY KEY,
  application_id  INTEGER NOT NULL REFERENCES customer_order_applications(id) ON DELETE CASCADE,
  store_id        INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  warehouse_id    INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
  status          req_status NOT NULL DEFAULT 'pending',
  reject_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_wr_status    ON warehouse_requests(status);
CREATE INDEX IF NOT EXISTS ix_wr_store     ON warehouse_requests(store_id);
CREATE INDEX IF NOT EXISTS ix_wr_warehouse ON warehouse_requests(warehouse_id);
CREATE INDEX IF NOT EXISTS ix_wr_app       ON warehouse_requests(application_id);

CREATE TABLE IF NOT EXISTS warehouse_request_items (
  id                  SERIAL PRIMARY KEY,
  request_id          INTEGER NOT NULL REFERENCES warehouse_requests(id) ON DELETE CASCADE,
  product_id          INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  requested_quantity  INTEGER NOT NULL CHECK (requested_quantity > 0),
  approved_quantity   INTEGER
);
CREATE INDEX IF NOT EXISTS ix_wri_request ON warehouse_request_items(request_id);

-- -------- supplier requests (store → supplier) --------
CREATE TABLE IF NOT EXISTS supplier_requests (
  id              SERIAL PRIMARY KEY,
  application_id  INTEGER NOT NULL REFERENCES customer_order_applications(id) ON DELETE CASCADE,
  store_id        INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  supplier_id     INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  status          req_status NOT NULL DEFAULT 'pending',
  reject_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_sr_status   ON supplier_requests(status);
CREATE INDEX IF NOT EXISTS ix_sr_store    ON supplier_requests(store_id);
CREATE INDEX IF NOT EXISTS ix_sr_supplier ON supplier_requests(supplier_id);

CREATE TABLE IF NOT EXISTS supplier_request_items (
  id                  SERIAL PRIMARY KEY,
  request_id          INTEGER NOT NULL REFERENCES supplier_requests(id) ON DELETE CASCADE,
  product_id          INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  requested_quantity  INTEGER NOT NULL CHECK (requested_quantity > 0)
);
CREATE INDEX IF NOT EXISTS ix_sri_request ON supplier_request_items(request_id);

-- -------- shipments (supplier → store/warehouse) --------
CREATE TABLE IF NOT EXISTS shipments (
  id                  SERIAL PRIMARY KEY,
  supplier_request_id INTEGER REFERENCES supplier_requests(id) ON DELETE SET NULL,
  supplier_id         INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  expected_date       DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ship_supplier ON shipments(supplier_id);
CREATE INDEX IF NOT EXISTS ix_ship_req      ON shipments(supplier_request_id);

CREATE TABLE IF NOT EXISTS shipment_items (
  id            SERIAL PRIMARY KEY,
  shipment_id   INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_si_shipment ON shipment_items(shipment_id);

-- -------- status history (audit) --------
CREATE TABLE IF NOT EXISTS status_history (
  id              SERIAL PRIMARY KEY,
  application_id  INTEGER NOT NULL REFERENCES customer_order_applications(id) ON DELETE CASCADE,
  status          app_status NOT NULL,
  note            TEXT,
  actor_user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_sh_app ON status_history(application_id);

COMMIT;
