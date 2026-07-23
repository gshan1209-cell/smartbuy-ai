# Codex 任務｜PR-5 四角色權限與後台行情管理

Repository：

```text
https://github.com/gshan1209-cell/smartbuy-ai.git
```

建議分支：

```text
feat/rbac-price-management
```

建議 PR 標題：

```text
feat(admin): establish four-role RBAC and price management dashboard
```

---

## 1. 開始前必讀

依序完整閱讀：

1. `AGENT.md`
2. `docs/uiux/SMARTBUY_UIUX_FRONT_BACK_RWD_SPEC.md`
3. `docs/uiux/SMARTBUY_UIUX_TASKS.md`
4. `docs/uiux/DASHBOARD_VISUAL_STYLE_REFERENCE.md`
5. 本文件
6. `frontend/src/context/AuthContext.jsx`
7. `frontend/src/components/shared/ProtectedRoute.jsx`
8. `frontend/src/layouts/DashboardLayout.jsx`
9. `frontend/src/components/dashboard/`
10. `frontend/src/pages/dashboard/DashboardOverview.jsx`
11. `backend/routers/auth.py`
12. `src/data/member_repository.py`
13. `src/data/auth_utils.py`
14. `backend/routers/product.py`
15. `backend/routers/market.py`
16. 現有 migration、SQL 與測試目錄

若舊文件仍出現 `operator` 或 `staff`，以 `AGENT.md` 與本文件為準。

---

## 2. 正式角色定案

本系統只有四種正式角色：

```text
consumer
farmer
merchant
admin
```

中文名稱：

| Role | 中文 |
|---|---|
| `consumer` | 消費者 |
| `farmer` | 農民 |
| `merchant` | 商家 |
| `admin` | 系統管理員 |

強制規則：

- 禁止新增 `operator`、`staff` 或其他正式角色。
- 未知或舊角色值一律以最低權限處理，不得自動升級成 `admin`。
- 註冊固定建立 `consumer`。
- 一般會員不得透過註冊、Profile 或前端表單修改角色。
- 不得把特定 Email 寫死為系統管理員。

---

## 3. 第一版權限矩陣

請集中定義，不得散落在 JSX：

| 模組 | consumer | farmer | merchant | admin |
|---|:---:|:---:|:---:|:---:|
| 前台 | ✓ | ✓ | ✓ | ✓ |
| Dashboard Overview |  | ✓ | ✓ | ✓ |
| 行情管理 |  | ✓ | ✓ | ✓ |
| 商品管理 |  |  | ✓ | ✓ |
| AI 預測 |  | ✓ | ✓ | ✓ |
| 天氣風險 |  | ✓ |  | ✓ |
| 節氣推薦 |  | ✓ | ✓ | ✓ |
| 內容管理 |  |  |  | ✓ |
| 互助網管理 |  |  |  | ✓ |
| 會員與角色 |  |  |  | ✓ |
| 通知管理 |  |  |  | ✓ |
| 資料任務 |  |  |  | ✓ |
| 系統設定 |  |  |  | ✓ |

建議 permission key：

```text
dashboard.view
prices.view
products.view
predictions.view
weather.view
seasonal.view
content.manage
mutualAid.manage
members.manage
notifications.manage
dataJobs.view
system.manage
```

---

# 4. 後端角色與安全

## 4.1 Migration

建立 idempotent migration，例如：

```text
scripts/migrations/20260723_add_member_role.sql
```

要求：

```sql
ALTER TABLE members
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'consumer';
```

並建立只允許四種角色的 constraint：

```text
consumer
farmer
merchant
admin
```

migration 必須可安全重複執行。

禁止：

- 自動將既有會員升級成 admin
- 在 migration 寫入真實 Email
- HTTP request 過程自動執行 `ALTER TABLE`

可在文件提供 placeholder 指派範例：

```sql
UPDATE members
SET role = 'admin'
WHERE email = '<ADMIN_EMAIL>';
```

## 4.2 相容尚未套用 migration 的環境

資料庫尚無 `members.role` 時：

- 既有登入、註冊、設定與前台不可壞掉
- 安全 fallback 為 `consumer`
- 只針對 role 欄位不存在做 fallback
- 其他真正 DB 錯誤不得被吞掉
- 不得因此開放 Dashboard

## 4.3 Auth 回傳

