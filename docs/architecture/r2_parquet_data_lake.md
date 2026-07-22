# Cloudflare R2 Parquet 歷史資料湖串接與同步指引

本文件詳細說明 SmartBuy AI 專案如何將農產品價格的 Parquet 歷史資料湖（Data Lake）儲存於 Cloudflare R2，以及其自動化同步、測試與維護機制。

---

## 一、 架構與用途

由於 Supabase 免費版 PostgreSQL 資料庫有 **500 MB** 的限制，專案採用**雙層資料儲存架構**：
1. **Supabase**：僅保留最近 **1~3 個月** 的即時行情資料以提供線上高效能查詢。
2. **Cloudflare R2**：持久化保存所有的歷史行情 Parquet 檔案。每次每日行情更新時，會先從 R2 下載目前既有的所有歷史 Parquet 檔到本地，將最新行情與其合併並去重後，再重新上傳覆蓋回 R2，以低成本方式無限擴充歷史行情資料湖，供機器學習 (ML) 預測模組進行離線訓練。

---

## 二、 R2 Prefix 與物件命名設計

R2 Object Key 的格式設計如下，這能在 S3/R2 工具中呈現資料夾階層目錄結構：

* **R2 Bucket 名稱**：`R2_BUCKET_NAME` (例如 `smartbuy-historical-data`)
* **R2 Object Key 前綴 (Prefix)**：`history_parquet/agri_price/` (結尾必須有 `/`)
* **完整上傳路徑 (Object Key)**：
  `history_parquet/agri_price/agri_price_YYYY-MM.parquet`
* **本地儲存目錄**：
  `data/history_parquet/agri_price_YYYY-MM.parquet`

---

## 三、 GitHub Secrets 設定

為了讓 GitHub Actions runner 在執行更新時擁有 R2 連線與讀寫權限，請於 Repository $\to$ Settings $\to$ Secrets and variables $\to$ Actions 下建立以下 Secrets：

| Secret 名稱 | 說明 | 範例值 |
| :--- | :--- | :--- |
| `R2_ACCOUNT_ID` | Cloudflare 帳戶 ID（可在 CF Dashboard 右側側邊欄找到） | `abc123xyz456...` |
| `R2_ACCESS_KEY_ID` | R2 API 憑證的 Access Key | `def456...` |
| `R2_SECRET_ACCESS_KEY` | R2 API 憑證的 Secret Access Key | `ghi789...` |
| `R2_BUCKET_NAME` | R2 儲存桶名稱 | `smartbuy-historical-data` |
| `R2_ENDPOINT_URL` | R2 API 的 S3 連線端點 | `https://<account_id>.r2.cloudflarestorage.com` |
| `R2_PARQUET_PREFIX` | R2 內部的儲存路徑前綴 | `history_parquet/agri_price/` |

---

## 四、 嚴格模式與失敗阻斷防禦機制

### 1. 嚴格模式 (Strict Mode)
為了防範在 GitHub Actions 或特定正式生產環境下，因 Secrets 忘記設定而導致腳本默默跳過 R2 同步：
* 系統會自動檢查環境變數 `GITHUB_ACTIONS=true` 或 `R2_REQUIRED=true`。
* 當嚴格模式啟用時，若 R2 必要的連線 credentials（Access Key、Endpoint、Secret 等）缺失，程式會直接拋出 `ValueError` 以 **Exit Code 1** 終止，進而使整個 GitHub Actions Workflow 失敗報警。

### 2. 失敗阻斷機制 (Pruning Prevention)
為了確保雲端資料的安全：
* 資料同步的執行順序為：`R2 Download` $\to$ `API Fetch` $\to$ `Local Parquet Save` $\to$ `R2 Upload` $\to$ `R2 Verify` $\to$ `Supabase Upsert` $\to$ `Supabase Pruning`。
* 在上傳 Parquet 至 R2 後，系統會主動透過 `head_object` API 檢查 R2 物件大小，確認與本地上傳的檔案位元組數（ContentLength）完全相同。
* **若 R2 Upload 或 Verify 出現任何失敗，將會直接拋出 Exception 阻斷後續流程，此時絕對不會執行 Supabase prune 清理 90 天前歷史資料的 SQL**。

---

## 五、 本地開發與測試方法

### 1. 離線開發模式
在未設定任何 R2 環境變數且 `R2_REQUIRED` 未設為 `true` 的本機開發環境下，程式會顯示溫和的提示訊息：
`【提示】Cloudflare R2 環境變數設定不完整。跳過 R2 同步流程。`
此時腳本只會更新本地 `data/history_parquet/` 下的 Parquet 檔案，並正常執行 Supabase 寫入（若有連線）或單純離線運行，不會影響本機開發。

### 2. CLI 工具手動同步
專案提供獨立的同步工具 [`scripts/sync_parquet_r2.py`](file:///d:/AI人工智慧/專題/smartbuy-ai/scripts/sync_parquet_r2.py)，您可以在本機或 Actions 中單獨執行：
* **列出 R2 現有物件**：
  ```bash
  python scripts/sync_parquet_r2.py list
  ```
* **下載所有 R2 歷史檔案**：
  ```bash
  python scripts/sync_parquet_r2.py download
  ```
* **上傳本地 Parquet 檔案**：
  ```bash
  python scripts/sync_parquet_r2.py upload
  ```
* **驗證上傳檔案完整性**：
  ```bash
  python scripts/sync_parquet_r2.py verify
  ```

### 3. 測試執行
本專案使用 `unittest.mock` 來 Mock `boto3.client`，不需要安裝任何 `moto` 或其他的第三方大套件。
* **執行 R2 同步測試**：
  ```bash
  .\.venv\Scripts\python.exe -m pytest tests/test_r2_sync.py -q
  ```
* **執行全專案單元測試**：
  ```bash
  .\.venv\Scripts\python.exe -m pytest -q
  ```

---

## 六、 安全防護：禁止 Commit Parquet 檔案

依據專案安全政策，所有的 `.parquet` 歷史資料檔案均不得被 commit 與 push 到 GitHub。
* 核心設定已載入於 [`.gitignore`](file:///d:/AI人工智慧/專題/smartbuy-ai/.gitignore)：
  ```text
  data/history_parquet/*.parquet
  data/history_parquet/**/*.parquet
  ```
* 在每次執行 `git commit` 前，請務必使用 `git status` 再次檢查，確保沒有任何 `.parquet` 檔案處於 staged 狀態。

---

## 七、 回滾與降級方案 (Rollback Strategy)

若 Cloudflare R2 遭遇短暫的服務異常、API 速率限制 (Rate Limit) 或需要緊急切換儲存媒介：
1. **R2 降級**：直接從 GitHub Actions Secrets 或環境變數中，**移除或清除 `R2_ACCESS_KEY_ID` 等必要的 R2 連線變數**。
2. **自動 Fallback**：更新腳本將會自動識別為「R2 未設定」，並跳過下載與上傳步驟。它會直接使用本地現有的 Parquet 進行去重與合併，並維持 Supabase 的日常更新，確保前端 App 的資料不會中斷。
