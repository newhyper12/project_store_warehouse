"""Auth: token + me."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from ..db import db
from ..schemas import MeResponse, TokenResponse
from ..security import create_access_token, get_current_user, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/token", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends()) -> TokenResponse:
    row = await db.fetch_one(
        "SELECT id, username, password_hash, role, entity_id FROM users WHERE username = :u",
        {"u": form.username},
    )
    if not row or not verify_password(form.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(
        {
            "sub": str(row["id"]),
            "username": row["username"],
            "role": row["role"],
            "entity_id": row["entity_id"],
        }
    )
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
async def me(user: dict = Depends(get_current_user)) -> MeResponse:
    return MeResponse(**user)