以下回傳加入 normalized role：

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
PATCH /api/auth/profile
```

Profile patch 不得接受 role。

## 4.4 後端權限 dependency

建立集中式模組，例如：

```text
backend/security/roles.py
```

至少提供等價能力：

```python
get_current_member()
require_roles(*roles)
require_permissions(*permissions)
```

行為：

- 未登入：401
- 權限不足：403
- 不信任 localStorage
- 不只靠 Sidebar 隱藏
- 不在每個 router 複製角色判斷

新增：

```text
GET /api/admin/access
```

只允許：

```text
farmer
merchant
admin
```

回傳角色、permissions 與 `dashboardAccess`，不得回傳敏感資料。

---

# 5. 前端權限骨架

建立：

```text
frontend/src/config/roles.js
frontend/src/config/permissions.js
frontend/src/config/dashboardNavigation.js
frontend/src/components/shared/RoleGuard.jsx
frontend/src/components/shared/PermissionGuard.jsx
frontend/src/pages/ForbiddenPage.jsx
```

重構 `ProtectedRoute.jsx`：

- 未登入 → `/login`
- 消費者或未知角色 → `/403`
- 權限確認中 → Loading
- access API 暫時失敗 → Retry State，不直接假裝無權限
- 權限不足的模組 → `/403`

`AuthContext` 增加：

```text
authLoading
refreshSession()
dashboardAccess
permissions
```

localStorage 只能作畫面快取，最終權限以後端為準。

現有 `VITE_ENABLE_DEMO_ADMIN` 僅可在：

```text
import.meta.env.DEV === true
```

且明確設為 `true` 時使用；production 不得繞過後端權限。

---

# 6. Dashboard 導覽

Sidebar、Drawer 與路由使用同一份 `dashboardNavigation`。

依 permission 過濾，而不是各元件自行判斷角色。

角色顯示：

- 農民
- 商家
- 系統管理員

不得顯示 `operator` 或 `staff`。

---

# 7. 後台行情管理

路由：

```text
/dashboard/prices
```

本 PR 先做唯讀行情監控，不建立修改、刪除或人工覆寫行情 API。

正式資料來源：

```text
GET /api/products
GET /api/markets
GET /api/market-intel
GET /api/products/{name}
GET /api/products/{name}/history
```

禁止用 Demo 取代以上正式 API。

## 7.1 頁面結構

依 `DASHBOARD_VISUAL_STYLE_REFERENCE.md`：

1. 深墨綠 Sidebar
2. 白色 Topbar
3. 淺灰內容背景
4. 頁首與重新整理
5. KPI 卡片
6. 趨勢／市場健康圖表
7. 行情資料表
8. 商品詳情 Drawer

## 7.2 KPI

至少顯示：

- 可用行情品項
- 便宜品項
- 正常品項
- 偏貴品項
- 資料不足品項
- 最新交易日
- 市場數
- 市場風險

每張卡片顯示資料來源與更新時間。

API 失敗不得顯示成 `0`。

## 7.3 篩選與表格

使用現有：

```text
DashboardFilterBar
ResponsiveDataTable
DashboardMetricCard
DashboardChartCard
```

篩選：

- 關鍵字
- 市場
- 價格狀態
- 清除篩選
- Mobile Drawer

表格欄位：

```text
品項
市場
今日價格
近期平均
狀態
建議
交易日
成交量
```

要求：

- 排序
- 分頁
- Loading／Empty／Error／Partial Error
- Desktop 完整表格
- Tablet 隱藏次要欄位
- Mobile 卡片
- Row 支援 Enter／Space

## 7.4 詳情 Drawer

點擊商品後顯示：

- 品項與市場
- 今日價格
- 高／中／低價
- 近期平均
- 狀態與採買建議
- 交易日
- 成交量
- 近 7／14／30 日趨勢入口或簡易圖
- 前往公開商品詳情頁

Drawer 必須支援 ESC、Overlay 關閉、Focus 與 Mobile 全寬。

---

# 8. 視覺驗收

後台正式採用參考圖的資訊層級，但轉為 SmartBuy AI 品牌：

- 深綠側欄
- 白色 Topbar
- 灰白背景
- 白色 KPI 卡片
- 綠／橘／紅／藍狀態語言
- 趨勢圖、健康狀態、表格清楚分區
- 不複製原參考品牌、Logo 或假資料

尺寸：

```text
360 × 800
390 × 844
768 × 1024
834 × 1112
1200 × 800
1440 × 900
```

---

# 9. 測試

後端至少測試：

- 註冊回傳 consumer
- 登入與 `/api/auth/me` 回傳 role
- 未登入 admin access → 401
- consumer admin access → 403
- farmer／merchant／admin 依矩陣授權
- 未知角色不得進入 Dashboard
- role 欄位尚不存在時前台 auth 仍可用但 Dashboard 不開放

前端至少測試：

- 四角色 normalization
- Dashboard 導覽權限
- ProtectedRoute loading／401／403／retry
- 行情 API 成功、空資料、單一來源失敗、多來源失敗
- 表格篩選、排序、分頁、Drawer

驗證命令：

```bash
cd frontend
npm install
npm run build
git diff --check

cd ..
pytest
```

若完整 pytest 有既有環境阻塞，必須列出失敗測試與原因，不得只寫「測試通過」。

---

# 10. 禁止事項

- 禁止新增第五種角色
- 禁止把 `operator` 或 `staff` 當正式角色
- 禁止只靠前端控制管理 API
- 禁止讓使用者自行升級角色
- 禁止寫死 admin Email
- 禁止用假 KPI 冒充真實資料
- 禁止修改、刪除或覆寫行情
- 禁止重寫整套 auth
- 禁止刪除既有前台與 API 功能
- 禁止將 secrets 提交到 Git

---

# 11. PR 回報

PR 說明必須包含：

- 四角色權限矩陣
- migration 與套用方式
- 尚未套 migration 時的相容策略
- 後端權限 dependency
- 前端權限來源
- 行情管理正式 API
- 視覺參考對照
- 三尺寸驗收
- Build 與測試結果
- 已知限制
- 程式碼刪除與替代位置

完成後建立 Pull Request，不要自行合併 `main`。
