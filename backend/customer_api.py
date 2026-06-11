from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from .database import customer_db
from backend.models import get_current_user, OrderCreate, OrderOut

router = APIRouter(prefix="/customer", tags=["Customer"])

# Получить товары с ценами
@router.get("/products")
async def get_products_for_customer():
    query = """
        SELECT p.id, p.name, p.description, p.price, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY c.name, p.name
    """
    products = await customer_db.fetch_all(query)
    return products

# Создать заказ
@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_order(order: OrderCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "customer":
        raise HTTPException(status_code=403, detail="Только покупатели могут создавать заказы")
    
    async with customer_db.transaction():
        # Создаём заказ
        order_query = """
            INSERT INTO orders (customer_id, store_id, status, total_amount)
            VALUES (:customer_id, :store_id, 'new', 0)
            RETURNING id
        """
        result = await customer_db.fetch_one(
            order_query, 
            values={"customer_id": current_user["entity_id"], "store_id": 1}
        )
        order_id = result["id"]
        
        total = 0
        # Добавляем товары
        for item in order.items:
            product = await customer_db.fetch_one(
                "SELECT price FROM products WHERE id = :id",
                values={"id": item.product_id}
            )
            if not product:
                raise HTTPException(status_code=404, detail=f"Товар {item.product_id} не найден")
            
            item_total = float(product["price"]) * item.quantity
            total += item_total
            
            await customer_db.execute(
                """
                INSERT INTO order_items (order_id, product_id, quantity, price)
                VALUES (:order_id, :product_id, :quantity, :price)
                """,
                values={
                    "order_id": order_id,
                    "product_id": item.product_id,
                    "quantity": item.quantity,
                    "price": product["price"]
                }
            )
        
        # Обновляем общую сумму
        await customer_db.execute(
            "UPDATE orders SET total_amount = :total WHERE id = :id",
            values={"total": total, "id": order_id}
        )
        
        return {"order_id": order_id, "total_amount": total}

# Получить свои заказы
@router.get("/orders/me")
async def get_my_orders(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "customer":
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    query = """
        SELECT o.id, o.status, o.total_amount, o.created_at,
               json_agg(json_build_object(
                   'product_id', oi.product_id,
                   'quantity', oi.quantity,
                   'price', oi.price
               )) as items
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.customer_id = :customer_id
        GROUP BY o.id
        ORDER BY o.created_at DESC
    """
    orders = await customer_db.fetch_all(query, values={"customer_id": current_user["entity_id"]})
    return orders
