"""
Generic API response schemas shared across multiple resource types.

Introduced in Batch 5 to support paginated list endpoints (starting with
GET /events) without duplicating a bespoke {items, total, limit, offset}
shape per resource.
"""
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int