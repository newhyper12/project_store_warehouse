# backend/auth.py
import bcrypt
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta, date
from typing import Optional
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer


# Настройки
SECRET_KEY = "your-very-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Хэширование пароля
def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

# Проверка пароля
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )

# Создание JWT-токена
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Получение текущего пользователя из токена
async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        return {"id": int(user_id), "username": payload.get("username"), "role": payload.get("role"), "entity_id": payload.get("entity_id")}
    except JWTError:
        raise credentials_exception


class CategoryOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class CustomerOut(BaseModel):
    id: int
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

    class Config:
        from_attributes = True


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int

class OrderItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    price: float

    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    customer_id: int
    items: List[OrderItemCreate]

class OrderOut(BaseModel):
    id: int
    customer_id: int
    store_id: int
    status: str
    total_amount: float
    created_at: datetime
    items: List[OrderItemOut] = []

    class Config:
        from_attributes = True


class SupplierOut(BaseModel):
    id: int
    name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

    class Config:
        from_attributes = True


class ShipmentItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_price: float

class ShipmentCreate(BaseModel):
    supplier_id: int
    warehouse_id: int
    expected_date: Optional[date] = None
    notes: Optional[str] = None
    items: List[ShipmentItemCreate]

class ShipmentItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float

    class Config:
        from_attributes = True

class ShipmentOut(BaseModel):
    id: int
    supplier_id: int
    warehouse_id: int
    status: str
    expected_date: Optional[date]
    received_date: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    items: List[ShipmentItemOut] = []

    class Config:
        from_attributes = True
