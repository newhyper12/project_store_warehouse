"""Pydantic schemas (v3: partial availability + proposals)."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


# -------- auth --------
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    id: int
    username: str
    role: str
    entity_id: int


# -------- catalog --------
class Category(BaseModel):
    id: int
    name: str


class Product(BaseModel):
    id: int
    name: str
    description: str = ""
    price: Decimal
    category_id: Optional[int] = None
    category_name: Optional[str] = None


class ProductWithStock(Product):
    stock_quantity: int


class SupplierOption(BaseModel):
    supplier_id: int
    supplier_name: str
    unit_price: Decimal
    lead_time_days: int
    estimated_delivery_date: date


class ProductCatalogEntry(Product):
    stock_quantity: int = 0
    in_stock: bool = False
    suppliers: List[SupplierOption] = []


# -------- customer cart --------
class CartItem(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class OrderApplicationCreate(BaseModel):
    items: List[CartItem] = Field(min_length=1)


# -------- application item out --------
class ApplicationItemOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    category_name: Optional[str] = None
    quantity: int                          # originally requested
    approved_quantity: Optional[int] = None
    cancelled_quantity: int = 0
    unit_price: Decimal
    fulfillment_source: str = "undecided"
    item_status: str = "pending"
    warehouse_available_quantity_snapshot: Optional[int] = None
    selected_supplier_id: Optional[int] = None
    estimated_delivery_date: Optional[date] = None
    exclusion_reason: Optional[str] = None
    # live availability (computed at fetch-time for store views)
    warehouse_available_quantity: Optional[int] = None
    enough_in_warehouse: Optional[bool] = None
    suppliers: List[SupplierOption] = []


class StatusHistoryEntry(BaseModel):
    status: str
    note: Optional[str] = None
    created_at: datetime


# -------- proposal --------
class ProposalItemOut(BaseModel):
    id: int
    application_item_id: int
    product_id: int
    product_name: str
    requested_quantity: int
    warehouse_available_quantity: int
    proposed_warehouse_quantity: int
    proposed_supplier_quantity: int
    proposed_action: str
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    estimated_delivery_date: Optional[date] = None
    unit_price: Decimal = Decimal("0")


class ProposalOut(BaseModel):
    id: int
    application_id: int
    store_id: int
    status: str
    message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    customer_decision_at: Optional[datetime] = None
    items: List[ProposalItemOut] = []


# -------- application out --------
class OrderApplicationOut(BaseModel):
    id: int
    customer_id: int
    store_id: Optional[int]
    status: str
    total_amount: Decimal
    reject_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[ApplicationItemOut] = []
    history: List[StatusHistoryEntry] = []
    proposal: Optional[ProposalOut] = None


# -------- store actions --------
class RejectPayload(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)


class ProposalItemIn(BaseModel):
    application_item_id: int
    proposed_warehouse_quantity: int = Field(ge=0)
    proposed_supplier_quantity: int = Field(ge=0)
    proposed_action: Literal["warehouse", "supplier", "exclude"]
    supplier_id: Optional[int] = None


class ProposalCreate(BaseModel):
    message: Optional[str] = None
    items: List[ProposalItemIn] = Field(min_length=1)


class RouteWarehousePayload(BaseModel):
    warehouse_id: Optional[int] = None


# -------- customer proposal decision --------
class ProposalDecisionPayload(BaseModel):
    decision: Literal[
        "accept_partial_warehouse_only",
        "accept_split_warehouse_and_supplier",
        "cancel_application",
    ]


# -------- warehouse / supplier requests --------
class RequestItemOut(BaseModel):
    product_id: int
    product_name: str
    category_name: Optional[str] = None
    requested_quantity: int
    approved_quantity: Optional[int] = None
    stock_quantity: Optional[int] = None
    estimated_delivery_date: Optional[date] = None


class WarehouseRequestOut(BaseModel):
    id: int
    application_id: int
    store_id: int
    warehouse_id: Optional[int]
    status: str
    reject_reason: Optional[str] = None
    created_at: datetime
    items: List[RequestItemOut] = []


class SupplierRequestOut(BaseModel):
    id: int
    application_id: int
    store_id: int
    supplier_id: Optional[int]
    status: str
    reject_reason: Optional[str] = None
    created_at: datetime
    items: List[RequestItemOut] = []


# -------- shipments --------
class ShipmentItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    unit_price: Decimal = Decimal("0")


class ShipmentCreate(BaseModel):
    items: List[ShipmentItemIn] = Field(min_length=1)
    expected_date: Optional[date] = None
    notes: Optional[str] = None


class ShipmentItemOut(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    unit_price: Decimal


class ShipmentOut(BaseModel):
    id: int
    supplier_request_id: Optional[int]
    supplier_id: int
    expected_date: Optional[date]
    notes: Optional[str]
    created_at: datetime
    items: List[ShipmentItemOut] = []
