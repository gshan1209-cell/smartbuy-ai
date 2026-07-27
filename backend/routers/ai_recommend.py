"""
SmartBuy AI — AI 採買建議 Router

POST /api/ai-recommend
- 取今日菜價狀態
- 組 Prompt 呼叫 Google Gemini
- 回傳白話採買建議文字 + 推薦品項
- 同參數 5 分鐘內快取，不重複呼叫 LLM
"""
from __future__ import annotations

import asyncio
import datetime
import hashlib
import logging
import os
import time
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

_GEMINI_TIMEOUT_SECONDS = 20

_STATIC_SEED_ITEMS = (
    {"product_name": "高麗菜", "today_price": 28.0, "status": "便宜"},
    {"product_name": "小白菜", "today_price": 35.0, "status": "正常"},
    {"product_name": "番茄", "today_price": 62.0, "status": "偏貴"},
    {"product_name": "胡蘿蔔", "today_price": 32.0, "status": "正常"},
    {"product_name": "青江菜", "today_price": 30.0, "status": "便宜"},
    {"product_name": "洋蔥", "today_price": 38.0, "status": "正常"},
)

router = APIRouter()

# ── 簡易 in-memory 快取 ─────────────────────────────────────────
_ai_cache: dict[str, dict] = {}
_AI_CACHE_TTL = 300  # 5 分鐘

def _cache_key(market: str | None, region: str | None, top_n: int) -> str:
    raw = f"{market or ''}|{region or ''}|{top_n}"
    return hashlib.md5(raw.encode()).hexdigest()

def _get_cached(key: str) -> dict | None:
    entry = _ai_cache.get(key)
    if entry and time.time() - entry["ts"] < _AI_CACHE_TTL:
        return entry["data"]
    return None

def _set_cached(key: str, data: dict) -> None:
    _ai_cache[key] = {"data": data, "ts": time.time()}


# ── Pydantic Schema ────────────────────────────────────────────
class AiRecommendRequest(BaseModel):
    market: str = Field(min_length=1)
    region: Optional[str] = None
    top_n: int = 10


# ── 取今日菜價資料 ──────────────────────────────────────────────
def _get_price_items(market: str | None, top_n: int) -> list[dict]:
    """從快取或即時載入取菜價狀態清單。"""
    from backend.cache import price_cache
    from src.data.price_repository import load_price_history
    from src.anomaly.price_status import get_all_price_statuses

    prices = price_cache.get("prices")
    if prices is None:
        try:
            prices = load_price_history(days=30)
        except Exception:
            return []

    if market and "market_name" in prices.columns:
        prices = prices[prices["market_name"] == market]

    try:
        statuses = get_all_price_statuses(prices)
    except Exception:
        return []

    # AI 推薦只使用資料狀態可判讀的今日行情；資料不足或歷史資料不得混入候選。
    valid_statuses = {"便宜", "正常", "偏貴"}
    statuses = [
        item
        for item in statuses
        if item.get("status") in valid_statuses
        and item.get("today_price") is not None
        and not item.get("is_historical", False)
    ]
    rank = {"便宜": 0, "正常": 1, "偏貴": 2}
    sorted_items = sorted(
        statuses,
        key=lambda x: (rank.get(x.get("status", "資料不足"), 3), x.get("product_name", ""))
    )
    return sorted_items[:top_n]


def _get_static_seed_items(top_n: int) -> list[dict]:
    """正式行情沒有可用候選時提供展示用樣板，並由 response 明確標示來源。"""
    return [
        {**item, "data_source": "Static Seed", "is_historical": False}
        for item in _STATIC_SEED_ITEMS[:top_n]
    ]


# ── 組 Prompt ──────────────────────────────────────────────────
def _build_prompt(
    items: list[dict],
    market: str | None,
    region: str | None,
    today: str,
) -> str:
    location_str = ""
    if market:
        location_str = f"市場：{market}"
    elif region:
        location_str = f"地區：{region}部"
    else:
        location_str = "全台批發市場"

    lines = []
    for item in items:
        name = item.get("product_name", "")
        price = item.get("today_price")
        status = item.get("status", "資料不足")
        price_str = f"{price:.1f} 元/公斤" if price is not None else "今日無行情"
        lines.append(f"- {name}：{price_str}，價格狀態：{status}")

    price_table = "\n".join(lines) if lines else "（今日無可用菜價資料）"

    return f"""你是 SmartBuy AI 的採買建議助理，幫助台灣的消費者做出聰明的菜市場採買決策。

今天是 {today}，以下是 {location_str} 的今日蔬果行情：

{price_table}

請根據上述資料，用繁體中文、白話輕鬆的語氣，提供：
1. **今日採買總結**（1-2 句，說明整體行情氛圍）
2. **最值得買的 3 項**（列舉品名 + 一句推薦理由）
3. **建議觀望的品項**（若有偏貴的，列舉 1-2 項 + 原因）
4. **一個實用小提示**（與今日行情或節氣有關）

回應格式請用親切的條列式，不要使用 Markdown 標題符號（###），改用 emoji 開頭。回應長度約 150-200 字。"""


