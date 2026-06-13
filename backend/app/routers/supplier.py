"""Supplier endpoints. supplier_id from JWT."""
from __future__ import annotations

from datetime import date, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import db
from ..orders import log_status
from ..schemas import (
    Product,
    RejectPayload,
    RequestItemOut,
    ShipmentCreate,
    ShipmentItemOut,
    ShipmentOut,
    SupplierRequestOut,
)
from ..security import require_role

router = APIRouter(prefix="/supplier", tags=["supplier"])
SupUser = Depends(require_role("supplier"))

_ALLOWED = {"pending", "processing", "approved", "rejected", "shipped", "cancelled"}


async def _items(rid: int, supplier_id: int) -> list[RequestItemOut]:
    rows = await db.fetch_all(
        """SELECT i.product_id, p.name AS product_name, c.name AS category_name,
                  i.requested_quantity, NULL::int AS approved_quantity,
                  NULL::int AS stock_quantity,
                  (CURRENT_DATE + COALESCE(sp.lead_time_days, 7) * INTERVAL '1 day')::date
                    AS estimated_delivery_date
             FROM supplier_request_items i
             JOIN products p ON p.id = i.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN supplier_products sp
               ON sp.product_id = i.product_id AND sp.supplier_id = :s
            WHERE i.request_id = :r""",
        {"r": rid, "s": supplier_id},
    )
    return [RequestItemOut(**dict(r)) for r in rows]


async def _load(rid: int, supplier_id: int) -> SupplierRequestOut:
    head = await db.fetch_one(
        """SELECT id, application_id, store_id, supplier_id, status::text AS status,
                  reject_reason, created_at
             FROM supplier_requests WHERE id = :id AND supplier_id = :s""",
        {"id": rid, "s": supplier_id},
    )
    if not head:
        raise HTTPException(404, "Запрос не найден")
    return SupplierRequestOut(**dict(head), items=await _items(rid, supplier_id))


async def _maybe_complete_application(app_id: int, user_id: int) -> None:
    open_wh = await db.fetch_one(
        """SELECT COUNT(*) AS c FROM warehouse_requests
            WHERE application_id = :a AND status NOT IN ('shipped','rejected')""",
        {"a": app_id},
    )
    open_sp = await db.fetch_one(
        """SELECT COUNT(*) AS c FROM supplier_requests
            WHERE application_id = :a AND status NOT IN ('shipped','rejected')""",
        {"a": app_id},
    )
    if (open_wh["c"] or 0) == 0 and (open_sp["c"] or 0) == 0:
        await db.execute(
            "UPDATE customer_order_applications SET status='completed', updated_at=now() WHERE id=:a",
            {"a": app_id},
        )
        await log_status(app_id, "completed", "Заказ выполнен", user_id)


@router.get("/products", response_model=List[Product])
async def products(user: dict = SupUser):
    # only products this supplier supplies
    rows = await db.fetch_all(
        """SELECT p.id, p.name, p.description, p.price, p.category_id, c.name AS category_name
             FROM supplier_products sp
             JOIN products p ON p.id = sp.product_id
        LEFT JOIN categories c ON c.id = p.category_id
            WHERE sp.supplier_id = :s AND sp.is_active = TRUE
            ORDER BY p.name""",
        {"s": user["entity_id"]},
    )
    return [dict(r) for r in rows]


@router.get("/requests", response_model=List[SupplierRequestOut])
async def list_requests(status: str = Query("pending"), user: dict = SupUser):
    if status not in _ALLOWED:
        raise HTTPException(400, f"status must be one of {sorted(_ALLOWED)}")
    rows = await db.fetch_all(
        """SELECT id, application_id, store_id, supplier_id, status::text AS status,
                  reject_reason, created_at
             FROM supplier_requests
            WHERE supplier_id = :s AND status = :st
            ORDER BY created_at""",
        {"s": user["entity_id"], "st": status},
    )
    return [
        SupplierRequestOut(**dict(r), items=await _items(r["id"], user["entity_id"]))
        for r in rows
    ]


@router.post("/requests/{rid}/accept", response_model=SupplierRequestOut)
async def accept(rid: int, user: dict = SupUser):
    async with db.transaction():
        head = await db.fetch_one(
            "SELECT application_id, status::text AS status FROM supplier_requests WHERE id=:id AND supplier_id=:s",
            {"id": rid, "s": user["entity_id"]},
        )
        if not head:
            raise HTTPException(404, "Запрос не найден")
        if head["status"] != "pending":
            raise HTTPException(409, "Принять можно только pending")
        await db.execute(
            "UPDATE supplier_requests SET status='processing', accepted_at=now(), updated_at=now() WHERE id=:id",
            {"id": rid},
        )
        await log_status(head["application_id"], "supplier_processing", "Поставщик принял в обработку", user["id"])
    return await _load(rid, user["entity_id"])


