"""Reusable pagination helpers.

All "list products" endpoints share the same envelope shape:

    {
        "items": [...],
        "page": 1,
        "page_size": 15,
        "total": 1000000,
        "total_pages": 66667,
        "has_next": true,
        "has_prev": false
    }
"""
from __future__ import annotations

from typing import Any, Generic, List, TypeVar

from fastapi import Query
from pydantic import BaseModel

T = TypeVar("T")

DEFAULT_PAGE_SIZE = 15
MAX_PAGE_SIZE = 100


class Page(BaseModel, Generic[T]):
    items: List[T]
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_prev: bool


def page_params(
    page: int = Query(1, ge=1, description="Номер страницы, начиная с 1"),
    page_size: int = Query(
        DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE,
        description=f"Размер страницы (макс. {MAX_PAGE_SIZE})",
    ),
) -> tuple[int, int]:
    return page, page_size


def build_page(items: list[Any], total: int, page: int, page_size: int) -> dict:
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 0
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }
