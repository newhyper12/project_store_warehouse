from fastapi import FastAPI

from backend.store_api import router as store_router
from backend.warehouse_api import router as warehouse_router
from backend.database import store_db, warehouse_db
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from backend.customer_api import router as customer_router
from backend.supplier_api import router as supplier_router
from backend.database import customer_db, supplier_db

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3500",
        "http://26.50.35.72:3500",
        "http://10.0.0.2:3500",
        "http://10.0.0.3:3500",
        # ИЛИ временно для разработки:
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],      # ← важно: разрешает POST, OPTIONS и др.
    allow_headers=["*"],      # ← важно: разрешает Content-Type, Authorization и др.
)

from fastapi.responses import JSONResponse
@app.get("/test-cors")
def test_cors():
    return {"message": "CORS работает!"}

@app.middleware("http")
async def log_requests(request, call_next):
    print(f"Запрос: {request.url}")
    response = await call_next(request)
    print(f"Ответ с заголовками: {response.headers}")
    return response

@app.on_event("startup")
async def startup():
    await store_db.connect()
    await warehouse_db.connect()
    await customer_db.connect()
    await supplier_db.connect()

@app.on_event("shutdown")
async def shutdown():
    await store_db.disconnect()
    await warehouse_db.disconnect()
    await customer_db.disconnect()
    await supplier_db.disconnect()

# main.py
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from backend.models import create_access_token, verify_password
from backend.database import warehouse_db  # ← должен иметь SELECT на users
from datetime import datetime, timedelta
ACCESS_TOKEN_EXPIRE_MINUTES = 30

@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    # Поиск пользователя
    query = "SELECT id, username, password_hash, role, entity_id FROM users WHERE username = :username"
    user = await warehouse_db.fetch_one(query, values={"username": form_data.username})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Проверка пароля через bcrypt
    if not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Создание токена
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": str(user["id"]),
            "username": user["username"],
            "role": user["role"],
            "entity_id": user["entity_id"]
        },
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

app.include_router(store_router)
app.include_router(warehouse_router)
app.include_router(customer_router)
app.include_router(supplier_router)
