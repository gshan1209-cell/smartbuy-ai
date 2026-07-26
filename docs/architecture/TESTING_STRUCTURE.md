# SmartBuy AI｜測試結構與隔離規範

> 本文件定義 Python／FastAPI 測試的分層、依賴替換方式與完整測試套件的隔離原則。
> 目標是讓單一測試可獨立執行，也能與其他測試任意排序後一起執行。

## 1. 測試層級

### 1.1 純函式與領域單元測試

適用於 `src/` 內規則、資料轉換、快取鍵、模型輸出格式與 repository query builder。

原則：

- 直接 import 被測模組。
- 不建立 FastAPI app。
- 不連接正式外部服務。
- I/O 依賴透過 `monkeypatch` 或明確注入替換。

### 1.2 Router 單元測試

適用於單一 endpoint 的：

- query／path／body validation
- HTTP status
- 公開 response fields
- 401／403
- 固定錯誤訊息
- repository／service 呼叫參數

正式方式：

```python
def test_example(monkeypatch, router_client_factory):
    import backend.routers.example as example_router

    monkeypatch.setattr(example_router, "query_data", lambda: [])
    client = router_client_factory(example_router.router)

    response = client.get("/api/example")
    assert response.status_code == 200
```

`tests/conftest.py` 的 `router_client_factory` 只掛載目標 Router，不會啟動完整應用程式、背景工作或不相關 Router。

### 1.3 完整 App 整合測試

只有下列情境才使用完整 app：

- Router 是否已登錄於 `backend/api/router.py`
- middleware／CORS／lifespan
- 多 Router 協作
- `/health` 與部署入口 smoke test

優先從 `backend.application.create_app()` 建立 app；不要為了測單一 endpoint import `backend.main`。

### 1.4 資料庫整合測試

- 必須以 `DATABASE_URL` 或專用測試資料庫明確啟用。
- 沒有測試資料庫時使用 `pytest.skip`，不得猜測本機 PostgreSQL credentials。
- 每個案例應使用 transaction rollback、唯一測試資料或可重複 migration。
- 不得將正式資料庫寫入當成一般單元測試的必要條件。

## 2. Dependency Override

FastAPI `Depends` 應使用 `app.dependency_overrides`：

```python
client = router_client_factory(
    favorites_router.router,
    dependency_overrides={
        favorites_router._get_current_member_id: lambda: 1,
    },
)
```

不得為模擬登入而用 fake module 取代整個 `backend.routers.auth`。

## 3. Patch 邊界

Patch 必須指向「被測模組實際查找符號的位置」。

例如 Router 使用：

```python
from src.data.store import query_latest
```

測試應 patch：

```python
monkeypatch.setattr(router_module, "query_latest", fake_query)
```

不要 patch 已不再持有該符號的 `backend.main`，也不要只 patch 原始 store 後假設 Router 已匯入的別名會自動更新。

## 4. 禁止全域 Module 污染

禁止在測試檔 module import 階段執行：

```python
sys.modules.setdefault("src.data.some_module", fake_module)
```

原因：

- pytest collection 會先載入多個測試檔。
- fake module 會留在 process 內，造成其他測試匯入不完整模組。
- 單檔測試可能通過，但完整 `pytest` 會因順序不同失敗。

確實需要替換 module 時：

- 只在測試函式或 function-scoped fixture 內使用 `monkeypatch.setitem`。
- 測試後必須恢復原值。
- 優先重構為 dependency override 或 patch 目標函式。

## 5. Cache 與全域狀態

測試快取、單例與 process-level lock 時：

- 每個案例開始前清空。
- 每個案例結束後再次清空。
- 不依賴測試執行順序。
- 需要驗證快取命中時，在同一案例內完成兩次呼叫。

## 6. 驗證順序

後端變更建議依序執行：

```bash
python -m compileall -q backend src tests
python -m pytest <受影響測試檔> -q
python -m pytest -q
```

若完整套件失敗：

1. 先確認單檔是否通過。
2. 以不同順序或與前一個測試檔組合執行，辨識全域狀態污染。
3. 不得直接永久排除測試並將功能標記為完成。
4. 環境型資料庫測試可 skip，但 collection error、import error 與測試順序污染必須修正。

## 7. PR 驗收要求

測試結構變更的 PR 必須列出：

- 原本污染或錯誤 patch 的來源。
- 改用的 Router／dependency／service 邊界。
- 單檔測試結果。
- 完整測試結果；若無法執行，明確列出環境限制。
- 是否仍有需要資料庫、R2、LLM 或外部 API 的 blocked cases。
