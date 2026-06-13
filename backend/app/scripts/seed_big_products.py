"""Heavy seed: generate 1,000,000 products for the coursework requirement.

Run inside the backend container:

    docker compose exec backend python -m app.scripts.seed_big_products

What it generates:
    * 100 categories  (label: "Категория NN")
    * 100 suppliers   (label: "Поставщик NN")
    * 1 000 000 products with unique SKU `COURSE-XXXXXXX`
                       all marked source='big_seed', is_active=FALSE
                       so the customer catalog stays clean for the demo.
    * ~2 000 000 supplier_products rows: every product gets
                       exactly two random suppliers.

The script is idempotent — it uses ON CONFLICT DO NOTHING on the
unique SKU index, so running it twice does nothing the second time.

Performance:
    * Everything is generated server-side via PostgreSQL `generate_series`
      + a single bulk INSERT per table, NOT one INSERT per row.
    * On a laptop the full run is usually 1-3 minutes for 1M products
      and another minute for the supplier links.

Verify afterwards:

    docker compose exec db psql -U store_app -d store_db \\
        -c "SELECT COUNT(*) FROM products;"
"""
from __future__ import annotations

import asyncio
import time

from app.db import db


TARGET_PRODUCTS   = 1_000_000
TARGET_CATEGORIES = 100
TARGET_SUPPLIERS  = 100
SUPPLIERS_PER_PRODUCT = 2


async def _count(table: str, where: str = "TRUE") -> int:
    row = await db.fetch_one(f"SELECT COUNT(*) AS c FROM {table} WHERE {where}")
    return int(row["c"] or 0)


async def seed_categories() -> None:
    print(f"==> categories (target: ≥{TARGET_CATEGORIES})")
    have = await _count("categories")
    if have >= TARGET_CATEGORIES:
        print(f"   already have {have}, skipping")
        return
    await db.execute(
        """
        INSERT INTO categories(name)
        SELECT 'Категория ' || lpad(g::text, 3, '0')
          FROM generate_series(1, CAST(:n AS integer)) g
        ON CONFLICT (name) DO NOTHING
        """,
        {"n": TARGET_CATEGORIES},
    )
    have = await _count("categories")
    print(f"   done, categories now: {have}")


async def seed_suppliers() -> None:
    print(f"==> suppliers (target: ≥{TARGET_SUPPLIERS})")
    have = await _count("suppliers")
    if have >= TARGET_SUPPLIERS:
        print(f"   already have {have}, skipping")
        return
    # Suppliers table has no UNIQUE on name in the base schema, so we
    # generate only the missing rows ourselves instead of relying on
    # ON CONFLICT.
    need = TARGET_SUPPLIERS - have
    await db.execute(
        """
        INSERT INTO suppliers(name, contact)
        SELECT 'Поставщик ' || lpad((g + :offset)::text, 3, '0'),
               'sup' || (g + :offset) || '@example.com'
          FROM generate_series(1, CAST(:n AS integer)) g
        """,
        {"n": need, "offset": have},
    )
    have = await _count("suppliers")
    print(f"   done, suppliers now: {have}")


async def seed_products() -> None:
    print(f"==> products (target: {TARGET_PRODUCTS:,}, source='big_seed')")
    have = await _count("products", "source = 'big_seed'")
    print(f"   currently have {have:,} big_seed products")
    if have >= TARGET_PRODUCTS:
        print("   target already reached, skipping")
        return
    start = time.perf_counter()

    # Generate in chunks so PostgreSQL keeps memory usage low.
    CHUNK = 50_000
    inserted_total = 0
    g_start = have + 1
    g_end   = TARGET_PRODUCTS

    while g_start <= g_end:
        chunk_end = min(g_start + CHUNK - 1, g_end)
        n_before = await _count("products")
        await db.execute(
            """
            INSERT INTO products(
                name, description, price, stock_quantity,
                category_id, sku, is_active,
                created_by_role, source
            )
            SELECT
                'Учебный товар ' || lpad(g::text, 7, '0'),
                'Сгенерировано для нагрузочного тестирования. ' ||
                    'Запись №' || g || ' создана скриптом seed_big_products.',
                round((random() * 9990 + 10)::numeric, 2),
                (random() * 500)::int,
                (SELECT id FROM categories
                  ORDER BY id OFFSET ((g - 1) % CAST(:ncat AS integer)) LIMIT 1),
                'COURSE-' || lpad(g::text, 7, '0'),
                FALSE,
                'big_seed',
                'big_seed'
              FROM generate_series(CAST(:a AS integer), CAST(:b AS integer)) g
            ON CONFLICT (sku) WHERE sku IS NOT NULL DO NOTHING
            """,
            {"a": g_start, "b": chunk_end, "ncat": TARGET_CATEGORIES},
        )
        n_after = await _count("products")
        delta = n_after - n_before
        inserted_total += delta
        elapsed = time.perf_counter() - start
        print(f"   chunk {g_start:>7}-{chunk_end:>7}: +{delta:>5} (total inserted now {inserted_total:,}, {elapsed:6.1f}s)")
        g_start = chunk_end + 1

    final = await _count("products", "source = 'big_seed'")
    print(f"   done, big_seed products now: {final:,}  ({time.perf_counter()-start:.1f}s)")


