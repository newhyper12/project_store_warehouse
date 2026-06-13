"""Customer endpoints. customer_id ALWAYS taken from JWT."""
from __future__ import annotations

from datetime import date, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..orders import load_application, log_status
from ..schemas import (
    Category,
    OrderApplicationCreate,
    OrderApplicationOut,
    ProductCatalogEntry,
    ProposalDecisionPayload,
)
from ..security import require_role

router = APIRouter(prefix="/customer", tags=["customer"])

CustomerUser = Depends(require_role("customer"))


@router.get("/categories", response_model=List[Category])
async def categories():
    rows = await db.fetch_all("SELECT id, name FROM categories ORDER BY name")
    return [dict(r) for r in rows]


@router.get("/products", response_model=List[ProductCatalogEntry])
async def products():
    rows = await db.fetch_all(
        """SELECT p.id, p.name, p.description, p.price, p.stock_quantity,
                  p.category_id, c.name AS category_name
             FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
            ORDER BY c.name NULLS LAST, p.name"""
    )
    sup_rows = await db.fetch_all(
        """SELECT sp.product_id, sp.supplier_id, s.name AS supplier_name,
                  sp.unit_price, sp.lead_time_days
             FROM supplier_products sp
             JOIN suppliers s ON s.id = sp.supplier_id
            WHERE sp.is_active = TRUE
            ORDER BY sp.lead_time_days"""
    )
    today = date.today()
    sup_by_product: dict[int, list] = {}
    for r in sup_rows:
        sup_by_product.setdefault(r["product_id"], []).append({
            "supplier_id": r["supplier_id"],
            "supplier_name": r["supplier_name"],
            "unit_price": r["unit_price"],
            "lead_time_days": r["lead_time_days"],
            "estimated_delivery_date": today + timedelta(days=int(r["lead_time_days"])),
        })
    out = []
    for r in rows:
        d = dict(r)
        stock = d.pop("stock_quantity")
        d["stock_quantity"] = stock
        d["in_stock"] = stock > 0
        d["suppliers"] = sup_by_product.get(d["id"], [])
        out.append(d)
    return out


@router.post("/order-applications", response_model=OrderApplicationOut, status_code=201)
async def create_application(payload: OrderApplicationCreate, user: dict = CustomerUser):
    async with db.transaction():
        store_row = await db.fetch_one("SELECT id FROM stores ORDER BY id LIMIT 1")
        store_id = store_row["id"] if store_row else None
        app_row = await db.fetch_one(
            """INSERT INTO customer_order_applications (customer_id, store_id, status, total_amount)
               VALUES (:cid, :sid, 'pending_store_review', 0) RETURNING id""",
            {"cid": user["entity_id"], "sid": store_id},
        )
        app_id = app_row["id"]
        total = 0.0
        for it in payload.items:
            prod = await db.fetch_one(
                "SELECT id, price FROM products WHERE id = :id", {"id": it.product_id}
            )
            if not prod:
                raise HTTPException(404, f"Товар #{it.product_id} не найден")
            await db.execute(
                """INSERT INTO customer_order_application_items
                   (application_id, product_id, quantity, unit_price, fulfillment_source, item_status)
                   VALUES (:a, :p, :q, :u, 'undecided', 'pending')""",
                {"a": app_id, "p": prod["id"], "q": it.quantity, "u": prod["price"]},
            )
            total += float(prod["price"]) * it.quantity
        await db.execute(
            "UPDATE customer_order_applications SET total_amount = :t WHERE id = :id",
            {"t": total, "id": app_id},
        )
        await log_status(app_id, "pending_store_review", "Заявка создана покупателем", user["id"])
    return await load_application(app_id, customer_id=user["entity_id"])


@router.get("/order-applications/me", response_model=List[OrderApplicationOut])
async def my_applications(user: dict = CustomerUser):
    rows = await db.fetch_all(
        """SELECT id FROM customer_order_applications
            WHERE customer_id = :cid ORDER BY created_at DESC""",
        {"cid": user["entity_id"]},
    )
    return [await load_application(r["id"], customer_id=user["entity_id"]) for r in rows]


@router.get("/order-applications/{app_id}", response_model=OrderApplicationOut)
async def get_application(app_id: int, user: dict = CustomerUser):
    return await load_application(app_id, customer_id=user["entity_id"])


