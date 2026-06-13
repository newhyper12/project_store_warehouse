"""FastAPI entrypoint."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import db
from .routers import auth, customer, products_mgmt, store, supplier, warehouse

settings = get_settings()
logging.basicConfig(level=settings.log_level)
log = logging.getLogger("app")

app = FastAPI(
    title="Store / Warehouse / Supplier API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


@app.on_event("startup")
async def _startup() -> None:
    await db.connect()
    log.info("DB connected to %s:%s/%s", settings.db_host, settings.db_port, settings.db_name)


@app.on_event("shutdown")
async def _shutdown() -> None:
    await db.disconnect()


@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(customer.router)
app.include_router(store.router)
app.include_router(warehouse.router)
app.include_router(supplier.router)
app.include_router(products_mgmt.store_router)
app.include_router(products_mgmt.sup_router)
