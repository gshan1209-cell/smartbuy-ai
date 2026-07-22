---
name: project-settings
description: 設定頁的雙層儲存慣例、weatherAlert 無 UI、新增偏好欄位的四處同步清單
metadata:
  type: project
---

# 設定頁（Settings.jsx）— 記憶重點

詳細架構見 `docs/architecture/frontend_settings.md`。

## weatherAlert 存在但無 UI

`weatherAlert` 欄位存在後端 `user_preferences` 與 localStorage，但設定頁沒有對應 UI（刻意如此，非 bug）。

## 新增偏好欄位時需同步四處

1. `DEFAULT_PREFS` / `DEFAULT_DISPLAY`（前端預設值）
2. `splitPrefs()`（前端拆分邏輯）
3. 後端 `UpdatePreferencesRequest` Pydantic model
4. `user_preferences` 資料表 schema

漏掉任一處會造成偏好靜默丟失或後端 422。

## 雙層儲存慣例

Settings 同時寫 localStorage 和後端。進頁面時從後端拉最新值覆蓋 localStorage；後端失敗時靜默 fallback localStorage。不要只更新其中一層。
