---
name: project-homepage
description: 首頁現況：全部 mock 資料，尚未串接任何 API
metadata:
  type: project
---

# 首頁（Home.jsx）— 記憶重點

詳細架構見 `docs/architecture/frontend_homepage.md`。

## 重要現況

首頁目前為純展示頁，**所有資料均為 mock**，尚未接任何 API。

**How to apply:** 修改首頁時注意 mock 與真實 API 的切換點；Hero 統計數字（120+、30+ 等）是 hardcode，未來需從後端取得。
