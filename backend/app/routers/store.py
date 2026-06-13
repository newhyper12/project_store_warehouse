"""Store endpoints. store_id ALWAYS taken from JWT."""
from __future__ import annotations
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import db
from ..orders import load_application, log_status
from ..pagination import build_page, page_params
from ..schemas import (
    OrderApplicationOut,
    ProductCatalogEntry,
    ProposalCreate,
    RejectPayload,
    RequestItemOut,
    RouteWarehousePayload,
    SupplierRequestOut,
    WarehouseRequestOut,
)
from ..security import require_role

router = APIRouter(prefix="/store", tags=["store"])
StoreUser = Depends(require_role("store"))


# ---------- catalog ----------
@router.get("/products")
async def products(
    pp: tuple[int, int] = Depends(page_params),
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    _: dict = StoreUser,
):
    page, page_size = pp
    where = ["TRUE"]
    args: dict = {}
    if search and search.strip():
        where.append("(p.name ILIKE :q OR COALESCE(p.sku,'') ILIKE :q)")
        args["q"] = f"%{search.strip()}%"
    if category_id is not None:
        where.append("p.category_id = :cid")
        args["cid"] = category_id
    where_sql = " AND ".join(where)
    total = int((await db.fetch_one(
        f"SELECT COUNT(*) AS c FROM products p WHERE {where_sql}", args
    ))["c"] or 0)
    args_page = {**args, "lim": page_size, "off": (page - 1) * page_size}
    rows = await db.fetch_all(
        f"""SELECT p.id, p.name, p.description, p.price, p.stock_quantity,
                   p.category_id, c.name AS category_name
              FROM products p LEFT JOIN categories c ON c.id = p.category_id
             WHERE {where_sql}
          ORDER BY p.name
             LIMIT :lim OFFSET :off""",
        args_page,
    )
    items = [{**dict(r), "in_stock": (r["stock_quantity"] or 0) > 0, "suppliers": []} for r in rows]
    return build_page(items, total, page, page_size)


# ---------- list / get applications ----------
@router.get("/customer-applications", response_model=List[OrderApplicationOut])
async def list_applications(user: dict = StoreUser):
    rows = await db.fetch_all(
        "SELECT id FROM customer_order_applications WHERE store_id = :sid ORDER BY created_at DESC",
        {"sid": user["entity_id"]},
    )
    return [
        await load_application(r["id"], store_id=user["entity_id"], include_live_availability=True)
        for r in rows
    ]


@router.get("/customer-applications/{app_id}", response_model=OrderApplicationOut)
async def get_application(app_id: int, user: dict = StoreUser):
    return await load_application(
        app_id, store_id=user["entity_id"], include_live_availability=True
    )


