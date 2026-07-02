# Claude 專案 Context（SmartBuy AI）

> 下次對話開始時，請 Claude 先讀這個檔案再繼續工作。
> 最後更新：2026-07-02

---

## 部署環境

| 服務 | 平台 | URL |
|------|------|-----|
| 前端 React | Vercel | https://smartbuy-ai-alpha.vercel.app/ |
| 後端 FastAPI | Render (Free) | https://smartbuyai-react.onrender.com |
| 資料庫 | Supabase PostgreSQL | table: `agri_price_daily` |
| Git repo | GitHub | github.com/gshan1209-cell/smartbuy-ai (main) |

- push to main → Vercel + Render 自動部署
- Render Free tier 閒置會 spin down，首次請求慢約 50 秒
- `frontend/.env.production`：`VITE_API_URL=https://smartbuyai-react.onrender.com`
- `frontend/vercel.json`：SPA rewrite（F5 重整不 404）

---

## 技術棧

- **前端**：React + Vite + React Router v6，無 UI library，自訂 CSS（yz- prefix 設計系統）
- **後端**：FastAPI + SQLAlchemy + pandas
- **天氣**：CWA 開放資料 API → `scripts/fetch_weather_history.py` → `data/weather/weather_daily.csv`
- **Auth**：目前假登入，帳密硬寫在 `frontend/src/context/AuthContext.jsx`
  - 帳號：`farmer@example.com` / 密碼：`farmer1234`
  - localStorage key：`yz_auth_user`

---

## 前端頁面狀態

| 路徑 | 頁面 | 狀態 |
|------|------|------|
| `/` | 首頁 | ✅ 真實資料 |
| `/search` | 售價動態 | ✅ 真實資料（Supabase + CWA 天氣 + 30天折線圖） |
| `/news` | 農產新知 | ⚠️ mock 文章（6篇寫死） |
| `/mutual-aid` | 互助網 | ⚠️ mock 貼文（重整消失） |
| `/basket` | 我的菜籃 | ✅ localStorage |
| `/settings` | 設定 | ⚠️ 推播偏好未串接 |

---

## 後端 API 端點

| Method | 路徑 | 說明 |
|--------|------|------|
| GET | `/api/products` | 搜尋農產品 |
| GET | `/api/products/{name}` | 品項詳細 + 購買建議 + 天氣影響 |
| GET | `/api/products/{name}/history?days=30` | 歷史價格走勢 |
| GET | `/api/markets` | 市場列表 |
| GET | `/api/solar-term` | 今日節氣 |
| GET | `/api/solar-term/all` | 全部節氣 |
| GET | `/api/weather-summary` | 天氣影響摘要 |
| POST | `/api/report` | 回報菜價 |

---

## LocalStorage Keys

| Key | 用途 |
|-----|------|
| `yz_auth_user` | 登入狀態 |
| `smartbuy_basket` | 菜籃品項 |
| `smartbuy_saved_news` | 收藏文章 |
| `smartbuy_saved_post_ids` | 收藏貼文 ID |
| `smartbuy_notif_prefs` | 推播偏好 |

---

## 待開發清單

### 🔴 高優先
- **互助網持久化**：貼文/留言重整消失，需 Supabase table（`community_posts`, `comments`）
- **GitHub Actions 排程**：每日自動執行 `fetch_weather_history.py`，`.yml` 未寫

### 🟡 中優先
- **農產新知真實資料**：需後端 proxy 農業部 API
- **品名 alias 表**：「甘藍」=「高麗菜」等，影響菜籃×農產新知關聯
- **Supabase Auth**：取代假登入

### 🟢 低優先 / Future
- **AI 價格預測**：`src/ml/baseline_predictor.py` 已存在，未串 API
- **推播通知串接**：等 Auth 完成
- **歷史比較**：折線圖疊加去年同期
- **產地地圖**：點擊縣市看天氣 + 主要農產
- **互助網圖片上傳**：需 Supabase Storage / Cloudflare R2
- **台東、澎湖天氣測站**：目前 15 縣市，這兩個缺

---

## 過去確認過的設計決策

- 圖片上傳跳過，等後端 Storage 再做
- 互助網與回報菜價分開（資料結構不同）
- 收藏/追蹤合併為單一★
- 互助網只存貼文 ID 到 localStorage（不存完整 mock 資料）
- `_redirects` 對 Vercel 無效，要用 `vercel.json`（已修）
