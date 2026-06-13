-- ============================================================
--  v3.1: product management + supplier approve workflow
-- ============================================================
-- Idempotent.
-- ============================================================

BEGIN;

-- -------- products: management metadata --------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_role TEXT;

CREATE INDEX IF NOT EXISTS ix_products_active ON products(is_active);

-- -------- supplier_products: management metadata --------
ALTER TABLE supplier_products
  ADD COLUMN IF NOT EXISTS quantity_available INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- -------- supplier_requests: lifecycle timestamps + approve state --------
DO $$ BEGIN
  ALTER TYPE req_status ADD VALUE IF NOT EXISTS 'cancelled';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE supplier_requests
  ADD COLUMN IF NOT EXISTS accepted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at   TIMESTAMPTZ;

ALTER TABLE warehouse_requests
  ADD COLUMN IF NOT EXISTS accepted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at   TIMESTAMPTZ;

-- -------- new application status for supplier-approved --------
DO $$
DECLARE
  v TEXT;
BEGIN
  FOREACH v IN ARRAY ARRAY['supplier_approved']
  LOOP
    BEGIN
      EXECUTE format('ALTER TYPE app_status ADD VALUE %L', v);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END LOOP;
END $$;

COMMIT;
