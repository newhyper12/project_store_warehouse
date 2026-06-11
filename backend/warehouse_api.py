# backend/warehouse_api.py
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import List
from .database import warehouse_db
from backend.models import get_current_user
router = APIRouter(prefix="/warehouse", tags=["Warehouse"])
import json
class RejectRequest(BaseModel):
    reason: str  # Пока не храним в БД, но можно расширить


# 1. Получить все запросы со статусом
@router.get("/delivery-requests")
async def get_delivery_requests(status: str, current_user: dict = Depends(get_current_user)):
    if status not in ["pending", "processing", "approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Недопустимый статус")

    query = """
            SELECT 
            dr.id,
            dr.store_id,
            dr.status,
            dr.reject_reason,
            COALESCE(
                json_agg(
                    json_build_object(
                        'product_id', p.id,
                        'name', p.name,
                        'requested', dri.requested_quantity,
                        'stock', p.stock_quantity
                    )
                ) FILTER (WHERE p.id IS NOT NULL),
                '[]'
            ) AS items
        FROM delivery_requests dr
        LEFT JOIN delivery_request_items dri ON dr.id = dri.request_id
        LEFT JOIN products p ON dri.product_id = p.id
        WHERE dr.status = :status
        GROUP BY dr.id, dr.store_id, dr.status, dr.reject_reason
        ORDER BY dr.created_at ASC
    """
    print(f"Fetching requests with status: {status}")


    rows = await warehouse_db.fetch_all(query, values={"status": status})
    result = []
    for row in rows:
        result.append({
            "id": row["id"],
            "store_id": row["store_id"],
            "status": row["status"],
            "reject_reason": row["reject_reason"],
            "items": json.loads(row["items"]) if row["items"] else []
        })
    for req in result:
        print(f"Request ID: {req["id"]}, Status: {req["status"]}")
    return result
    print(f"Found {len(requests)} requests")


    return requests


# 2. Принять в обработку
@router.post("/delivery-requests/{request_id}/accept")
async def accept_request(request_id: int):
    query = "UPDATE delivery_requests SET status = 'processing' WHERE id = :id AND status = 'pending'"
    result = await warehouse_db.execute(query, values={"id": request_id})
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Запрос не найден или уже обработан")
    return {"message": "Запрос переведён в обработку"}


# 3. Одобрить запрос
@router.post("/delivery-requests/{request_id}/approve")
async def approve_request(request_id: int):
    # Получаем все позиции и проверяем наличие
    items_query = """
        SELECT dri.id, dri.product_id, dri.requested_quantity, p.stock_quantity
        FROM delivery_request_items dri
        JOIN products p ON dri.product_id = p.id
        WHERE dri.request_id = :request_id
    """
    items = await warehouse_db.fetch_all(items_query, values={"request_id": request_id})

    for item in items:
        if item["stock_quantity"] < item["requested_quantity"]:
            raise HTTPException(
                status_code=400,
                detail=f"Недостаточно товара: {item['product_id']}. На складе: {item['stock_quantity']}, запрошено: {item['requested_quantity']}"
            )

    # Обновляем approved_quantity и статус
    async with warehouse_db.transaction():
        for item in items:
            await warehouse_db.execute(
                "UPDATE delivery_request_items SET approved_quantity = :qty WHERE id = :id",
                values={"qty": item["requested_quantity"], "id": item["id"]}
            )
            # Уменьшаем остаток
            await warehouse_db.execute(
                "UPDATE products SET stock_quantity = stock_quantity - :qty WHERE id = :pid",
                values={"qty": item["requested_quantity"], "pid": item["product_id"]}
            )

        await warehouse_db.execute(
            "UPDATE delivery_requests SET status = 'approved' WHERE id = :id",
            values={"id": request_id}
        )

    return {"message": "Запрос одобрен"}


# 4. Отклонить запрос
@router.post("/delivery-requests/{request_id}/reject")
async def reject_request(request_id: int, data: RejectRequest):
    print(data.reason)
    query = "UPDATE delivery_requests SET status = 'rejected', reject_reason = :reason WHERE id = :id"
    result = await warehouse_db.execute(query, values={"id": request_id, "reason": data.reason})
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Запрос не найден")

    # В реальном проекте можно сохранить причину в отдельной таблице
    print(f"Причина отказа для запроса {request_id}: {data.reason}")

    return {"message": "Запрос отклонён", "reason": data.reason}