@router.post("/requests/{rid}/approve", response_model=SupplierRequestOut)
async def approve(rid: int, user: dict = SupUser):
    async with db.transaction():
        head = await db.fetch_one(
            "SELECT application_id, status::text AS status FROM supplier_requests WHERE id=:id AND supplier_id=:s",
            {"id": rid, "s": user["entity_id"]},
        )
        if not head:
            raise HTTPException(404, "Запрос не найден")
        if head["status"] not in ("pending", "processing"):
            raise HTTPException(409, "Неверный статус для одобрения")
        await db.execute(
            "UPDATE supplier_requests SET status='approved', approved_at=now(), updated_at=now() WHERE id=:id",
            {"id": rid},
        )
        await log_status(head["application_id"], "supplier_approved",
                         "Поставщик подтвердил поставку", user["id"])
    return await _load(rid, user["entity_id"])


@router.post("/requests/{rid}/reject", response_model=SupplierRequestOut)
async def reject(rid: int, payload: RejectPayload, user: dict = SupUser):
    async with db.transaction():
        head = await db.fetch_one(
            "SELECT application_id, status::text AS status FROM supplier_requests WHERE id=:id AND supplier_id=:s",
            {"id": rid, "s": user["entity_id"]},
        )
        if not head:
            raise HTTPException(404, "Запрос не найден")
        if head["status"] in ("rejected", "shipped"):
            raise HTTPException(409, f"Нельзя отклонить в статусе '{head['status']}'")
        await db.execute(
            "UPDATE supplier_requests SET status='rejected', reject_reason=:r, updated_at=now() WHERE id=:id",
            {"id": rid, "r": payload.reason.strip()},
        )
        await log_status(head["application_id"], "supplier_rejected", payload.reason.strip(), user["id"])
        open_wh = await db.fetch_one(
            """SELECT COUNT(*) AS c FROM warehouse_requests
                WHERE application_id = :a AND status NOT IN ('shipped','rejected')""",
            {"a": head["application_id"]},
        )
        if (open_wh["c"] or 0) == 0:
            await db.execute(
                "UPDATE customer_order_applications SET status='supplier_rejected', reject_reason=:r, updated_at=now() WHERE id=:id",
                {"id": head["application_id"], "r": payload.reason.strip()},
            )
    return await _load(rid, user["entity_id"])


@router.post("/requests/{rid}/ship", response_model=ShipmentOut)
async def ship(rid: int, payload: ShipmentCreate, user: dict = SupUser):
    async with db.transaction():
        head = await db.fetch_one(
            "SELECT application_id, status::text AS status FROM supplier_requests WHERE id=:id AND supplier_id=:s",
            {"id": rid, "s": user["entity_id"]},
        )
        if not head:
            raise HTTPException(404, "Запрос не найден")
        if head["status"] not in ("processing", "approved"):
            raise HTTPException(409, "Отгрузить можно только запрос в обработке или одобренный")
        sh = await db.fetch_one(
            """INSERT INTO shipments (supplier_request_id, supplier_id, expected_date, notes)
               VALUES (:r, :s, :d, :n)
               RETURNING id, supplier_request_id, supplier_id, expected_date, notes, created_at""",
            {"r": rid, "s": user["entity_id"], "d": payload.expected_date, "n": payload.notes},
        )
        items_out: list[ShipmentItemOut] = []
        for it in payload.items:
            prod = await db.fetch_one("SELECT name FROM products WHERE id=:p", {"p": it.product_id})
            if not prod:
                raise HTTPException(404, f"Товар #{it.product_id} не найден")
            await db.execute(
                """INSERT INTO shipment_items (shipment_id, product_id, quantity, unit_price)
                   VALUES (:s, :p, :q, :u)""",
                {"s": sh["id"], "p": it.product_id, "q": it.quantity, "u": it.unit_price},
            )
            # supplier ships INTO the warehouse — bump stock
            await db.execute(
                "UPDATE products SET stock_quantity=stock_quantity+:q, updated_at=now() WHERE id=:p",
                {"q": it.quantity, "p": it.product_id},
            )
            items_out.append(ShipmentItemOut(
                product_id=it.product_id, product_name=prod["name"],
                quantity=it.quantity, unit_price=it.unit_price,
            ))
        await db.execute(
            "UPDATE supplier_requests SET status='shipped', shipped_at=now(), updated_at=now() WHERE id=:id",
            {"id": rid},
        )
        await log_status(head["application_id"], "supplier_shipped", "Поставщик отгрузил", user["id"])
        await _maybe_complete_application(head["application_id"], user["id"])
    return ShipmentOut(**dict(sh), items=items_out)


@router.get("/shipments/me", response_model=List[ShipmentOut])
async def my_shipments(user: dict = SupUser):
    rows = await db.fetch_all(
        """SELECT id, supplier_request_id, supplier_id, expected_date, notes, created_at
             FROM shipments WHERE supplier_id = :s ORDER BY created_at DESC""",
        {"s": user["entity_id"]},
    )
    out: list[ShipmentOut] = []
    for r in rows:
        items = await db.fetch_all(
            """SELECT i.product_id, p.name AS product_name, i.quantity, i.unit_price
                 FROM shipment_items i JOIN products p ON p.id = i.product_id
                WHERE i.shipment_id = :s""",
            {"s": r["id"]},
        )
        out.append(ShipmentOut(**dict(r),
                               items=[ShipmentItemOut(**dict(i)) for i in items]))
    return out
