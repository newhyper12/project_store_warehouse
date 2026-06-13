"""Shared helpers: load an application with items, derived availability,
supplier options, status history and any pending proposal.

These functions DO NOT check ownership — callers are responsible for that.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from .db import db


async def _supplier_options_for_product(product_id: int) -> list[dict]:
    rows = await db.fetch_all(
        """SELECT sp.supplier_id, s.name AS supplier_name, sp.unit_price,
                  sp.lead_time_days
             FROM supplier_products sp
             JOIN suppliers s ON s.id = sp.supplier_id
            WHERE sp.product_id = :p AND sp.is_active = TRUE
            ORDER BY sp.lead_time_days, sp.unit_price""",
        {"p": product_id},
    )
    today = date.today()
    return [
        {
            "supplier_id": r["supplier_id"],
            "supplier_name": r["supplier_name"],
            "unit_price": r["unit_price"],
            "lead_time_days": r["lead_time_days"],
            "estimated_delivery_date": today + timedelta(days=int(r["lead_time_days"])),
        }
        for r in rows
    ]


async def load_application(
    app_id: int,
    *,
    customer_id: Optional[int] = None,
    store_id: Optional[int] = None,
    include_live_availability: bool = False,
) -> dict:
    """Return an application dict shaped like OrderApplicationOut."""
    where = ["a.id = :id"]
    values: dict = {"id": app_id}
    if customer_id is not None:
        where.append("a.customer_id = :cid")
        values["cid"] = customer_id
    if store_id is not None:
        where.append("a.store_id = :sid")
        values["sid"] = store_id
    head = await db.fetch_one(
        f"""SELECT a.id, a.customer_id, a.store_id, a.status::text AS status,
                   a.total_amount, a.reject_reason, a.created_at, a.updated_at
              FROM customer_order_applications a
             WHERE {' AND '.join(where)}""",
        values,
    )
    if not head:
        from fastapi import HTTPException
        raise HTTPException(404, "Заявка не найдена")

    items_rows = await db.fetch_all(
        """SELECT i.id, i.product_id, p.name AS product_name, c.name AS category_name,
                  i.quantity, i.approved_quantity, i.cancelled_quantity,
                  i.unit_price, i.fulfillment_source::text AS fulfillment_source,
                  i.item_status, i.warehouse_available_quantity_snapshot,
                  i.selected_supplier_id, i.estimated_delivery_date,
                  i.exclusion_reason, p.stock_quantity
             FROM customer_order_application_items i
             JOIN products p ON p.id = i.product_id
        LEFT JOIN categories c ON c.id = p.category_id
            WHERE i.application_id = :id
            ORDER BY i.id""",
        {"id": app_id},
    )
    items = []
    for r in items_rows:
        item = dict(r)
        stock = item.pop("stock_quantity")
        if include_live_availability:
            item["warehouse_available_quantity"] = stock
            item["enough_in_warehouse"] = stock >= item["quantity"]
            item["suppliers"] = await _supplier_options_for_product(item["product_id"])
        else:
            item["warehouse_available_quantity"] = None
            item["enough_in_warehouse"] = None
            item["suppliers"] = []
        items.append(item)

    hist = await db.fetch_all(
        """SELECT status::text AS status, note, created_at
             FROM status_history
            WHERE application_id = :id
            ORDER BY created_at""",
        {"id": app_id},
    )

    proposal = await _load_pending_proposal(app_id)

    out = dict(head)
    out["items"] = items
    out["history"] = [dict(h) for h in hist]
    out["proposal"] = proposal
    return out


async def _load_pending_proposal(app_id: int) -> Optional[dict]:
    head = await db.fetch_one(
        """SELECT id, application_id, store_id, status::text AS status,
                  message, created_at, updated_at, customer_decision_at
             FROM customer_order_proposals
            WHERE application_id = :a
            ORDER BY id DESC LIMIT 1""",
        {"a": app_id},
    )
    if not head:
        return None
    items = await db.fetch_all(
        """SELECT pi.id, pi.application_item_id, pi.product_id, p.name AS product_name,
                  pi.requested_quantity, pi.warehouse_available_quantity,
                  pi.proposed_warehouse_quantity, pi.proposed_supplier_quantity,
                  pi.proposed_action::text AS proposed_action,
                  pi.supplier_id, s.name AS supplier_name,
                  pi.estimated_delivery_date,
                  COALESCE(sp.unit_price, 0) AS unit_price
             FROM customer_order_proposal_items pi
             JOIN products p ON p.id = pi.product_id
        LEFT JOIN suppliers s ON s.id = pi.supplier_id
        LEFT JOIN supplier_products sp
               ON sp.product_id = pi.product_id AND sp.supplier_id = pi.supplier_id
            WHERE pi.proposal_id = :pid
            ORDER BY pi.id""",
        {"pid": head["id"]},
    )
    out = dict(head)
    out["items"] = [dict(i) for i in items]
    return out


async def log_status(app_id: int, status: str, note: str, user_id: int) -> None:
    await db.execute(
        """INSERT INTO status_history (application_id, status, note, actor_user_id)
           VALUES (:a, :s, :n, :u)""",
        {"a": app_id, "s": status, "n": note, "u": user_id},
    )
