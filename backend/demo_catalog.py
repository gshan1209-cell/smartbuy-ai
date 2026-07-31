"""展示版市場與作物白名單。

清單由正式資料庫三個市場各自最近 30 個交易日的前十名取聯集後固定。
每個市場查詢同一份大清單；來源市場沒有該作物時自然不回傳資料。
API 請求只讀取此設定，不會重新排名或修改來源資料。
"""
from __future__ import annotations


DEMO_MARKETS: dict[str, str] = {
    "400": "台中市",
    "109": "台北一",
    "800": "高雄市",
}

DEMO_MARKET_TOP_CROPS: dict[str, tuple[str, ...]] = {
    "400": ("R6", "B2", "R1", "P1", "A1", "T1", "O10", "G3", "Y1", "812"),
    "109": ("LA2", "LA1", "P1", "T1", "FD1", "SA9", "FJ3", "FF1", "SB2", "LO1"),
    "800": ("LA1", "LA2", "SB2", "T1", "X69", "LC93", "I1", "FJ3", "SD1", "O10"),
}

DEMO_CROP_NAMES: dict[str, str] = {
    "R6": "芒果-金煌",
    "B2": "鳳梨-金鑽鳳梨",
    "R1": "芒果-愛文",
    "P1": "番石榴-珍珠芭",
    "A1": "香蕉",
    "T1": "西瓜-大西瓜",
    "O10": "梨-寶島甘露梨",
    "G3": "酪梨",
    "Y1": "桃子-水蜜桃",
    "812": "紅龍果-紅肉",
    "LA2": "甘藍-改良種",
    "LA1": "甘藍-初秋",
    "FD1": "花胡瓜",
    "SA9": "蘿蔔-進口",
    "FJ3": "番茄-牛番茄",
    "FF1": "絲瓜",
    "SB2": "胡蘿蔔-清洗",
    "LO1": "甘薯葉",
    "X69": "蘋果-富士進口",
    "LC93": "包心白菜-進口 包頭蓮",
    "I1": "木瓜-網室紅肉",
    "SD1": "洋蔥-本產",
}


def _unique_crop_ids() -> tuple[str, ...]:
    return tuple(dict.fromkeys(
        crop_id
        for market_crops in DEMO_MARKET_TOP_CROPS.values()
        for crop_id in market_crops
    ))


DEMO_GRAND_CROP_IDS = _unique_crop_ids()
DEMO_MARKET_CROPS: dict[str, tuple[str, ...]] = {
    market_code: DEMO_GRAND_CROP_IDS for market_code in DEMO_MARKETS
}

_MARKET_CODES_BY_NAME = {name: code for code, name in DEMO_MARKETS.items()}


def demo_market_names() -> list[str]:
    """依展示設定順序回傳市場名稱。"""
    return list(DEMO_MARKETS.values())


def demo_market_code(market_name: str) -> str | None:
    return _MARKET_CODES_BY_NAME.get(market_name.strip())


def demo_crop_ids(market_name: str) -> tuple[str, ...]:
    market_code = demo_market_code(market_name)
    return DEMO_MARKET_CROPS.get(market_code or "", ())


def demo_crop_names(market_name: str) -> tuple[str, ...]:
    market_code = demo_market_code(market_name)
    if market_code is None:
        return ()
    return tuple(DEMO_CROP_NAMES[crop_id] for crop_id in DEMO_MARKET_CROPS[market_code])


def demo_crop_rank(market_name: str) -> dict[str, int]:
    return {name: rank for rank, name in enumerate(demo_crop_names(market_name))}


def is_demo_market_crop(market_name: str, crop_name: str) -> bool:
    return crop_name.strip() in demo_crop_names(market_name)


def filter_demo_prices(prices, market_name: str):
    """保留指定展示市場的固定作物，並以白名單排名排序。"""
    market_code = demo_market_code(market_name)
    if market_code is None:
        return prices.iloc[0:0].copy()

    crop_ids = DEMO_MARKET_CROPS[market_code]
    filtered = prices[prices["market_name"].fillna("").astype(str) == DEMO_MARKETS[market_code]]
    if "crop_code" in filtered.columns:
        filtered = filtered[filtered["crop_code"].fillna("").astype(str).isin(crop_ids)]
    else:
        filtered = filtered[
            filtered["product_name"].fillna("").astype(str).isin(demo_crop_names(market_name))
        ]

    order = {crop_id: rank for rank, crop_id in enumerate(crop_ids)}
    if "crop_code" in filtered.columns:
        filtered = filtered.assign(
            _demo_rank=filtered["crop_code"].fillna("").astype(str).map(order)
        ).sort_values(["_demo_rank", "trans_date"]).drop(columns="_demo_rank")
    return filtered.copy()
