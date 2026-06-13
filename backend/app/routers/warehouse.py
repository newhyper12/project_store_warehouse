"""Warehouse endpoints. warehouse_id from JWT."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import db
from ..orders import log_status
from ..schemas import ProductWithStock, RejectPayload, RequestItemOut, WarehouseRequestOut
from ..security import require_role

router = APIRouter(prefix="/warehouse", tags=["warehouse"])
WHUser = Depends(require_role("warehouse"))

_ALLOWED = {"pending", "processing", "approved", "rejected", "shipped"}


async def _items(rid: int) -> list[RequestItemOut]:
    rows = await db.fetch_all(
        """SELECT i.product_id, p.name AS product_name, c.name AS category_name,
                  i.requested_quantity, i.approved_quantity, p.stock_quantity,
                  NULL::date AS estimated_delivery_date
             FROM warehouse_request_items i
             JOIN products p ON p.id = i.product_id
        LEFT JOIN categories c ON c.id = p.category_id
            WHERE i.request_id = :r""",
        {"r": rid},
    )
    return [RequestItemOut(**dict(r)) for r in rows]


async def _load(rid: int, warehouse_id: int) -> WarehouseRequestOut:
    head = await db.fetch_one(
        """SELECT id, application_id, store_id, warehouse_id, status::text AS status,
                  reject_reason, created_at
             FROM warehouse_requests WHERE id = :id AND warehouse_id = :w""",
        {"id": rid, "w": warehouse_id},
    )
    if not head:
        raise HTTPException(404, "Запрос не найден")
    return WarehouseRequestOut(**dict(head), items=await _items(rid))


async def _maybe_complete_application(app_id: int, user_id: int) -> None:
    """Set application = completed only when warehouse + supplier parts are both done."""
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


@router.get("/products", response_model=List[ProductWithStock])
async def products(_: dict = WHUser):
    rows = await db.fetch_all(
        """SELECT p.id, p.name, p.description, p.price, p.stock_quantity,
                  p.category_id, c.name AS category_name
             FROM products p LEFT JOIN categories c ON c.id = p.category_id
            ORDER BY p.name"""
    )
    return [dict(r) for r in rows]


@router.get("/requests", response_model=List[WarehouseRequestOut])
async def list_requests(status: str = Query("pending"), user: dict = WHUser):
    if status not in _ALLOWED:
        raise HTTPException(400, f"status must be one of {sorted(_ALLOWED)}")
    rows = await db.fetch_all(
        """SELECT id, application_id, store_id, warehouse_id, status::text AS status,
                  reject_reason, created_at
             FROM warehouse_requests
            WHERE warehouse_id = :w AND status = :s
            ORDER BY created_at""",
        {"w": user["entity_id"], "s": status},
    )
    return [WarehouseRequestOut(**dict(r), items=await _items(r["id"])) for r in rows]


@router.post("/requests/{rid}/accept", response_model=WarehouseRequestOut)
async def accept(rid: int, user: dict = WHUser):
    async with db.transaction():
        row = await db.fetch_one(
            "SELECT application_id, status::text AS status FROM warehouse_requests WHERE id=:id AND warehouse_id=:w",
            {"id": rid, "w": user["entity_id"]},
        )
        if not row:
            raise HTTPException(404, "Запрос не найден")
        if row["status"] != "pending":
            raise HTTPException(409, "Только pending запросы можно принять")
        await db.execute(
            "UPDATE warehouse_requests SET status='processing', updated_at=now() WHERE id=:id",
            {"id": rid},
        )
        await log_status(row["application_id"], "warehouse_processing", "Склад принял в обработку", user["id"])
    return await _load(rid, user["entity_id"])


@router.post("/requests/{rid}/approve", response_model=WarehouseRequestOut)
async def approve(rid: int, user: dict = WHUser):
    async with db.transaction():
        head = await db.fetch_one(
            "SELECT application_id, status::text AS status FROM warehouse_requests WHERE id=:id AND warehouse_id=:w",
            {"id": rid, "w": user["entity_id"]},
        )
        if not head:
            raise HTTPException(404, "Запрос не найден")
        if head["status"] not in ("pending", "processing"):
            raise HTTPException(409, "Неверный статус для одобрения")
        items = await db.fetch_all(
            """SELECT i.id, i.product_id, i.requested_quantity, p.stock_quantity
                 FROM warehouse_request_items i JOIN products p ON p.id = i.product_id
                WHERE i.request_id = :r FOR UPDATE OF p""",
            {"r": rid},
        )
        for it in items:
            if it["stock_quantity"] < it["requested_quantity"]:
                raise HTTPException(409,
                    f"Недостаточно товара (id={it['product_id']}): "
                    f"остаток {it['stock_quantity']}, нужно {it['requested_quantity']}")
        for it in items:
            await db.execute(
                "UPDATE warehouse_request_items SET approved_quantity=:q WHERE id=:id",
                {"q": it["requested_quantity"], "id": it["id"]},
            )
            await db.execute(
                "UPDATE products SET stock_quantity=stock_quantity-:q, updated_at=now() WHERE id=:p",
                {"q": it["requested_quantity"], "p": it["product_id"]},
            )
        await db.execute(
            "UPDATE warehouse_requests SET status='approved', updated_at=now() WHERE id=:id",
            {"id": rid},
        )
        await log_status(head["application_id"], "warehouse_approved",
                         "Склад одобрил, остатки списаны", user["id"])
    return await _load(rid, user["entity_id"])


@router.post("/requests/{rid}/reject", response_model=WarehouseRequestOut)
async def reject(rid: int, payload: RejectPayload, user: dict = WHUser):
    async with db.transaction():
        head = await db.fetch_one(
            "SELECT application_id, status::text AS status FROM warehouse_requests WHERE id=:id AND warehouse_id=:w",
            {"id": rid, "w": user["entity_id"]},
        )
        if not head:
            raise HTTPException(404, "Запрос не найден")
        if head["status"] in ("rejected", "shipped"):
            raise HTTPException(409, f"Нельзя отклонить в статусе '{head['status']}'")
        await db.execute(
            "UPDATE warehouse_requests SET status='rejected', reject_reason=:r, updated_at=now() WHERE id=:id",
            {"id": rid, "r": payload.reason.strip()},
        )
        await log_status(head["application_id"], "warehouse_rejected", payload.reason.strip(), user["id"])
        # if there are no other open parts, mark app as warehouse_rejected
        open_sp = await db.fetch_one(
            """SELECT COUNT(*) AS c FROM supplier_requests
                WHERE application_id = :a AND status NOT IN ('shipped','rejected')""",
            {"a": head["application_id"]},
        )
        if (open_sp["c"] or 0) == 0:
            await db.execute(
                "UPDATE customer_order_applications SET status='warehouse_rejected', reject_reason=:r, updated_at=now() WHERE id=:id",
                {"id": head["application_id"], "r": payload.reason.strip()},
            )
    return await _load(rid, user["entity_id"])


@router.post("/requests/{rid}/ship", response_model=WarehouseRequestOut)
async def ship(rid: int, user: dict = WHUser):
    async with db.transaction():
        head = await db.fetch_one(
            "SELECT application_id, status::text AS status FROM warehouse_requests WHERE id=:id AND warehouse_id=:w",
            {"id": rid, "w": user["entity_id"]},
        )
        if not head:
            raise HTTPException(404, "Запрос не найден")
        if head["status"] != "approved":
            raise HTTPException(409, "Отгрузить можно только одобренный запрос")
        await db.execute(
            "UPDATE warehouse_requests SET status='shipped', updated_at=now() WHERE id=:id",
            {"id": rid},
        )
        await log_status(head["application_id"], "warehouse_shipped", "Склад отгрузил", user["id"])
        await _maybe_complete_application(head["application_id"], user["id"])
    return await _load(rid, user["entity_id"])
