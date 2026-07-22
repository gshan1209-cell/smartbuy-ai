---
name: project-mybasket
description: 我的收藏的兩套獨立收藏系統、id 型別陷阱、cookie auth 限制
metadata:
  type: project
---

# 我的收藏（MyBasket.jsx）— 記憶重點

詳細架構見 `docs/architecture/frontend_mybasket.md`。

## 兩套收藏系統完全獨立

- 互助網收藏：`mutual_aid_saved` 表，走 `mutualAidApi.js`
- 品項/文章收藏：`user_favorites` 表，走 `favoritesService.js`

兩套互不共用、勿混淆。

## id 型別陷阱

localStorage 舊資料的 news id 是 number，API ref_id 是 string。`favoritesService.js` 一律正規化為 string；元件內比較要用 `String()`，否則會比對失敗導致重複收藏。

## Cookie auth — 不能用 useApi.js

`favoritesService.js` 所有請求帶 `credentials: 'include'`。`hooks/useApi.js` 的 get/post 不帶 cookie，不可用於收藏 API。
