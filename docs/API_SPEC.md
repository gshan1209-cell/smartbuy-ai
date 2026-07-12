# API 與函式介面

目前 MVP 採 FastAPI 後端與 React/Vite 前端。前端透過 HTTP API 呼叫後端，後端再呼叫 Python 領域模組與資料存取層。

## HTTP API

| 路徑 | 用途 |
|---|---|
| `GET /health` | 健康檢查 |
| `GET /api/home` | 首頁節氣、天氣提醒與採買推薦 |
| `GET /api/markets` | 市場清單 |
| `GET /api/products` | 品項列表與行情狀態 |
| `GET /api/products/{name}` | 單一品項行情、建議與天氣影響 |
| `GET /api/products/{name}/history` | 單一品項歷史價格走勢 |
| `GET /api/predictions/direction/latest` | 單一市場作物最新下一交易日方向分類 |
| `GET /api/predictions/direction` | 多筆下一交易日方向分類列表 |
| `POST /api/report` | 使用者買貴通報 |
| `GET /api/weather-summary` | 天氣影響摘要 |
| `GET /api/solar-term` | 目前節氣 |

## Python 內部函式

| 函式 | 輸入 | 主要輸出 |
|---|---|---|
| `get_price_status` | 品項、選填市場 | 今日價格、狀態、白話原因 |
| `get_origin_weather_risk` | 品項 | 主要產地、風險等級、提醒 |
| `get_today_solar_term_advice` | 選填日期 | 節氣、說明、推薦品項 |
| `get_purchase_advice` | 品項 | 價格、天氣、節氣、替代品整合建議 |
| `load_tasks` | 選填 JSON 路徑 | 任務陣列 |
| `update_task_status` | 任務 ID、狀態 | 無；更新 JSON |

若任務中心檔案不存在，任務相關函式與文件應視為歷史規劃，不是目前執行入口。

