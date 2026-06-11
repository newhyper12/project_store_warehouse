from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from .database import supplier_db
from backend.models import get_current_user, ShipmentCreate, ShipmentOut

router = APIRouter(prefix="/supplier", tags=["Supplier"])

# Создать поставку
@router.post("/shipments", status_code=status.HTTP_201_CREATED)
async def create_shipment(shipment: ShipmentCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "supplier":
        raise HTTPException(status_code=403, detail="Только поставщики могут создавать поставки")
    
    async with supplier_db.transaction():
        # Создаём поставку
        shipment_query = """
            INSERT INTO shipments (supplier_id, warehouse_id, expected_date, notes, status)
            VALUES (:supplier_id, :warehouse_id, :expected_date, :notes, 'pending')
            RETURNING id
        """
        result = await supplier_db.fetch_one(
            shipment_query,
            values={
                "supplier_id": current_user["entity_id"],
                "warehouse_id": shipment.warehouse_id,
                "expected_date": shipment.expected_date,
                "notes": shipment.notes
            }
        )
        shipment_id = result["id"]
        
        # Добавляем товары
        for item in shipment.items:
            await supplier_db.execute(
                """
                INSERT INTO shipment_items (shipment_id, product_id, quantity, unit_price)
                VALUES (:shipment_id, :product_id, :quantity, :unit_price)
                """,
                values={
                    "shipment_id": shipment_id,
                    "product_id": item.product_id,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price
                }
            )
        
        return {"shipment_id": shipment_id}

# Получить свои поставки
@router.get("/shipments/me")
async def get_my_shipments(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "supplier":
        raise HTTPException(status_code=403, detail="Доступ запрещен")
    
    query = """
        SELECT s.id, s.warehouse_id, s.status, s.expected_date, s.received_date, s.created_at,
               json_agg(json_build_object(
                   'product_id', si.product_id,
                   'quantity', si.quantity,
                   'unit_price', si.unit_price
               )) as items
        FROM shipments s
        LEFT JOIN shipment_items si ON s.id = si.shipment_id
        WHERE s.supplier_id = :supplier_id
        GROUP BY s.id
        ORDER BY s.created_at DESC
    """
    shipments = await supplier_db.fetch_all(query, values={"supplier_id": current_user["entity_id"]})
    return shipments
