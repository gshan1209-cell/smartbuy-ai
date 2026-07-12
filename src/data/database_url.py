"""
Shared DATABASE_URL loader for SmartBuy AI data access modules.
"""
from __future__ import annotations

import os


def load_database_url() -> str | None:
    """
    Read DATABASE_URL from the process environment.
    """
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return "".join(env_url.splitlines()).strip().strip('"').strip("'")

    return None
