"""Seed demo data + test users for the v3 schema. Idempotent.

Run inside the backend container:
    docker compose exec backend python -m app.scripts.seed

Creates:
  - 4 base test users (customer1 / store1 / warehouse1 / supplier1, all password123)
  - 4 additional suppliers + supplier user supplier2..supplier5
  - 10 product categories
  - 50 products with varied stock (some full, some partial, some 0)
  - supplier_products: each supplier supplies 10 products with price + lead time
"""
from __future__ import annotations

import asyncio
import random

from app.db import db
from app.security import hash_password


CATEGORIES = [
    "Электроника", "Канцелярия", "Бытовая техника", "Книги", "Одежда",
    "Спорт", "Продукты", "Игрушки", "Авто", "Сад",
]

# (name, category, base_price, base_stock)
PRODUCTS = [
    # Электроника
    ("Ноутбук Acme 14",       "Электроника",     59990, 25),
    ("Смартфон Acme X",       "Электроника",     34990, 40),
    ("Наушники Bass Pro",     "Электроника",      4990, 100),
    ("Планшет Acme Tab",      "Электроника",     19990,  8),
    ("Умные часы Acme W",     "Электроника",      9990,  0),
    # Канцелярия
    ("Ручка шариковая",       "Канцелярия",         50, 1000),
    ("Бумага A4 500 листов",  "Канцелярия",        650,  300),
    ("Тетрадь 96 листов",     "Канцелярия",         90,  500),
    ("Степлер офисный",       "Канцелярия",        450,   60),
    ("Скрепки 100 шт",        "Канцелярия",         70,    0),
    # Бытовая техника
    ("Кофемашина MiniBrew",   "Бытовая техника", 12990,   3),
    ("Чайник Express",        "Бытовая техника",  2490,  60),
    ("Микроволновка Easy",    "Бытовая техника",  7990,   0),
    ("Пылесос Cyclone",       "Бытовая техника", 14990,  10),
    ("Тостер Crisp",          "Бытовая техника",  2990,  45),
    # Книги
    ("Война и мир",           "Книги",            1190,  20),
    ("Чистый код",            "Книги",            1890,   5),
    ("Алгоритмы",             "Книги",            2490,   2),
    ("Краткая история всего", "Книги",            1290,   0),
    ("Сапиенс",               "Книги",             990,  30),
    # Одежда
    ("Футболка базовая",      "Одежда",            890,  80),
    ("Джинсы Slim",           "Одежда",           2490,  40),
    ("Куртка зимняя",         "Одежда",           7990,   0),
    ("Кроссовки беговые",     "Одежда",           4990,  12),
    ("Носки 3 пары",          "Одежда",            290, 200),
    # Спорт
    ("Гантели 5 кг",          "Спорт",            1490,  18),
    ("Мяч футбольный",        "Спорт",             990,   0),
    ("Коврик для йоги",       "Спорт",            1290,  35),
    ("Велосипед Urban",       "Спорт",           24990,   2),
    ("Скакалка",              "Спорт",             290,   0),
    # Продукты
    ("Кофе зерновой 1кг",     "Продукты",          990,  50),
    ("Чай чёрный 100пак",     "Продукты",          290, 120),
    ("Шоколад горький",       "Продукты",          190,   0),
    ("Печенье овсяное",       "Продукты",           90, 200),
    ("Орехи микс 500г",       "Продукты",          690,  25),
    # Игрушки
    ("Конструктор кирпичики", "Игрушки",          1990,  15),
    ("Машинка радиоуправл.",  "Игрушки",          2490,   0),
    ("Кукла классическая",    "Игрушки",          1290,   8),
    ("Пазл 1000 деталей",     "Игрушки",           990,  22),
    ("Настольная игра",       "Игрушки",          1490,  10),
    # Авто
    ("Масло моторное 5л",     "Авто",             2490,  18),
    ("Дворники авто",         "Авто",              790,  40),
    ("Антифриз 4л",           "Авто",              990,   0),
    ("Лампа H7",              "Авто",              290, 100),
    ("Чехлы на сиденья",      "Авто",             3490,   4),
    # Сад
    ("Лопата садовая",        "Сад",              1290,   7),
    ("Перчатки садовые",      "Сад",               190,  80),
    ("Семена томатов",        "Сад",                50, 300),
    ("Удобрение универс.",    "Сад",               490,   0),
    ("Шланг 20м",             "Сад",              2490,   5),
]

SUPPLIERS = [
    ("ООО Поставщик",        "supplier@example.com"),
    ("ТД Лидер",             "leader@example.com"),
    ("Импортторг",            "import@example.com"),
    ("Логистик-плюс",         "logistic@example.com"),
    ("ЭкспрессДистрибьюция",  "express@example.com"),
]

BASE_USERS = [
    ("customer1",  "customer",  "customers",  {"full_name": "Иван Покупатель", "email": "ivan@example.com"}),
    ("store1",     "store",     "stores",     {"name": "Главный магазин",       "address": "ул. Ленина, 1"}),
    ("warehouse1", "warehouse", "warehouses", {"name": "Центральный склад",     "address": "ул. Складская, 5"}),
]