# ---------- create proposal (partial / split) ----------
@router.post("/customer-applications/{app_id}/proposal", response_model=OrderApplicationOut)
async def create_proposal(app_id: int, payload: ProposalCreate, user: dict = StoreUser):
    async with db.transaction():
        head = await db.fetch_one(
            """SELECT id, status::text AS status FROM customer_order_applications
                WHERE id = :id AND store_id = :sid FOR UPDATE""",
            {"id": app_id, "sid": user["entity_id"]},
        )
        if not head:
            raise HTTPException(404, "Заявка не найдена")
        if head["status"] not in ("pending_store_review", "accepted_by_store"):
            raise HTTPException(409, f"Нельзя создать предложение в статусе '{head['status']}'")

        # close any earlier pending proposals
        await db.execute(
            """UPDATE customer_order_proposals SET status='expired', updated_at=now()
                WHERE application_id = :a AND status = 'pending_customer_decision'""",
            {"a": app_id},
        )

        # fetch order items + stock + supplier catalog
        item_rows = await db.fetch_all(
            """SELECT i.id, i.product_id, i.quantity, p.stock_quantity
                 FROM customer_order_application_items i
                 JOIN products p ON p.id = i.product_id
                WHERE i.application_id = :a""",
            {"a": app_id},
        )
        items_by_id = {r["id"]: dict(r) for r in item_rows}

        prop = await db.fetch_one(
            """INSERT INTO customer_order_proposals (application_id, store_id, status, message)
               VALUES (:a, :s, 'pending_customer_decision', :m) RETURNING id""",
            {"a": app_id, "s": user["entity_id"], "m": payload.message},
        )
        pid = prop["id"]

        today = date.today()
        for pit in payload.items:
            src = items_by_id.get(pit.application_item_id)
            if not src:
                raise HTTPException(422, f"item {pit.application_item_id} не принадлежит заявке")
            total = pit.proposed_warehouse_quantity + pit.proposed_supplier_quantity
            if pit.proposed_action != "exclude" and total > src["quantity"]:
                raise HTTPException(422,
                    f"Сумма количеств превышает заказ для товара #{src['product_id']}")
            if pit.proposed_warehouse_quantity > src["stock_quantity"]:
                raise HTTPException(422,
                    f"Запрошено со склада больше, чем доступно для товара #{src['product_id']}")
            edd = None
            if pit.proposed_action == "supplier":
                if not pit.supplier_id:
                    raise HTTPException(422, "Для supplier action нужен supplier_id")
                sp = await db.fetch_one(
                    """SELECT lead_time_days FROM supplier_products
                        WHERE supplier_id = :s AND product_id = :p AND is_active = TRUE""",
                    {"s": pit.supplier_id, "p": src["product_id"]},
                )
                if not sp:
                    raise HTTPException(422,
                        f"Поставщик #{pit.supplier_id} не поставляет товар #{src['product_id']}")
                edd = today + timedelta(days=int(sp["lead_time_days"]))

            await db.execute(
                """INSERT INTO customer_order_proposal_items
                   (proposal_id, application_item_id, product_id, requested_quantity,
                    warehouse_available_quantity, proposed_warehouse_quantity,
                    proposed_supplier_quantity, proposed_action, supplier_id,
                    estimated_delivery_date)
                   VALUES (:pid, :aii, :pr, :rq, :wa, :pw, :ps, :pa, :sid, :edd)""",
                {"pid": pid, "aii": pit.application_item_id, "pr": src["product_id"],
                 "rq": src["quantity"], "wa": src["stock_quantity"],
                 "pw": pit.proposed_warehouse_quantity, "ps": pit.proposed_supplier_quantity,
                 "pa": pit.proposed_action, "sid": pit.supplier_id, "edd": edd},
            )
            # snapshot stock onto application item
            await db.execute(
                """UPDATE customer_order_application_items
                      SET warehouse_available_quantity_snapshot = :w
                    WHERE id = :id""",
                {"w": src["stock_quantity"], "id": pit.application_item_id},
            )

        await db.execute(
            """UPDATE customer_order_applications
                  SET status = 'pending_customer_decision', updated_at = now()
                WHERE id = :id""",
            {"id": app_id},
        )
        await log_status(app_id, "pending_customer_decision",
                         "Магазин предложил частичное выполнение, ждём решения покупателя", user["id"])
    return await load_application(app_id, store_id=user["entity_id"], include_live_availability=True)


# ---------- direct routing when everything is in stock ----------
@router.post("/customer-applications/{app_id}/route-warehouse", response_model=OrderApplicationOut)
async def route_warehouse(
    app_id: int, payload: RouteWarehousePayload | None = None, user: dict = StoreUser
):
    payload = payload or RouteWarehousePayload()
    async with db.transaction():
        head = await db.fetch_one(
            """SELECT id, status::text AS status FROM customer_order_applications
                WHERE id = :id AND store_id = :sid FOR UPDATE""",
            {"id": app_id, "sid": user["entity_id"]},
        )
        if not head:
            raise HTTPException(404, "Заявка не найдена")
        if head["status"] not in ("pending_store_review", "accepted_by_store"):
            raise HTTPException(409, f"Нельзя направить заявку в статусе '{head['status']}'")

        items = await db.fetch_all(
            """SELECT i.id, i.product_id, i.quantity, p.stock_quantity
                 FROM customer_order_application_items i
                 JOIN products p ON p.id = i.product_id
                WHERE i.application_id = :a FOR UPDATE OF p""",
            {"a": app_id},
        )
        for it in items:
            if it["stock_quantity"] < it["quantity"]:
                raise HTTPException(409,
                    f"Недостаточно на складе для товара #{it['product_id']}: "
                    f"есть {it['stock_quantity']}, нужно {it['quantity']}. "
                    f"Создайте частичное предложение покупателю.")
        wh_id = payload.warehouse_id
        if wh_id is None:
            wh = await db.fetch_one("SELECT id FROM warehouses ORDER BY id LIMIT 1")
            if not wh:
                raise HTTPException(400, "Нет настроенных складов")
            wh_id = wh["id"]
        wr = await db.fetch_one(
            """INSERT INTO warehouse_requests (application_id, store_id, warehouse_id, status)
               VALUES (:a, :s, :w, 'pending') RETURNING id""",
            {"a": app_id, "s": user["entity_id"], "w": wh_id},
        )
        for it in items:
            await db.execute(
                """INSERT INTO warehouse_request_items (request_id, product_id, requested_quantity)
                   VALUES (:r, :p, :q)""",
                {"r": wr["id"], "p": it["product_id"], "q": it["quantity"]},
            )
            await db.execute(
                """UPDATE customer_order_application_items
                      SET fulfillment_source='warehouse', approved_quantity=:q,
                          item_status='routed_warehouse'
                    WHERE id = :id""",
                {"q": it["quantity"], "id": it["id"]},
            )
        await db.execute(
            "UPDATE customer_order_applications SET status='sent_to_warehouse', updated_at=now() WHERE id=:id",
            {"id": app_id},
        )
        await log_status(app_id, "accepted_by_store", "Магазин принял заявку полностью", user["id"])
        await log_status(app_id, "sent_to_warehouse",
                         f"Создан запрос на склад #{wr['id']}", user["id"])
    return await load_application(app_id, store_id=user["entity_id"], include_live_availability=True)


