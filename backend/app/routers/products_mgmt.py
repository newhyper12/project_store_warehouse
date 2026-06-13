"""Product management endpoints shared by Store and Supplier.

Store: full CRUD on the global products catalog (categories/price/stock).
Supplier: manages its own rows in supplier_products (price, lead time, quantity, notes),
          can also create a new product and connect itself as supplier in one shot.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import db
from ..security import require_role

# ---------------- schemas ----------------
class Category(BaseModel):
    id: int
    name: str


class StoreProductOut(BaseModel):
    id: int
    name: str
    description: str = ""
    price: Decimal
    stock_quantity: int = 0
    sku: Optional[str] = None
    is_active: bool = True
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    suppliers_count: int = 0


class StoreProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    price: Decimal = Field(ge=0)
    stock_quantity: int = Field(ge=0, default=0)
    category_id: Optional[int] = None
    sku: Optional[str] = None
    is_active: bool = True


class StoreProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    price: Optional[Decimal] = Field(default=None, ge=0)
    stock_quantity: Optional[int] = Field(default=None, ge=0)
    category_id: Optional[int] = None
    sku: Optional[str] = None
    is_active: Optional[bool] = None


class SupplierProductOut(BaseModel):
    id: int                       # supplier_products.id
    product_id: int
    product_name: str
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    unit_price: Decimal
    lead_time_days: int
    quantity_available: Optional[int] = None
    notes: Optional[str] = None
    estimated_delivery_date: Optional[date] = None
    is_active: bool = True


class SupplierProductCreate(BaseModel):
    product_id: int
    unit_price: Decimal = Field(ge=0)
    lead_time_days: int = Field(ge=0, default=7)
    quantity_available: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None
    is_active: bool = True


class SupplierProductUpdate(BaseModel):
    unit_price: Optional[Decimal] = Field(default=None, ge=0)
    lead_time_days: Optional[int] = Field(default=None, ge=0)
    quantity_available: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class SupplierCreateAndSupply(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    price: Decimal = Field(ge=0)                   # retail price suggestion
    category_id: Optional[int] = None
    sku: Optional[str] = None
    unit_price: Decimal = Field(ge=0)              # supplier own price
    lead_time_days: int = Field(ge=0, default=7)
    quantity_available: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None


# ===================================================================
# STORE
# ===================================================================
store_router = APIRouter(prefix="/store", tags=["store-products"])
StoreUser = Depends(require_role("store"))


@store_router.get("/categories", response_model=List[Category])
async def store_categories(_: dict = StoreUser):
    rows = await db.fetch_all("SELECT id, name FROM categories ORDER BY name")
    return [dict(r) for r in rows]


@store_router.get("/products-managed", response_model=List[StoreProductOut])
async def store_products_managed(_: dict = StoreUser):
    rows = await db.fetch_all(
        """SELECT p.id, p.name, p.description, p.price, p.stock_quantity, p.sku,
                  COALESCE(p.is_active, TRUE) AS is_active,
                  p.category_id, c.name AS category_name,
                  COALESCE((SELECT COUNT(*) FROM supplier_products sp
                              WHERE sp.product_id = p.id AND sp.is_active = TRUE), 0) AS suppliers_count
             FROM products p LEFT JOIN categories c ON c.id = p.category_id
            ORDER BY p.name"""
    )
    return [dict(r) for r in rows]


@store_router.post("/products", response_model=StoreProductOut, status_code=201)
async def store_create_product(payload: StoreProductCreate, user: dict = StoreUser):
    if payload.category_id is not None:
        cat = await db.fetch_one("SELECT id FROM categories WHERE id=:c", {"c": payload.category_id})
        if not cat:
            raise HTTPException(422, "Категория не найдена")
    row = await db.fetch_one(
        """INSERT INTO products(name, description, price, stock_quantity, category_id,
                                sku, is_active, created_by_user_id, created_by_role)
           VALUES(:n,:d,:p,:s,:c,:sk,:ia,:uid,'store')
           RETURNING id""",
        {"n": payload.name, "d": payload.description, "p": payload.price,
         "s": payload.stock_quantity, "c": payload.category_id,
         "sk": payload.sku, "ia": payload.is_active, "uid": user["id"]},
    )
    return await _store_product_by_id(row["id"])


@store_router.patch("/products/{pid}", response_model=StoreProductOut)
async def store_update_product(pid: int, payload: StoreProductUpdate, _: dict = StoreUser):
    existing = await db.fetch_one("SELECT id FROM products WHERE id=:i", {"i": pid})
    if not existing:
        raise HTTPException(404, "Товар не найден")
    fields: dict = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not fields:
        return await _store_product_by_id(pid)
    if "category_id" in fields and fields["category_id"] is not None:
        cat = await db.fetch_one("SELECT id FROM categories WHERE id=:c", {"c": fields["category_id"]})
        if not cat:
            raise HTTPException(422, "Категория не найдена")
    set_sql = ", ".join(f"{k}=:{k}" for k in fields)
    fields["i"] = pid
    await db.execute(f"UPDATE products SET {set_sql}, updated_at=now() WHERE id=:i", fields)
    return await _store_product_by_id(pid)


async def _store_product_by_id(pid: int) -> dict:
    r = await db.fetch_one(
        """SELECT p.id, p.name, p.description, p.price, p.stock_quantity, p.sku,
                  COALESCE(p.is_active, TRUE) AS is_active,
                  p.category_id, c.name AS category_name,
                  COALESCE((SELECT COUNT(*) FROM supplier_products sp
                              WHERE sp.product_id = p.id AND sp.is_active = TRUE), 0) AS suppliers_count
             FROM products p LEFT JOIN categories c ON c.id = p.category_id
            WHERE p.id = :i""",
        {"i": pid},
    )
    if not r:
        raise HTTPException(404, "Товар не найден")
    return dict(r)


# ===================================================================
# SUPPLIER
# ===================================================================
sup_router = APIRouter(prefix="/supplier", tags=["supplier-products"])
SupUser = Depends(require_role("supplier"))


@sup_router.get("/categories", response_model=List[Category])
async def supplier_categories(_: dict = SupUser):
    rows = await db.fetch_all("SELECT id, name FROM categories ORDER BY name")
    return [dict(r) for r in rows]


@sup_router.get("/products-managed", response_model=List[SupplierProductOut])
async def supplier_products_managed(user: dict = SupUser):
    rows = await db.fetch_all(
        """SELECT sp.id, sp.product_id, p.name AS product_name,
                  p.category_id, c.name AS category_name,
                  sp.unit_price, sp.lead_time_days, sp.quantity_available, sp.notes,
                  sp.estimated_delivery_date, sp.is_active
             FROM supplier_products sp
             JOIN products p   ON p.id = sp.product_id
        LEFT JOIN categories c ON c.id = p.category_id
            WHERE sp.supplier_id = :s
            ORDER BY p.name""",
        {"s": user["entity_id"]},
    )
    today = date.today()
    out = []
    for r in rows:
        d = dict(r)
        if d.get("estimated_delivery_date") is None:
            d["estimated_delivery_date"] = today + timedelta(days=int(d["lead_time_days"]))
        out.append(d)
    return out


@sup_router.get("/products-catalog")
async def supplier_products_catalog(user: dict = SupUser):
    """Global product catalog with a flag telling whether this supplier already supplies it."""
    rows = await db.fetch_all(
        """SELECT p.id, p.name, p.description, p.price,
                  p.category_id, c.name AS category_name,
                  EXISTS(SELECT 1 FROM supplier_products sp
                          WHERE sp.product_id = p.id AND sp.supplier_id = :s) AS already_supplied
             FROM products p LEFT JOIN categories c ON c.id = p.category_id
            WHERE COALESCE(p.is_active, TRUE) = TRUE
            ORDER BY p.name""",
        {"s": user["entity_id"]},
    )
    return [dict(r) for r in rows]


@sup_router.post("/products", response_model=SupplierProductOut, status_code=201)
async def supplier_connect_product(payload: SupplierProductCreate, user: dict = SupUser):
    prod = await db.fetch_one("SELECT id FROM products WHERE id=:p", {"p": payload.product_id})
    if not prod:
        raise HTTPException(404, "Товар не найден")
    existing = await db.fetch_one(
        "SELECT id FROM supplier_products WHERE supplier_id=:s AND product_id=:p",
        {"s": user["entity_id"], "p": payload.product_id},
    )
    if existing:
        raise HTTPException(409, "Этот товар уже есть в вашем каталоге")
    row = await db.fetch_one(
        """INSERT INTO supplier_products(supplier_id, product_id, unit_price, lead_time_days,
                                         quantity_available, notes, is_active)
           VALUES(:s,:p,:u,:l,:q,:n,:a) RETURNING id""",
        {"s": user["entity_id"], "p": payload.product_id, "u": payload.unit_price,
         "l": payload.lead_time_days, "q": payload.quantity_available,
         "n": payload.notes, "a": payload.is_active},
    )
    return await _supplier_product_by_id(row["id"], user["entity_id"])


@sup_router.post("/products/create-and-supply", response_model=SupplierProductOut, status_code=201)
async def supplier_create_and_supply(payload: SupplierCreateAndSupply, user: dict = SupUser):
    if payload.category_id is not None:
        cat = await db.fetch_one("SELECT id FROM categories WHERE id=:c", {"c": payload.category_id})
        if not cat:
            raise HTTPException(422, "Категория не найдена")
    async with db.transaction():
        prod = await db.fetch_one(
            """INSERT INTO products(name, description, price, stock_quantity, category_id,
                                    sku, is_active, created_by_user_id, created_by_role)
               VALUES(:n,:d,:p,0,:c,:sk,TRUE,:uid,'supplier')
               RETURNING id""",
            {"n": payload.name, "d": payload.description, "p": payload.price,
             "c": payload.category_id, "sk": payload.sku, "uid": user["id"]},
        )
        sp = await db.fetch_one(
            """INSERT INTO supplier_products(supplier_id, product_id, unit_price, lead_time_days,
                                             quantity_available, notes, is_active)
               VALUES(:s,:p,:u,:l,:q,:n,TRUE) RETURNING id""",
            {"s": user["entity_id"], "p": prod["id"], "u": payload.unit_price,
             "l": payload.lead_time_days, "q": payload.quantity_available, "n": payload.notes},
        )
    return await _supplier_product_by_id(sp["id"], user["entity_id"])


@sup_router.patch("/products/{spid}", response_model=SupplierProductOut)
async def supplier_update_product(spid: int, payload: SupplierProductUpdate, user: dict = SupUser):
    existing = await db.fetch_one(
        "SELECT id FROM supplier_products WHERE id=:i AND supplier_id=:s",
        {"i": spid, "s": user["entity_id"]},
    )
    if not existing:
        raise HTTPException(404, "Запись не найдена")
    fields = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not fields:
        return await _supplier_product_by_id(spid, user["entity_id"])
    set_sql = ", ".join(f"{k}=:{k}" for k in fields)
    fields["i"] = spid
    await db.execute(f"UPDATE supplier_products SET {set_sql}, updated_at=now() WHERE id=:i", fields)
    return await _supplier_product_by_id(spid, user["entity_id"])


async def _supplier_product_by_id(spid: int, supplier_id: int) -> dict:
    r = await db.fetch_one(
        """SELECT sp.id, sp.product_id, p.name AS product_name,
                  p.category_id, c.name AS category_name,
                  sp.unit_price, sp.lead_time_days, sp.quantity_available, sp.notes,
                  sp.estimated_delivery_date, sp.is_active
             FROM supplier_products sp
             JOIN products p ON p.id = sp.product_id
        LEFT JOIN categories c ON c.id = p.category_id
            WHERE sp.id = :i AND sp.supplier_id = :s""",
        {"i": spid, "s": supplier_id},
    )
    if not r:
        raise HTTPException(404, "Запись не найдена")
    d = dict(r)
    if d.get("estimated_delivery_date") is None:
        d["estimated_delivery_date"] = date.today() + timedelta(days=int(d["lead_time_days"]))
    return d
