from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Any

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient


@pytest.fixture
def router_client_factory():
    """建立只掛載目標 Router 的 TestClient，避免單元測試載入整個部署入口。"""
    clients: list[TestClient] = []

    def create_client(
        *routers: APIRouter,
        dependency_overrides: Mapping[Callable[..., Any], Callable[..., Any]] | None = None,
    ) -> TestClient:
        app = FastAPI()
        for router in routers:
            app.include_router(router)
        if dependency_overrides:
            app.dependency_overrides.update(dependency_overrides)

        client = TestClient(app)
        clients.append(client)
        return client

    yield create_client

    for client in clients:
        client.close()
