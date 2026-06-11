# backend/store_api.py
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import List, Optional
from .database import store_db
from backend.models import get_current_user
router = APIRouter(prefix="/store", tags=["Store"])


# Модели
class ProductOut(BaseModel):
    id: int
    name: str
    description: str
    price: float = 0.0
    category_id: Optional[int] = None


class DeliveryItemCreate(BaseModel):
    product_id: int
    requested_quantity: int


class DeliveryRequestCreate(BaseModel):
    store_id: int
    items: List[DeliveryItemCreate]


class DeliveryRequestOut(BaseModel):
    request_id: int
    status: str
    reject_reason: str | None = None  # ← новое поле
    items: List[dict]


# 1. Получить ассортимент (без stock_quantity!)
@router.get("/products", response_model=List[ProductOut])
async def get_products():
    query = "SELECT id, name, description FROM products ORDER BY name"
    products = await store_db.fetch_all(query)
    return products


# 2. Создать запрос на поставку
@router.post("/delivery-requests", status_code=status.HTTP_201_CREATED)
async def create_delivery_request(request: DeliveryRequestCreate, current_user: dict = Depends(get_current_user)):
    # Начинаем транзакцию
    transaction = store_db.transaction()
    try:
        async with transaction:

            # Создаём запрос
            req_query = "INSERT INTO delivery_requests (store_id, status, created_by) VALUES (:store_id, 'pending', :entity_id) RETURNING id"
            result = await store_db.fetch_one(req_query, values={"store_id": request.store_id, "entity_id": current_user["id"]})
            request_id = result["id"]

            # Добавляем позиции
            for item in request.items:
                item_query = """
                    INSERT INTO delivery_request_items (request_id, product_id, requested_quantity)
                    VALUES (:request_id, :product_id, :requested_quantity)
                """
                await store_db.execute(item_query, values={
                    "request_id": request_id,
                    "product_id": item.product_id,
                    "requested_quantity": item.requested_quantity
                })

            # await transaction.commit()
        return {"request_id": request_id}

    except Exception as e:
        await transaction.rollback()
        raise HTTPException(status_code=400, detail=f"Ошибка создания запроса: {str(e)}")


# 3. Получить свои запросы
@router.get("/delivery-requests/me")
async def get_store_requests(current_user: dict = Depends(get_current_user)):
    query = """
        SELECT dr.id, dr.status,dr.reject_reason, dri.product_id, p.name, dri.requested_quantity, dri.approved_quantity
        FROM delivery_requests dr
        JOIN delivery_request_items dri ON dr.id = dri.request_id
        JOIN products p ON dri.product_id = p.id
        WHERE dr.created_by = :store_id
        ORDER BY dr.created_at DESC
    """
    rows = await store_db.fetch_all(query, values={"store_id": current_user["id"]})

    # Группируем по request_id
    from collections import defaultdict
    grouped = defaultdict(lambda: {"request_id": None, "status": "","reject_reason": None, "items": []})
    for row in rows:
        rid = row["id"]
        if grouped[rid]["request_id"] is None:
            grouped[rid]["request_id"] = rid
            grouped[rid]["status"] = row["status"]
            grouped[rid]["reject_reason"] = row["reject_reason"]  # ← здесь
        grouped[rid]["items"].append({
            "product_id": row["product_id"],
            "product_name": row["name"],
            "requested": row["requested_quantity"],
            "approved": row["approved_quantity"]
        })
    for row in rows:
        print(row["status"])
        print(row["reject_reason"])
    return list(grouped.values())