@router.post("/customer-applications/{app_id}/reject", response_model=OrderApplicationOut)
async def reject(app_id: int, payload: RejectPayload, user: dict = StoreUser):
    async with db.transaction():
        head = await db.fetch_one(
            """SELECT id, status::text AS status FROM customer_order_applications
                WHERE id = :id AND store_id = :sid FOR UPDATE""",
            {"id": app_id, "sid": user["entity_id"]},
        )
        if not head:
            raise HTTPException(404, "Заявка не найдена")
        forbidden = {"warehouse_processing", "warehouse_approved", "warehouse_shipped",
                     "supplier_processing", "supplier_shipped", "completed", "cancelled",
                     "cancelled_by_customer"}
        if head["status"] in forbidden:
            raise HTTPException(409, f"Нельзя отклонить заявку в статусе '{head['status']}'")
        await db.execute(
            """UPDATE customer_order_applications
                  SET status='rejected_by_store', reject_reason=:r, updated_at=now()
                WHERE id=:id""",
            {"id": app_id, "r": payload.reason.strip()},
        )
        # close any pending proposal
        await db.execute(
            """UPDATE customer_order_proposals
                  SET status='rejected', customer_decision_at=now(), updated_at=now()
                WHERE application_id=:a AND status='pending_customer_decision'""",
            {"a": app_id},
        )
        await log_status(app_id, "rejected_by_store", payload.reason.strip(), user["id"])
    return await load_application(app_id, store_id=user["entity_id"], include_live_availability=True)


# ---------- read-only: warehouse / supplier requests created by this store ----------
async def _items_for_warehouse_request(rid: int) -> list[RequestItemOut]:
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


async def _items_for_supplier_request(rid: int) -> list[RequestItemOut]:
    rows = await db.fetch_all(
        """SELECT i.product_id, p.name AS product_name, c.name AS category_name,
                  i.requested_quantity, NULL::int AS approved_quantity,
                  NULL::int AS stock_quantity,
                  (CURRENT_DATE + COALESCE(sp.lead_time_days, 7) * INTERVAL '1 day')::date
                    AS estimated_delivery_date
             FROM supplier_request_items i
             JOIN supplier_requests sr ON sr.id = i.request_id
             JOIN products p ON p.id = i.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN supplier_products sp
               ON sp.product_id = i.product_id AND sp.supplier_id = sr.supplier_id
            WHERE i.request_id = :r""",
        {"r": rid},
    )
    return [RequestItemOut(**dict(r)) for r in rows]


@router.get("/warehouse-requests/me", response_model=List[WarehouseRequestOut])
async def my_warehouse_requests(user: dict = StoreUser):
    rows = await db.fetch_all(
        """SELECT id, application_id, store_id, warehouse_id, status::text AS status,
                  reject_reason, created_at
             FROM warehouse_requests WHERE store_id = :sid ORDER BY created_at DESC""",
        {"sid": user["entity_id"]},
    )
    return [
        WarehouseRequestOut(**dict(r), items=await _items_for_warehouse_request(r["id"]))
        for r in rows
    ]


@router.get("/supplier-requests/me", response_model=List[SupplierRequestOut])
async def my_supplier_requests(user: dict = StoreUser):
    rows = await db.fetch_all(
        """SELECT id, application_id, store_id, supplier_id, status::text AS status,
                  reject_reason, created_at
             FROM supplier_requests WHERE store_id = :sid ORDER BY created_at DESC""",
        {"sid": user["entity_id"]},
    )
    return [
        SupplierRequestOut(**dict(r), items=await _items_for_supplier_request(r["id"]))
        for r in rows
    ]
