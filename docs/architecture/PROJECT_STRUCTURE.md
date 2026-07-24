# SmartBuy AI｜專案結構與分層規範

> 本文件定義目前專案的正式目錄責任、依賴方向與後續重構邊界。  
> 目標不是一次搬動所有檔案，而是讓每次 PR 都能逐步改善結構，同時保留既有功能、API 與部署入口。

## 1. 正式頂層結構

```text
smartbuy-ai/
├─ .agents/                 # 專案級 Agent Skills
├─ .github/                 # GitHub Actions 與協作設定
├─ backend/                 # FastAPI 傳輸層、應用組裝與線上服務
├─ data/                    # 可版本化資料、種子資料與資料產物目錄
├─ docs/                    # 架構、UI/UX、流程與任務文件
├─ frontend/                # React／Vite 前端
├─ models/                  # 模型檔案或模型產物
├─ scripts/                 # 可重複執行的資料與維運腳本
├─ src/                     # Python 領域邏輯、資料存取、特徵與模型能力
├─ tests/                   # Python 自動化測試
├─ AGENT.md                 # 全專案開發總規範
├─ AGENTS.md                # Agent 執行入口
├─ README.md                # 對外功能與技術介紹
├─ render.yaml              # Render 後端部署設定
└─ requirements.txt         # 舊部署／測試相容入口
```

## 2. 後端正式分層

```text
backend/
├─ main.py                  # Uvicorn／Render 穩定入口，只建立 app
├─ application.py           # FastAPI 應用程式工廠與 middleware 組裝
├─ api/
│  └─ router.py             # Router 集中註冊
├─ core/
│  ├─ settings.py           # 應用名稱、版本、CORS、環境載入
│  └─ lifecycle.py          # 啟動預載、背景工作與關閉清理
├─ routers/                 # HTTP endpoint 與 request/response 邊界
├─ models.py                # 既有 ORM 模型；後續再依領域分拆
├─ schemas.py               # 既有 Pydantic schema；後續再依領域分拆
├─ auth.py                  # 既有認證共用邏輯
└─ cache.py                 # 既有市場快取與彙整邏輯

src/
├─ anomaly/                 # 異常與價格狀態判定
├─ data/                    # 資料存取與 repository
├─ features/                # 特徵工程
├─ models/                  # 模型訓練／推論能力
└─ ...                      # 與 HTTP 框架無關的領域能力
```

### 2.1 後端依賴方向

```text
backend/main.py
  → backend/application.py
    → backend/api + backend/core
      → backend/routers
        → backend 共用模組 + src 領域能力
```

強制原則：

- `main.py` 不放業務邏輯、Router 清單、資料查詢或背景工作細節。
- `routers/` 負責 HTTP 邊界，不應逐步變成大型資料處理檔案。
- 與 FastAPI 無關且可獨立測試的資料、規則、特徵與模型邏輯，優先放在 `src/`。
- `src/` 不得反向依賴 `backend/routers/` 或 FastAPI request 物件。
- 新增 Router 時，同步在 `backend/api/router.py` 註冊。
- 新增啟動／關閉工作時，集中放在 `backend/core/lifecycle.py`，並具備失敗清理。

## 3. 前端正式分層

```text
frontend/src/
├─ index.jsx                # React DOM 與 Provider 入口
├─ App.jsx                  # BrowserRouter、捲動與全域 Hook 的應用外殼
├─ routes/
│  └─ AppRoutes.jsx         # 公開與後台路由組裝
├─ layouts/                 # PublicLayout／DashboardLayout
├─ pages/
│  ├─ dashboard/            # 後台頁面
│  └─ *.jsx                 # 現有公開頁面；後續可分批移入 pages/public
├─ components/
│  ├─ shared/               # 專案共用 UI 與 Guard
│  ├─ public/               # 消費者前台專用元件
│  ├─ dashboard/            # 後台專用元件
│  ├─ ui/                   # 過渡中的基礎元件；新增前先確認 shared 是否已有等價元件
│  └─ *.jsx                 # 舊版共用元件；只維護，不再新增同層檔案
├─ config/                  # 角色、權限、模組與穩定設定
├─ context/                 # React Context
├─ hooks/                   # 可重複使用的 Hook 與瀏覽器副作用
├─ lib/                     # API adapter、純函式與第三方整合
└─ styles/                  # token、全域與 Layout 樣式
```

### 3.1 前端依賴方向

```text
index.jsx
  → App.jsx
    → routes + hooks
      → layouts + pages
        → domain components + shared components
          → config + context + lib
```

強制原則：

- `App.jsx` 不直接堆疊所有頁面 import、權限表與路由細節。
- 路由集中於 `routes/`；角色與權限常數集中於 `config/`。
- DOM、localStorage、事件監聽等可重複副作用優先封裝於 `hooks/`。
- `components/shared/` 是目前正式共用元件入口；不得再為相同用途建立另一套元件而不處理命名與差異。
- 公開前台元件不得依賴 Dashboard Layout；後台元件不得直接嵌入 Public Layout。
- 新頁面仍須遵守 Mobile、Tablet、Desktop 三尺寸驗證。

## 4. 已發現的過渡區

以下內容不在本階段直接刪除或大量搬動：

1. `backend/` 與根目錄 `src/` 並存：正式定義為「HTTP／應用層」與「領域／資料能力層」，後續按依賴方向逐步整理。
2. `frontend/src/components/shared/`、`components/ui/` 與根層元件並存：先停止新增重複元件，再透過引用搜尋逐項合併。
3. 公開頁面仍直接位於 `pages/`：新頁面優先採 `pages/public/`，舊頁面應以小型 PR 分批移動並更新所有 import。
4. `backend/models.py`、`schemas.py` 仍是集中檔案：只有在單一領域已形成穩定模組且測試足夠時才拆分。
5. 根目錄 `requirements.txt` 同時承擔舊部署與測試相容：依賴拆分應另開 PR，先確認 Render、Actions 與本機指令。

## 5. 重構規則

每次結構重構必須：

1. 先搜尋所有 import、路由、部署命令、測試與文件引用。
2. 只移動一個清楚領域或一種責任，不做全站搬家。
3. 保留相同 URL、API contract、角色權限與資料來源。
4. 不以刪除大量程式碼作為預設方式。
5. 至少執行受影響層的 Build／測試。
6. PR 說明列出舊位置、新位置、相容性與回滾方式。

## 6. 下一階段建議

依風險由低到高：

1. 建立前端 API client 層，逐步移除各頁散落的 `VITE_API_URL` 與 `fetch` 重複處理。
2. 盤點未使用或重複的前端元件，建立「保留／合併／淘汰」清單後再移除。
3. 將大型 Router 的資料處理抽到 service／repository，Router 只保留 HTTP 邊界。
4. 拆分 runtime、dev、data-pipeline 依賴，避免後端部署安裝不必要套件。
5. 依穩定領域拆分 `models.py` 與 `schemas.py`，並建立 migration 規範。

以上工作應分開成可獨立驗收的 PR，不與 UI 大改、資料庫 migration 或模型重訓混在同一階段。
