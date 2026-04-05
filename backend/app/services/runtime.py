from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.services.session_manager import SessionManager


@lru_cache
def get_session_manager() -> SessionManager:
    return SessionManager(get_settings())
