"""
模組名稱: src.recommendation.alternative_recommender
功能說明: 替代品推薦邏輯，當某項蔬菜太貴時推薦其他選擇。

【相關元件 (Related Components)】
- 依賴: src.data.data_loader.load_product_origins
"""
from __future__ import annotations

from src.data.data_loader import load_product_origins


PREFERRED_ALTERNATIVES = {
    "高麗菜": ["地瓜葉", "青江菜", "小白菜"],
    "小白菜": ["青江菜", "地瓜葉", "高麗菜"],
    "青江菜": ["小白菜", "地瓜葉", "高麗菜"],
    "絲瓜": ["冬瓜", "苦瓜"],
    "苦瓜": ["絲瓜", "冬瓜"],
}


def get_alternatives(product_name: str, limit: int = 3) -> list[str]:
    if product_name in PREFERRED_ALTERNATIVES:
        return PREFERRED_ALTERNATIVES[product_name][:limit]
    data = load_product_origins()
    match = data[data["product_name"] == product_name]
    if match.empty:
        return []
    category = match.iloc[0]["category"]
    return data[
        (data["category"] == category) & (data["product_name"] != product_name)
    ]["product_name"].head(limit).tolist()