def _build_rules_fallback(items: list[dict], market: str | None, region: str | None) -> str:
    """LLM 不可用時，以已取得的行情狀態提供可辨識的規則式備援。"""
    scope = market or region or "全台"
    cheap = [item.get("product_name") for item in items if item.get("status") == "便宜"]
    expensive = [item.get("product_name") for item in items if item.get("status") == "偏貴"]
    normal = [item.get("product_name") for item in items if item.get("status") == "正常"]

    lines = [f"⚙️ AI 暫時未回應，先依 {scope} 今日行情提供規則備援。"]
    if cheap:
        lines.append(f"🛒 優先看看：{'、'.join(cheap[:3])}，目前價格狀態較划算。")
    elif normal:
        lines.append(f"🧺 價格平穩：{'、'.join(normal[:3])}，可依今天的菜單與需求採買。")
    else:
        lines.append("🧺 目前沒有標示為便宜或正常的品項，建議先少量採買並持續觀察。")
    if expensive:
        lines.append(f"⏳ 可先觀望：{'、'.join(expensive[:2])}，或比較其他市場與替代品。")
    lines.append("ℹ️ 以上是行情規則備援，不是 LLM 生成；實際價格仍以市場資料為準。")
    return "\n".join(lines)


# ── 呼叫 Gemini ────────────────────────────────────────────────
def _call_gemini(prompt: str) -> str:
    api_key = os.getenv("GOOGLE_API_KEY", "")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY 未設定")

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.7,
                max_output_tokens=512,
            ),
            request_options={"timeout": _GEMINI_TIMEOUT_SECONDS},
        )
        return response.text.strip()
    except Exception as exc:
        logger.error("Gemini API 呼叫失敗：%s", exc)
        raise


# ── Endpoint ───────────────────────────────────────────────────
@router.post("/api/ai-recommend")
async def ai_recommend(req: AiRecommendRequest):
    """呼叫 Gemini 生成白話採買建議。"""
    cache_key = _cache_key(req.market, req.region, req.top_n)
    cached = _get_cached(cache_key)
    if cached:
        return {**cached, "cached": True, "cache_hit": True}

    items = _get_price_items(req.market, req.top_n)
    data_status = "official"
    source_name = "正式行情資料"
    limitations: list[str] = []
    if not items:
        items = _get_static_seed_items(req.top_n)
        data_status = "static_seed"
        source_name = "Static Seed"
        limitations.append("目前沒有可用的正式行情，品項與價格為展示用樣板資料。")
    today = datetime.date.today().strftime("%Y 年 %m 月 %d 日")
    prompt = _build_prompt(items, req.market, req.region, today)

    llm_called = False
    generator = "gemini-2.0-flash"
    try:
        summary = await asyncio.wait_for(
            asyncio.to_thread(_call_gemini, prompt),
            timeout=_GEMINI_TIMEOUT_SECONDS,
        )
        llm_called = True
    except asyncio.TimeoutError:
        logger.warning("Gemini API 呼叫超過 %s 秒，改用規則備援。", _GEMINI_TIMEOUT_SECONDS)
        summary = _build_rules_fallback(items, req.market, req.region)
        generator = "rules-fallback"
    except Exception as exc:
        logger.warning("Gemini API 不可用（%s），改用規則備援。", type(exc).__name__)
        summary = _build_rules_fallback(items, req.market, req.region)
        generator = "rules-fallback"

    result = {
        "summary": summary,
        "items": [
            {
                "product_name": i.get("product_name"),
                "today_price": i.get("today_price"),
                "status": i.get("status"),
            }
            for i in items
        ],
        "market": req.market,
        "region": req.region,
        "data_status": data_status,
        "source_name": source_name,
        "limitations": limitations,
        "source": generator,
        "generator": generator,
        "llm_called": llm_called,
        "cache_hit": False,
        "generated_at": datetime.datetime.now().isoformat(),
        "cached": False,
    }
    _set_cached(cache_key, result)
    return result
