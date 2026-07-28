# SmartBuy AI｜三角色 AI 推薦提示語與單畫面規格

## 1. 目標

AI 推薦頁面使用同一分類行情，分別提供三個正式角色的決策建議：

| 角色 | 視角 | 核心問題 |
|---|---|---|
| `consumer` | 消費者／家庭採買端 | 現在適合買什麼、買多少、偏貴時可換什麼 |
| `farmer` | 農民／農業生產端 | 採收與出貨如何安排、哪些行情需要優先觀察 |
| `merchant` | 商家／通路銷售端 | 如何分批補貨、控制庫存、比較替代品 |

Desktop 必須在同一個畫面區塊以三欄並列顯示三角色；Tablet 與 Mobile 可改為單欄堆疊，以維持閱讀與操作品質。

## 2. 三套提示語

三套提示語集中於：

```text
src/recommendation/role_prompts.py
```

每套提示語必須具有獨立的：

- `objective`
- `decision_focus`
- `cautions`
- 角色標籤與決策視角

### 2.1 消費者提示語

聚焦家庭預算、採買時機、購買量與替代品。不得假設家庭人口、冰箱容量、健康狀況或營養療效。

### 2.2 農民提示語

聚焦採收、分批出貨、成本核對與行情觀察。不得虛構產量、產地、天氣、成本、保存條件或通路合約；不得只依單日行情指示擴種、停種或延後採收。

### 2.3 商家提示語

聚焦分批補貨、庫存風險、替代品與促銷方向。不得虛構門市庫存、銷量、毛利、客群或需求；不得提供保證獲利或操縱市場建議。

## 3. LLM 成本保護

三套提示語不等於三次 LLM 呼叫。

快取不存在時，後端建立一個 JSON prompt envelope，內含：

```json
{
  "role_prompts": {
    "consumer": {},
    "farmer": {},
    "merchant": {}
  },
  "output_schema": {
    "role_recommendations": {
      "consumer": {},
      "farmer": {},
      "merchant": {}
    }
  }
}
```

同一分類只允許一次 LLM 呼叫。任一角色缺少、格式錯誤或竄改候選行情資料時，整份輸出視為失敗，改用三角色規則備援。

## 4. 快取版本

本功能使用：

```text
schema_version = 5
prompt_set_version = three-role-v1
R2 Object Key = recommendations/v5/{market}-{category}.json
```

舊版 `recommendations/v1/` 保留，不覆寫、不刪除。若部署環境仍設定 `R2_RECOMMENDATION_PREFIX=recommendations/v1/`，Repository 會將尾端版本正規化為目前 schema 的 `v2`，避免寫入 `v1/v2/` 巢狀路徑。

## 5. JSON 結構

```json
{
  "schema_version": 2,
  "prompt_set_version": "three-role-v1",
  "cache_key": "leafy-vegetables",
  "category": {},
  "generated_at": "UTC datetime",
  "generator": "llm",
  "source_summary": {},
  "role_recommendations": {
    "consumer": {
      "role": "consumer",
      "role_label": "消費者",
      "perspective": "家庭採買端",
      "summary": "",
      "market_outlook": "",
      "shopping_strategy": "",
      "items": []
    },
    "farmer": {
      "role": "farmer",
      "role_label": "農民",
      "perspective": "農業生產端",
      "summary": "",
      "market_outlook": "",
      "shopping_strategy": "",
      "items": []
    },
    "merchant": {
      "role": "merchant",
      "role_label": "商家",
      "perspective": "通路銷售端",
      "summary": "",
      "market_outlook": "",
      "shopping_strategy": "",
      "items": []
    }
  }
}
```

API 為維持既有 caller 相容，仍提供：

- `data.recommendation`：指向 `consumer`
- `recommendations`：指向 `consumer.items`

新增 caller 應改讀 `role_recommendations`。

## 6. 畫面

`/dashboard/recommendations` 必須保留：

- 分類切換
- 生成來源
- JSON 快取狀態
- 候選品項與資料日期
- 重新讀取快取按鈕
- loading、empty、error 狀態

新增：

- 三套角色提示語狀態
- 消費者、農民、商家三張角色卡
- 每張卡顯示摘要、行情觀察、角色策略與最多六個行動建議
- 提示語版本與 `v2` 成本保護說明

本次不更改 Dashboard RBAC：`farmer`、`merchant`、`admin` 可進入；`consumer` 仍不可進入後台。畫面中的「消費者」代表分析視角，不代表放寬消費者帳號的 Dashboard 權限。

## 7. 驗收條件

- [ ] 單次 LLM prompt 包含三套不同角色目標。
- [ ] 單次 LLM 回傳三個角色，缺一即規則備援。
- [ ] 快取命中時 LLM 呼叫為 0。
- [ ] 同分類併發仍只呼叫一次。
- [ ] v1 快取不被覆寫，v2 使用獨立 Object Key。
- [ ] API 保留消費者舊欄位別名。
- [ ] Desktop 同畫面三欄；Tablet／Mobile 無水平溢位。
- [ ] 三角色均不虛構行情、供需、成本、庫存、天氣或食安資料。
