"""Compatibility entrypoint for Render services started from the repository root.

The canonical FastAPI application lives in ``backend.main``.  Keeping this
small shim allows both of these commands to work:

- ``uvicorn main:app``
- ``uvicorn backend.main:app``
"""

from backend.main import app

__all__ = ["app"]
