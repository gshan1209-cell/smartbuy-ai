# SmartBuy AI｜便宜買 AI

把農產品行情、24 節氣與下一交易日價格方向分類轉成簡單採買建議的 React + FastAPI MVP。

- 🌐 線上體驗：https://smartbuy-ai-alpha.vercel.app/

## 系統架構

![SmartBuy AI 系統架構圖](docs/assets/architecture.svg)

## 功能總覽

| 頁面 | 路徑 | 說明 |
|---|---|---|
| 首頁 | `/` | 今日採買提醒 |
| 售價動態 | `/search` | 品項搜尋、歷史價格走勢 |
| 品項詳細 | `/product/:name` | 單一品項行情、購買建議、下一交易日方向預測 |
| 我的收藏 | `/basket` | 收藏品項，雲端同步（`/api/favorites`） |
| 農產新知 | `/news` | 農產相關文章（目前為 mock 資料） |
| 互助網 | `/mutual-aid` | 社群貼文、留言、按讚、收藏、圖片上傳 |
| 會員設定 | `/settings` | 會員資料、通知與顯示偏好 |
| 登入／註冊 | `/login`、`/register` | 帳號系統 |

## 技術棧

- **前端**：React 19 + Vite + React Router v6 + Tailwind CSS，Chart.js 繪製價格走勢
- **後端**：FastAPI + SQLAlchemy + psycopg2（連線 Supabase PostgreSQL）
- **ML**：LightGBM 價格方向分類模型（`models/07_lightgbm_selected_final.joblib`）
- **認證**：自建 JWT（bcrypt + python-jose），非 Supabase Auth
- **部署**：前端 Vercel、後端 Render Free tier（使用cron-job，每10分鐘呼叫，減少等待）

## 資料儲存與雙層架構 (Data Storage Architecture)

前端透過 REST API 呼叫後端 FastAPI，後端再依用途讀寫兩層資料儲存：

為了在免費雲端資源限制下支撐機器學習 (ML) 訓練所需的兩年歷史行情資料，SmartBuy AI 採用**雙層資料儲存架構**：

- **Supabase PostgreSQL**：作為線上 App 即時查詢與每日行情更新之用，僅保留最近 1 年資料，並用於會員、收藏、互助網等即時互動資料。
- **Cloudflare R2 Parquet 資料湖**：專為 ML 訓練保存的完整歷史行情，每日與行情更新雙向同步。
- **每日價格方向預測**：GitHub Actions 每日排程讀取 Parquet 資料湖，以 LightGBM 模型產生「下一交易日跌／持平／漲」方向分類，寫回 `price_direction_predictions`（正式 MVP 預測路徑；舊版五日數值預測 `prediction_results` 已棄用，不作為 fallback）。

完整資料架構規格（欄位、SQL、去重與安全機制）見 [docs/SPEC.md](docs/SPEC.md)；完整原始規格請見根目錄的 `SmartBuy_AI_便宜買AI_MVP完整開發規格書_v1.1_含任務中心與24節氣.md`（部分內容已隨開發調整，實際行為以 `docs/SPEC.md` 為準）。

## UI/UX 前台／後台改版文件

本次改版採用「消費者前台 + 儀表板後台」雙介面，並支援手機、平板、桌機三種尺寸：

- [前台／後台 UI/UX 與三尺寸 RWD 開發規格書](docs/uiux/SMARTBUY_UIUX_FRONT_BACK_RWD_SPEC.md)
- [分階段開發任務清單](docs/uiux/SMARTBUY_UIUX_TASKS.md)
- [Codex PR-1：UI/UX 基礎工程執行指令](docs/uiux/CODEX_PROMPT_PR1_UIUX_FOUNDATION.md)