async def upsert_categories() -> dict[str, int]:
    out: dict[str, int] = {}
    for name in CATEGORIES:
        row = await db.fetch_one(
            """INSERT INTO categories(name) VALUES(:n)
               ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id""",
            {"n": name},
        )
        out[name] = row["id"]
    return out


async def upsert_products(cat_ids: dict[str, int]) -> list[dict]:
    out: list[dict] = []
    for name, cat, price, stock in PRODUCTS:
        existing = await db.fetch_one("SELECT id FROM products WHERE name=:n", {"n": name})
        desc = f"{name} — товар категории «{cat}»"
        if existing:
            await db.execute(
                """UPDATE products SET description=:d, price=:p, stock_quantity=:s,
                       category_id=:c, updated_at=now() WHERE id=:id""",
                {"d": desc, "p": price, "s": stock, "c": cat_ids[cat], "id": existing["id"]},
            )
            pid = existing["id"]
        else:
            row = await db.fetch_one(
                """INSERT INTO products(name, description, price, stock_quantity, category_id)
                   VALUES(:n,:d,:p,:s,:c) RETURNING id""",
                {"n": name, "d": desc, "p": price, "s": stock, "c": cat_ids[cat]},
            )
            pid = row["id"]
        out.append({"id": pid, "name": name, "category": cat, "price": price})
    return out


async def upsert_suppliers() -> list[int]:
    ids: list[int] = []
    for i, (name, contact) in enumerate(SUPPLIERS, start=1):
        existing = await db.fetch_one("SELECT id FROM suppliers WHERE name=:n", {"n": name})
        if existing:
            sid = existing["id"]
        else:
            row = await db.fetch_one(
                "INSERT INTO suppliers(name, contact) VALUES(:n,:c) RETURNING id",
                {"n": name, "c": contact},
            )
            sid = row["id"]
        ids.append(sid)
        # one user per supplier
        uname = f"supplier{i}"
        existing_user = await db.fetch_one("SELECT id FROM users WHERE username=:u", {"u": uname})
        if not existing_user:
            await db.execute(
                """INSERT INTO users(username, password_hash, role, entity_id)
                   VALUES(:u, :h, 'supplier', :e)""",
                {"u": uname, "h": hash_password("password123"), "e": sid},
            )
    return ids


async def upsert_base_users() -> None:
    for username, role, table, fields in BASE_USERS:
        existing = await db.fetch_one("SELECT id FROM users WHERE username=:u", {"u": username})
        if existing:
            continue
        cols = ", ".join(fields.keys())
        placeholders = ", ".join(f":{k}" for k in fields.keys())
        entity = await db.fetch_one(
            f"INSERT INTO {table} ({cols}) VALUES ({placeholders}) RETURNING id", fields
        )
        await db.execute(
            """INSERT INTO users(username, password_hash, role, entity_id)
               VALUES(:u,:h,:r,:e)""",
            {"u": username, "h": hash_password("password123"), "r": role, "e": entity["id"]},
        )


async def upsert_supplier_products(supplier_ids: list[int], products: list[dict]) -> None:
    # deterministic: each supplier gets 10 products (sliding window so overlaps exist)
    rng = random.Random(42)
    for idx, sid in enumerate(supplier_ids):
        start = (idx * 7) % len(products)
        chosen = [products[(start + j) % len(products)] for j in range(10)]
        for prod in chosen:
            lead = rng.choice([2, 3, 5, 7, 10, 14, 21])
            # supplier sells slightly cheaper than retail
            price = round(prod["price"] * rng.uniform(0.55, 0.85), 2)
            await db.execute(
                """INSERT INTO supplier_products(supplier_id, product_id, unit_price, lead_time_days, is_active)
                   VALUES(:s,:p,:u,:l,TRUE)
                   ON CONFLICT (supplier_id, product_id)
                   DO UPDATE SET unit_price=EXCLUDED.unit_price,
                                 lead_time_days=EXCLUDED.lead_time_days,
                                 is_active=TRUE""",
                {"s": sid, "p": prod["id"], "u": price, "l": lead},
            )


async def main() -> None:
    await db.connect()
    try:
        cat_ids = await upsert_categories()
        prods = await upsert_products(cat_ids)
        await upsert_base_users()
        supplier_ids = await upsert_suppliers()
        await upsert_supplier_products(supplier_ids, prods)

        print("=" * 56)
        print(f"Seed complete: {len(cat_ids)} категорий, {len(prods)} товаров, "
              f"{len(supplier_ids)} поставщиков.")
        print("Тестовые пользователи (пароль одинаковый: password123):")
        print("  customer1  / password123")
        print("  store1     / password123")
        print("  warehouse1 / password123")
        for i in range(1, len(SUPPLIERS) + 1):
            print(f"  supplier{i}  / password123")
        print("=" * 56)
    finally:
        await db.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
