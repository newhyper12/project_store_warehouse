-- ============================================================
--  v3.2: pagination support + heavy seed support
-- ============================================================
-- * Adds indexes needed for fast paginated listing & search
--   over million-row products table.
-- * Adds the `source` marker so heavy-seeded rows can be told
--   apart from the demo seed.
-- Idempotent. Safe to re-run.
-- ============================================================

BEGIN;

-- -------- products: marker for the heavy generator --------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- products.sku must be unique so the heavy seed is idempotent.
-- Use a partial unique index that ignores NULLs (legacy rows may
-- not have a SKU).
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_sku_notnull
    ON products(sku) WHERE sku IS NOT NULL;

-- pagination / search indexes
CREATE INDEX IF NOT EXISTS ix_products_name        ON products(name);
CREATE INDEX IF NOT EXISTS ix_products_category    ON products(category_id);
CREATE INDEX IF NOT EXISTS ix_products_is_active   ON products(is_active);
CREATE INDEX IF NOT EXISTS ix_products_source      ON products(source);
CREATE INDEX IF NOT EXISTS ix_products_created_at  ON products(created_at);

-- trigram index for ILIKE '%foo%' search (optional but very useful
-- once the table has 1M rows).  pg_trgm ships with stock PostgreSQL.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS ix_products_name_trgm
    ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_products_sku_trgm
    ON products USING gin (sku gin_trgm_ops);

-- -------- supplier_products: indexes for joins --------
CREATE INDEX IF NOT EXISTS ix_sp_product   ON supplier_products(product_id);
CREATE INDEX IF NOT EXISTS ix_sp_supplier  ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS ix_sp_active    ON supplier_products(is_active);

COMMIT;
