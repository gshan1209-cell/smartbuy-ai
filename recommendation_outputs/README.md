# 每日推薦 JSON 上傳入口

請將 ChatGPT 回傳的單一純 JSON 檔案，以 `YYYY-MM-DD.json` 命名後，使用 GitHub 網頁的 **Add file → Upload files** 上傳到這個資料夾，並直接 commit 到 `main`。

例如：

```text
recommendation_outputs/2026-08-03.json
```

上傳後，`Publish Daily Recommendation Upload` workflow 會自動：

1. 驗證三市場、三角色 JSON Schema。
2. 執行每日推薦 focused tests。
3. 更新 `frontend/public/recommendations-daily/` 與 `latest.json`。
4. 執行前端測試與 build budget 檢查。
5. 將驗證後的發布快照 push 回 `main`，觸發既有 App 部署。

驗證失敗時不會更新網站。不要上傳 Prompt、密鑰、Token 或其他敏感資料。
