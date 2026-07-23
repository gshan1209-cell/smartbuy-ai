# 農業部縣市農產統計資料來源

## 1. 權威統計書刊

- 名稱：農業部農業統計資料查詢－統計書刊
- URL：`https://agrstat.moa.gov.tw/sdweb/public/book/Book.aspx`
- 用途：確認農產品生產、面積、產量、產值、縣市排名與年度統計的正式定義、表格註解及修正歷程。
- 類型：Official Publication

此入口屬統計書刊與查詢網站，不應由 SmartBuy AI 前端直接解析 HTML，也不得以爬蟲複製頁面資料。

## 2. 動態統計查詢

- 名稱：農業部農業統計動態查詢
- URL：`https://agrstat.moa.gov.tw/sdweb/public/inquiry/InquireAdvance.aspx`
- 用途：人工驗證農產品生產面積、產量值及縣市分類結果。
- 類型：Official Query Portal

## 3. 機器可讀開放資料

- 名稱：農情調查
- URL：`https://data.gov.tw/dataset/7302`
- 提供欄位：年度、期作、縣市、鄉鎮、作物代碼、作物、種植面積、收穫面積、每公頃收穫量與總收量。
- 格式：JSON、CSV、XML
- 更新頻率：每年
- 授權：政府資料開放授權條款第 1 版
- 類型：Official Open Data

## 4. SmartBuy AI 整合原則

### 第一階段

- 首頁顯示「官方來源已確認、資料介接中」。
- 不顯示虛構縣市排名、產量、種植面積或主要產區。
- 少量版型資料只能標示 Demo。
- 即時批發行情仍使用 SmartBuy AI 既有 `/api/products`。

### 第二階段

建立後端 ETL：

```text
MOA Open Data
→ Download / Fetch
→ Schema validation
→ County / township normalization
→ Crop-name mapping
→ PostgreSQL or R2 snapshot
→ SmartBuy AI read-only API
```

建議 API：

```text
GET /api/agriculture/counties
GET /api/agriculture/counties/{county}/products
GET /api/agriculture/products/{product}/origins
GET /api/agriculture/products/{product}/rankings
```

### 資料來源標籤

前端固定使用：

- `Official API`：SmartBuy AI 或農業部正式機器介面
- `Official Publication`：官方統計書刊與定義來源
- `Static Seed`：專案內人工維護的季節推薦
- `Demo`：只供版型或流程展示
- `Unavailable`：資料來源或介接尚未完成

## 5. 禁止事項

- 禁止前端直接爬取統計書刊 HTML。
- 禁止將書刊入口宣稱為即時 API。
- 禁止把 Demo 縣市農產標示為官方資料。
- 禁止 API 失敗時自動顯示「正常」或固定產量。
- 禁止提交存取 Token、Cookie 或其他秘密資訊。
- 禁止忽略官方資料的年度、單位、初步值、修正值與估計值標記。