async def seed_supplier_products() -> None:
    print(f"==> supplier_products (each big_seed product gets {SUPPLIERS_PER_PRODUCT} suppliers)")
    have = await _count(
        "supplier_products sp JOIN products p ON p.id = sp.product_id",
        "p.source = 'big_seed'",
    )
    print(f"   currently {have:,} big_seed supplier links")
    target = TARGET_PRODUCTS * SUPPLIERS_PER_PRODUCT
    if have >= target:
        print("   target already reached, skipping")
        return
    start = time.perf_counter()

    # generate two supplier-product rows per product using a deterministic
    # but spread-out mapping into the suppliers table
    await db.execute(
        """
        INSERT INTO supplier_products(
            supplier_id, product_id, unit_price, lead_time_days,
            quantity_available, is_active
        )
        SELECT
            s.id,
            p.id,
            round((p.price * 0.7)::numeric, 2),
            (1 + (p.id % 21))::int,
            (random() * 200)::int,
            TRUE
          FROM products p
          JOIN LATERAL (
                SELECT id FROM suppliers
                 ORDER BY id
                 OFFSET ((p.id - 1) %% CAST(:nsup AS integer))
                 LIMIT 1
          ) s ON TRUE
         WHERE p.source = 'big_seed'
        ON CONFLICT DO NOTHING
        """.replace("%%", "%"),
        {"nsup": TARGET_SUPPLIERS},
    )
    # second supplier for each product, offset by a different stride
    await db.execute(
        """
        INSERT INTO supplier_products(
            supplier_id, product_id, unit_price, lead_time_days,
            quantity_available, is_active
        )
        SELECT
            s.id,
            p.id,
            round((p.price * 0.75)::numeric, 2),
            (3 + (p.id % 17))::int,
            (random() * 200)::int,
            TRUE
          FROM products p
          JOIN LATERAL (
                SELECT id FROM suppliers
                 ORDER BY id
                 OFFSET (((p.id - 1) + 37) %% CAST(:nsup AS integer))
                 LIMIT 1
          ) s ON TRUE
         WHERE p.source = 'big_seed'
           AND NOT EXISTS (
                SELECT 1 FROM supplier_products sp2
                 WHERE sp2.product_id = p.id
                   AND sp2.supplier_id = s.id
           )
        ON CONFLICT DO NOTHING
        """.replace("%%", "%"),
        {"nsup": TARGET_SUPPLIERS},
    )
    final = await _count(
        "supplier_products sp JOIN products p ON p.id = sp.product_id",
        "p.source = 'big_seed'",
    )
    print(f"   done, big_seed supplier links now: {final:,}  ({time.perf_counter()-start:.1f}s)")


async def main() -> None:
    await db.connect()
    try:
        t0 = time.perf_counter()
        await seed_categories()
        await seed_suppliers()
        await seed_products()
        await seed_supplier_products()

        prod_total      = await _count("products")
        prod_big        = await _count("products", "source = 'big_seed'")
        cat_total       = await _count("categories")
        sup_total       = await _count("suppliers")
        sp_total        = await _count("supplier_products")
        print("=" * 60)
        print(f"products       total: {prod_total:>10,}   (big_seed: {prod_big:>10,})")
        print(f"categories     total: {cat_total:>10,}")
        print(f"suppliers      total: {sup_total:>10,}")
        print(f"supplier_prod  total: {sp_total:>10,}")
        print(f"elapsed:              {time.perf_counter()-t0:.1f}s")
        print("=" * 60)
    finally:
        await db.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