@router.post("/order-applications/{app_id}/proposal/respond",
             response_model=OrderApplicationOut)
async def respond_to_proposal(
    app_id: int,
    payload: ProposalDecisionPayload,
    user: dict = CustomerUser,
):
    async with db.transaction():
        # ownership + active proposal
        app = await db.fetch_one(
            """SELECT id, status::text AS status FROM customer_order_applications
                WHERE id = :id AND customer_id = :cid FOR UPDATE""",
            {"id": app_id, "cid": user["entity_id"]},
        )
        if not app:
            raise HTTPException(404, "Заявка не найдена")
        proposal = await db.fetch_one(
            """SELECT id, store_id, status::text AS status
                 FROM customer_order_proposals
                WHERE application_id = :a
                ORDER BY id DESC LIMIT 1""",
            {"a": app_id},
        )
        if not proposal or proposal["status"] != "pending_customer_decision":
            raise HTTPException(409, "Нет активного предложения для подтверждения")
        prop_items = await db.fetch_all(
            """SELECT id, application_item_id, product_id, requested_quantity,
                      proposed_warehouse_quantity, proposed_supplier_quantity,
                      proposed_action::text AS proposed_action,
                      supplier_id, estimated_delivery_date
                 FROM customer_order_proposal_items
                WHERE proposal_id = :pid""",
            {"pid": proposal["id"]},
        )

        decision = payload.decision

        if decision == "cancel_application":
            await db.execute(
                "UPDATE customer_order_proposals SET status='rejected', customer_decision_at=now(), updated_at=now() WHERE id=:p",
                {"p": proposal["id"]},
            )
            await db.execute(
                "UPDATE customer_order_applications SET status='cancelled_by_customer', updated_at=now() WHERE id=:a",
                {"a": app_id},
            )
            await log_status(app_id, "cancelled_by_customer",
                             "Покупатель отменил заявку", user["id"])
            return await load_application(app_id, customer_id=user["entity_id"])

        # both other branches need warehouse routing for items with warehouse qty > 0
        warehouse_items: list[dict] = []
        supplier_groups: dict[int, list[dict]] = {}  # supplier_id -> items
        excluded_items: list[dict] = []

        for it in prop_items:
            it = dict(it)
            wq = it["proposed_warehouse_quantity"]
            sq = it["proposed_supplier_quantity"]
            action = it["proposed_action"]
            if wq > 0:
                warehouse_items.append(it)
            if decision == "accept_split_warehouse_and_supplier" and sq > 0 and action == "supplier":
                sid = it["supplier_id"]
                if not sid:
                    raise HTTPException(422, "Для одного из товаров не указан поставщик")
                supplier_groups.setdefault(sid, []).append(it)
            elif decision == "accept_partial_warehouse_only" and (sq > 0 or action == "supplier"):
                # mark this item as excluded by customer
                excluded_items.append(it)
            elif action == "exclude":
                excluded_items.append(it)

        if not warehouse_items and not supplier_groups:
            raise HTTPException(409, "Нет товаров для выполнения по выбранному варианту")

        store_id = proposal["store_id"]

        # apply item-level decisions
        for it in prop_items:
            wq = it["proposed_warehouse_quantity"]
            sq = it["proposed_supplier_quantity"]
            action = it["proposed_action"]
            cancelled = 0
            approved = 0
            new_source = "undecided"
            supplier_id = None
            edd = None
            status = "pending"
            excl = None

            if action == "exclude":
                cancelled = it["requested_quantity"]
                new_source = "excluded"
                status = "excluded"
                excl = "Исключено магазином"
            elif decision == "accept_partial_warehouse_only":
                if wq > 0:
                    approved = wq
                    cancelled = it["requested_quantity"] - wq
                    new_source = "warehouse"
                    status = "routed_warehouse"
                else:
                    cancelled = it["requested_quantity"]
                    new_source = "excluded"
                    status = "excluded"
                    excl = "Отказ покупателя от поставки от поставщика"
            else:  # accept_split
                if wq > 0 and sq == 0:
                    approved = wq
                    cancelled = it["requested_quantity"] - wq
                    new_source = "warehouse"
                    status = "routed_warehouse"
                elif sq > 0 and wq == 0:
                    approved = sq
                    cancelled = it["requested_quantity"] - sq
                    new_source = "supplier"
                    supplier_id = it["supplier_id"]
                    edd = it["estimated_delivery_date"]
                    status = "routed_supplier"
                elif sq > 0 and wq > 0:
                    # split single item — treat as supplier (with delivery date) for the supplier part;
                    # we keep approved = wq+sq and store source as 'supplier' if any supplier qty
                    approved = wq + sq
                    cancelled = it["requested_quantity"] - approved
                    new_source = "supplier"
                    supplier_id = it["supplier_id"]
                    edd = it["estimated_delivery_date"]
                    status = "split"
                else:
                    cancelled = it["requested_quantity"]
                    new_source = "excluded"
                    status = "excluded"

            await db.execute(
                """UPDATE customer_order_application_items
                      SET approved_quantity = :ap,
                          cancelled_quantity = :cn,
                          fulfillment_source = :fs,
                          selected_supplier_id = :sid,
                          estimated_delivery_date = :edd,
                          item_status = :st,
                          exclusion_reason = :ex
                    WHERE id = :id""",
                {"ap": approved or None, "cn": cancelled, "fs": new_source,
                 "sid": supplier_id, "edd": edd, "st": status, "ex": excl, "id": it["application_item_id"]},
            )

        # create warehouse request for warehouse items
        if warehouse_items:
            wh = await db.fetch_one("SELECT id FROM warehouses ORDER BY id LIMIT 1")
            wh_id = wh["id"] if wh else None
            wr = await db.fetch_one(
                """INSERT INTO warehouse_requests (application_id, store_id, warehouse_id, status)
                   VALUES (:a, :s, :w, 'pending') RETURNING id""",
                {"a": app_id, "s": store_id, "w": wh_id},
            )
            for it in warehouse_items:
                await db.execute(
                    """INSERT INTO warehouse_request_items (request_id, product_id, requested_quantity)
                       VALUES (:r, :p, :q)""",
                    {"r": wr["id"], "p": it["product_id"], "q": it["proposed_warehouse_quantity"]},
                )

        # create supplier requests grouped by supplier
        for sid, group in supplier_groups.items():
            sr = await db.fetch_one(
                """INSERT INTO supplier_requests (application_id, store_id, supplier_id, status)
                   VALUES (:a, :s, :sup, 'pending') RETURNING id""",
                {"a": app_id, "s": store_id, "sup": sid},
            )
            for it in group:
                await db.execute(
                    """INSERT INTO supplier_request_items (request_id, product_id, requested_quantity)
                       VALUES (:r, :p, :q)""",
                    {"r": sr["id"], "p": it["product_id"], "q": it["proposed_supplier_quantity"]},
                )

        # update proposal + application status
        new_app_status: str
        new_prop_status: str
        note: str
        if decision == "accept_partial_warehouse_only":
            new_app_status = "customer_approved_partial"
            new_prop_status = "accepted_partial"
            note = "Покупатель согласовал отгрузку только доступных со склада товаров"
        else:
            new_app_status = "customer_approved_split" if supplier_groups else "customer_approved_partial"
            new_prop_status = "accepted_split"
            note = "Покупатель согласовал отгрузку: склад + поставщик"

        await db.execute(
            "UPDATE customer_order_proposals SET status = :s, customer_decision_at=now(), updated_at=now() WHERE id=:id",
            {"s": new_prop_status, "id": proposal["id"]},
        )
        await db.execute(
            "UPDATE customer_order_applications SET status = :s, updated_at=now() WHERE id=:id",
            {"s": new_app_status, "id": app_id},
        )
        await log_status(app_id, new_app_status, note, user["id"])

        # follow-up: if warehouse items were routed, set sent_to_warehouse history;
        # if supplier items routed, sent_to_supplier history
        if warehouse_items:
            await log_status(app_id, "sent_to_warehouse",
                             f"Создан запрос на склад ({len(warehouse_items)} поз.)", user["id"])
        for sid, group in supplier_groups.items():
            await log_status(app_id, "sent_to_supplier",
                             f"Создан запрос поставщику #{sid} ({len(group)} поз.)", user["id"])

        if warehouse_items and supplier_groups:
            await db.execute(
                "UPDATE customer_order_applications SET status='split_processing' WHERE id=:id",
                {"id": app_id},
            )
            await log_status(app_id, "split_processing",
                             "Заявка обрабатывается параллельно складом и поставщиком", user["id"])

    return await load_application(app_id, customer_id=user["entity_id"])
