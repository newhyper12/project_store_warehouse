-- ============================================================
--  v3: partial availability + customer-confirmed split fulfillment
--      supplier catalog + delivery dates
-- ============================================================
-- Idempotent: safe to re-run on an existing DB.
-- ============================================================

BEGIN;

-- -------- extend app_status enum --------
DO $$
DECLARE
  v TEXT;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'pending_customer_decision',
    'partially_accepted_by_store',
    'customer_approved_partial',
    'customer_approved_split',
    'split_processing',
    'cancelled_by_customer'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER TYPE app_status ADD VALUE %L', v);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;

-- -------- item-level fulfillment source --------
DO $$ BEGIN
  CREATE TYPE fulfillment_source AS ENUM ('undecided','warehouse','supplier','excluded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE proposed_action AS ENUM ('warehouse','supplier','exclude');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE proposal_status AS ENUM (
    'pending_customer_decision','accepted_partial','accepted_split','rejected','expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -------- supplier catalog (which supplier supplies which product) --------
CREATE TABLE IF NOT EXISTS supplier_products (
  id                SERIAL PRIMARY KEY,
  supplier_id       INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id        INTEGER NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  unit_price        NUMERIC(12,2) NOT NULL DEFAULT 0,
  lead_time_days    INTEGER NOT NULL DEFAULT 7,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, product_id)
);
CREATE INDEX IF NOT EXISTS ix_sp_supplier ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS ix_sp_product  ON supplier_products(product_id);

-- -------- order item: decision fields --------
ALTER TABLE customer_order_application_items
  ADD COLUMN IF NOT EXISTS approved_quantity   INTEGER,
  ADD COLUMN IF NOT EXISTS cancelled_quantity  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fulfillment_source  fulfillment_source NOT NULL DEFAULT 'undecided',
  ADD COLUMN IF NOT EXISTS warehouse_available_quantity_snapshot INTEGER,
  ADD COLUMN IF NOT EXISTS selected_supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE,
  ADD COLUMN IF NOT EXISTS exclusion_reason   TEXT,
  ADD COLUMN IF NOT EXISTS item_status        TEXT NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS ix_coai_supplier ON customer_order_application_items(selected_supplier_id);

-- -------- customer order proposals --------
CREATE TABLE IF NOT EXISTS customer_order_proposals (
  id                  SERIAL PRIMARY KEY,
  application_id      INTEGER NOT NULL REFERENCES customer_order_applications(id) ON DELETE CASCADE,
  store_id            INTEGER NOT NULL REFERENCES stores(id)                       ON DELETE RESTRICT,
  status              proposal_status NOT NULL DEFAULT 'pending_customer_decision',
  message             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_decision_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_cop_app ON customer_order_proposals(application_id);
CREATE INDEX IF NOT EXISTS ix_cop_status ON customer_order_proposals(status);

CREATE TABLE IF NOT EXISTS customer_order_proposal_items (
  id                          SERIAL PRIMARY KEY,
  proposal_id                 INTEGER NOT NULL REFERENCES customer_order_proposals(id) ON DELETE CASCADE,
  application_item_id         INTEGER NOT NULL REFERENCES customer_order_application_items(id) ON DELETE CASCADE,
  product_id                  INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  requested_quantity          INTEGER NOT NULL,
  warehouse_available_quantity INTEGER NOT NULL DEFAULT 0,
  proposed_warehouse_quantity INTEGER NOT NULL DEFAULT 0,
  proposed_supplier_quantity  INTEGER NOT NULL DEFAULT 0,
  proposed_action             proposed_action NOT NULL,
  supplier_id                 INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  estimated_delivery_date     DATE
);
CREATE INDEX IF NOT EXISTS ix_copi_proposal ON customer_order_proposal_items(proposal_id);

COMMIT;
