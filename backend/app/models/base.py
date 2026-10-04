"""
Declarative base and shared model utilities for SENTINEL-X.

Design notes:
- Primary keys use portable types (String(36) UUIDs or plain Integer
  autoincrement) rather than PostgreSQL-only types (e.g. native UUID),
  so the same models work against both PostgreSQL (production/dev) and
  SQLite (fast in-memory test database, see backend/tests/conftest.py
  added in Batch 12).
- JSON columns use the generic sqlalchemy.JSON type for the same reason
  (it degrades to TEXT-backed JSON on SQLite and native JSON/JSONB
  semantics on PostgreSQL).
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base for every SENTINEL-X ORM model."""
    pass


def generate_uuid() -> str:
    """Generate a string UUID4, used as the default for UUID-style primary keys."""
    return str(uuid.uuid4())


def utcnow() -> datetime:
    """Timezone-aware UTC 'now', used as the default for timestamp columns."""
    return datetime.now(timezone.utc)