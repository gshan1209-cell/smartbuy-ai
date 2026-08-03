from __future__ import annotations

import copy
import json
import math
import os
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

import pandas as pd
from sqlalchemy import text

from src.data.agri_news_repository import query_agri_news
from src.data.database_url import load_database_url
from src.data.price_direction_prediction_store import query_prediction_list
from src.data.data_loader import load_market_prices
from src.data.price_repository import get_db_engine


SCHEMA_VERSION = 2
LEGACY_SCHEMA_VERSION = 1
SUPPORTED_SCHEMA_VERSIONS = (LEGACY_SCHEMA_VERSION, SCHEMA_VERSION)
TAIPEI_TZ = ZoneInfo("Asia/Taipei")
MARKETS = {
    "taipei-1": {"name": "台北一", "region": "北部"},
    "taichung-city": {"name": "台中市", "region": "中部"},
    "kaohsiung-city": {"name": "高雄市", "region": "南部"},
}
MARKET_SOURCE_IDS = {"taipei-1": "109", "taichung-city": "400", "kaohsiung-city": "800"}
ROLES = ("consumer", "farmer", "merchant")
ROLE_LABELS = {"consumer": "消費者", "farmer": "農民", "merchant": "商家"}
PROJECT_ROOT = Path(__file__).resolve().parents[2]


class DailyRecommendationValidationError(ValueError):
    pass


def taipei_today() -> date:
    return datetime.now(TAIPEI_TZ).date()


def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"日期必須為 YYYY-MM-DD：{value!r}") from exc


def _json_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (datetime, date, pd.Timestamp)):
        return value.isoformat()
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if hasattr(value, "item"):
        return _json_value(value.item())
    return value


def _percent_change(current: Any, previous: Any) -> float | None:
    try:
        current_value = float(current)
        previous_value = float(previous)
    except (TypeError, ValueError):
        return None
    if previous_value == 0:
        return None
    return round((current_value - previous_value) / previous_value * 100, 2)


def _api_base_url() -> str | None:
    configured = os.getenv("SMARTBUY_API_URL") or os.getenv("VITE_API_URL")
    if configured:
        return configured.rstrip("/")
    production_env = PROJECT_ROOT / "frontend" / ".env.production"
    if not production_env.exists():
        return None
    for line in production_env.read_text(encoding="utf-8").splitlines():
        if line.startswith("VITE_API_URL="):
            return line.split("=", 1)[1].strip().rstrip("/") or None
    return None


def _read_api_json(path: str, params: dict[str, Any] | None = None) -> Any:
    base_url = _api_base_url()
    if not base_url:
        raise RuntimeError("SmartBuy API URL is not configured.")
    query = f"?{urlencode(params)}" if params else ""
    request = Request(f"{base_url}{path}{query}", headers={"Accept": "application/json"})
    with urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def trade_data_age_days(recommendation_date: date, latest_trade_date: str | None) -> int | None:
    if not latest_trade_date:
        return None
    return max((recommendation_date - parse_date(latest_trade_date)).days, 0)


def trade_data_warning(age_days: int | None) -> str | None:
    if age_days is None:
        return "未取得行情交易日期。"
    if age_days > 7:
        return "行情資料尚未更新，建議僅供參考"
    if age_days >= 4:
        return "行情資料較舊"
    return None


def _empty_source(source: str, source_type: str, source_location: str, error: str | None = None) -> dict[str, Any]:
    return {
        "status": "unavailable", "source": source, "source_type": source_type,
        "source_location": source_location, "error": error,
        "date_range": {"start": None, "end": None}, "row_count": 0,
        "product_count": 0, "products": [],
    }


def _price_frame_to_input(
    frame: pd.DataFrame,
    *,
    source: str,
    source_type: str,
    source_location: str,
    recommendation_date: date,
    error: str | None = None,
) -> dict[str, Any]:
    frame = frame.copy()
    if frame.empty:
        return _empty_source(source, source_type, source_location, error)
    frame["trans_date"] = pd.to_datetime(frame["trans_date"], errors="coerce")
    frame = frame[frame["trans_date"].dt.date <= recommendation_date]
    frame = frame[frame["crop_name"].fillna("").astype(str).str.strip().ne("休市")]
    frame = frame.dropna(subset=["trans_date", "crop_name"])
    if frame.empty:
        return _empty_source(source, source_type, source_location, error)
    products = []
    for crop_name, crop_rows in frame.groupby("crop_name", sort=True):
        crop_rows = crop_rows.sort_values("trans_date", ascending=False)
        latest = crop_rows.iloc[0]
        previous = crop_rows.iloc[1] if len(crop_rows) > 1 else None
        products.append({
            "crop_code": _json_value(latest.get("crop_code")),
            "crop_name": crop_name,
            "market_code": _json_value(latest.get("market_code")),
            "latest_trade_date": latest["trans_date"].date().isoformat(),
            "avg_price": _json_value(latest.get("avg_price", latest.get("today_price"))),
            "volume": _json_value(latest.get("volume")),
            "previous_trade_date": previous["trans_date"].date().isoformat() if previous is not None else None,
            "previous_avg_price": _json_value(previous.get("avg_price")) if previous is not None else None,
            "previous_volume": _json_value(previous.get("volume")) if previous is not None else None,
            "price_change_pct": _percent_change(latest.get("avg_price", latest.get("today_price")), previous.get("avg_price")) if previous is not None else None,
            "volume_change_pct": _percent_change(latest.get("volume"), previous.get("volume")) if previous is not None else None,
        })
    dates = sorted(item["latest_trade_date"] for item in products)
    return {
        "status": "available", "source": source, "source_type": source_type,
        "source_location": source_location, "error": error,
        "date_range": {"start": frame["trans_date"].min().date().isoformat(), "end": frame["trans_date"].max().date().isoformat()},
        "row_count": len(frame), "product_count": len(products), "products": products,
    }


def _prepare_supabase_price_input(market_name: str, recommendation_date: date) -> dict[str, Any]:
    engine = get_db_engine()
    if engine is None:
        raise RuntimeError("DATABASE_URL is not configured")
    query = text("""
        SELECT trans_date, crop_code, crop_name, market_code, market_name,
               avg_price, volume
        FROM public.agri_price_daily
        WHERE market_name = :market_name AND trans_date <= :recommendation_date
        ORDER BY trans_date DESC, crop_name ASC
    """)
    frame = pd.read_sql(query, engine, params={"market_name": market_name, "recommendation_date": recommendation_date})
    return _price_frame_to_input(frame, source="Supabase public.agri_price_daily", source_type="official-database", source_location="public.agri_price_daily", recommendation_date=recommendation_date)


def _prepare_api_price_input(market_name: str, recommendation_date: date) -> dict[str, Any]:
    rows = _read_api_json("/api/products", {"market": market_name})
    filtered = [
        row for row in rows
        if row.get("market_name") == market_name
        and row.get("trans_date")
        and parse_date(str(row["trans_date"])[:10]) <= recommendation_date
    ]
    if not filtered:
        raise RuntimeError(f"SmartBuy API has no price rows for {market_name}.")
    frame = pd.DataFrame([{
        "crop_code": row.get("crop_code"), "crop_name": row.get("product_name"),
        "market_code": row.get("market_code"), "trans_date": str(row["trans_date"])[:10],
        "avg_price": row.get("today_price"), "volume": row.get("volume"),
    } for row in filtered])
    return _price_frame_to_input(frame, source="Render API /api/products", source_type="api-secondary", source_location=f"/api/products?market={market_name}", recommendation_date=recommendation_date)


def _prepare_local_price_input(market_name: str, recommendation_date: date) -> dict[str, Any]:
    frame = load_market_prices()
    frame = frame[frame["market_name"] == market_name].rename(columns={"product_name": "crop_name"})
    return _price_frame_to_input(frame, source="本機 data/processed/market_prices.csv", source_type="local-csv-fallback", source_location="data/processed/market_prices.csv", recommendation_date=recommendation_date)


def _prepare_price_input(market_name: str, recommendation_date: date) -> dict[str, Any]:
    attempts = []
    labels = [
        ("Supabase public.agri_price_daily", "official-database", "public.agri_price_daily"),
        ("Render API /api/products", "api-secondary", f"/api/products?market={market_name}"),
        ("本機 data/processed/market_prices.csv", "local-csv-fallback", "data/processed/market_prices.csv"),
    ]
    for index, loader in enumerate((
        lambda: _prepare_supabase_price_input(market_name, recommendation_date),
        lambda: _prepare_api_price_input(market_name, recommendation_date),
        lambda: _prepare_local_price_input(market_name, recommendation_date),
    )):
        try:
            candidate = loader()
            attempts.append(candidate)
        except Exception as exc:
            source, source_type, location = labels[index]
            attempts.append(_empty_source(source, source_type, location, type(exc).__name__))
    selected = next((item for item in attempts if item["status"] == "available"), attempts[-1])
    selected["source_comparison"] = [
        {"source": item.get("source"), "status": item.get("status"), "date_range": item.get("date_range"), "row_count": item.get("row_count", 0), "product_count": item.get("product_count", 0), "error": item.get("error")}
        for item in attempts
    ]
    return selected


def _prediction_item(row: dict[str, Any]) -> dict[str, Any]:
    target = row.get("prediction_target")
    target_date = str(target)[:10] if isinstance(target, str) and len(target) >= 10 and target[4:5] == "-" else None
    return {
        "market": row.get("market_name"),
        "market_id": str(row.get("market_id")) if row.get("market_id") is not None else None,
        "product": row.get("crop_name"),
        "product_id": str(row.get("crop_id")) if row.get("crop_id") is not None else None,
        "prediction_base_date": str(row.get("base_date"))[:10],
        "prediction_target": target,
        "prediction_target_date": target_date,
        "predicted_direction": row.get("pred_label_name"),
        "probability": {
            "down": _json_value(row.get("prob_down")),
            "flat": _json_value(row.get("prob_flat")),
            "up": _json_value(row.get("prob_up")),
        },
        "confidence": _json_value(row.get("pred_confidence")),
        "confidence_level": row.get("confidence_level"),
        "model": row.get("model_type"),
        "source": "public.price_direction_predictions",
    }


def _prediction_input_from_rows(rows: list[dict[str, Any]], market_name: str, market_id: str, recommendation_date: date, source: str, source_type: str, source_location: str) -> dict[str, Any]:
    exact_rows = [
        row for row in rows
        if row.get("market_name") == market_name
        and row.get("base_date")
        and pd.to_datetime(row["base_date"]).date() <= recommendation_date
    ]
    latest_by_product: dict[str, dict[str, Any]] = {}
    for row in exact_rows:
        product_id = str(row.get("crop_id") or row.get("crop_name"))
        current = latest_by_product.get(product_id)
        if current is None or str(row["base_date"]) > str(current["base_date"]):
            latest_by_product[product_id] = row
    items = [_prediction_item(row) for row in latest_by_product.values()]
    items.sort(key=lambda item: (item["product"] or "", item["prediction_base_date"]))
    dates = sorted(item["prediction_base_date"] for item in items)
    return {
        "status": "available" if items else "unavailable", "source": source, "source_type": source_type,
        "source_location": source_location, "market_id": market_id, "raw_row_count": len(exact_rows),
        "prediction_count": len(items), "date_range": {"start": dates[0] if dates else None, "end": dates[-1] if dates else None}, "items": items,
    }


def _local_prediction_input(market_name: str, market_id: str, recommendation_date: date) -> dict[str, Any]:
    frame = pd.read_csv(PROJECT_ROOT / "data/processed/prediction_results.csv")
    frame = frame[(frame["market_name"] == market_name) & (pd.to_datetime(frame["predict_date"]).dt.date <= recommendation_date)]
    rows = [{
        "market_name": row.market_name, "market_id": str(row.market_code), "crop_name": row.crop_name, "crop_id": str(row.crop_code),
        "base_date": str(row.predict_date), "prediction_target": None, "pred_label_name": row.predicted_status,
        "prob_down": None, "prob_flat": None, "prob_up": None, "pred_confidence": None, "confidence_level": "低", "model_type": "local-csv",
    } for row in frame.itertuples()]
    return _prediction_input_from_rows(rows, market_name, market_id, recommendation_date, "本機 data/processed/prediction_results.csv", "local-csv-fallback", "data/processed/prediction_results.csv")


def _prepare_prediction_input(market_key: str, market_name: str, recommendation_date: date) -> dict[str, Any]:
    market_id = MARKET_SOURCE_IDS[market_key]
    attempts = []
    loaders = [
        lambda: _prediction_input_from_rows(query_prediction_list(market_id=market_id, limit=5000, max_staleness_days=3650), market_name, market_id, recommendation_date, "Supabase public.price_direction_predictions", "official-database", "public.price_direction_predictions"),
        lambda: _prediction_input_from_rows(_read_api_json("/api/predictions/direction", {"market_id": market_id, "limit": 500}), market_name, market_id, recommendation_date, "Render API /api/predictions/direction", "api-secondary", f"/api/predictions/direction?market_id={market_id}&limit=500"),
        lambda: _local_prediction_input(market_name, market_id, recommendation_date),
    ]
    for loader in loaders:
        try:
            attempts.append(loader())
        except Exception as exc:
            attempts.append({"status": "unavailable", "source": "source not read", "error": type(exc).__name__, "date_range": {"start": None, "end": None}, "raw_row_count": 0, "prediction_count": 0})
    selected = next((item for item in attempts if item["status"] == "available"), attempts[-1])
    selected["source_comparison"] = [{"source": item.get("source"), "status": item.get("status"), "date_range": item.get("date_range"), "row_count": item.get("raw_row_count", 0), "prediction_count": item.get("prediction_count", 0), "error": item.get("error")} for item in attempts]
    return selected


def _news_input_from_rows(rows: list[dict[str, Any]], recommendation_date: date, source: str, source_type: str, source_location: str) -> dict[str, Any]:
    start_date = recommendation_date - timedelta(days=6)
    requested = {"start": start_date.isoformat(), "end": recommendation_date.isoformat()}
    filtered = []
    for row in rows:
        if not row.get("published_date"):
            continue
        published = pd.to_datetime(row["published_date"]).date()
        if start_date <= published <= recommendation_date:
            content = str(row.get("content_text") or "").strip()
            filtered.append({
                "title": row.get("title"),
                "published_at": str(row["published_date"])[:10],
                "summary": content[:1200],
                "source": row.get("source_name"),
                "source_url": row.get("source_url"),
                "content": content,
            })
    dates = [item["published_at"] for item in filtered]
    return {
        "status": "available" if filtered else "unavailable",
        "source": source,
        "source_type": source_type,
        "source_location": source_location,
        "requested_date_range": requested,
        "actual_date_range": {"start": min(dates) if dates else None, "end": max(dates) if dates else None},
        "news_count": len(filtered),
        "items": filtered,
    }


def _prepare_news_input(recommendation_date: date) -> dict[str, Any]:
    attempts = []
    loaders = [
        lambda: _news_input_from_rows(query_agri_news(limit=500), recommendation_date, "Supabase public.agri_news_articles", "official-database", "public.agri_news_articles"),
        lambda: _news_input_from_rows((_read_api_json("/api/news", {"limit": 100}) or {}).get("articles", []), recommendation_date, "Render API /api/news", "api-secondary", "/api/news?limit=100"),
        lambda: {"status": "unavailable", "source": "本機 CSV（無新知資料檔）", "source_type": "local-csv-fallback", "source_location": "data/processed/（無 agri_news_articles CSV）", "actual_date_range": {"start": None, "end": None}, "news_count": 0, "items": []},
    ]
    for loader in loaders:
        try:
            attempts.append(loader())
        except Exception as exc:
            attempts.append({"status": "unavailable", "source": "source not read", "error": type(exc).__name__, "actual_date_range": {"start": None, "end": None}, "news_count": 0, "items": []})
    candidate = next((item for item in attempts if item["status"] == "available"), attempts[-1] if attempts else {"status": "unavailable", "news_count": 0, "items": []})
    candidate.update({"requested_date_range": {"start": (recommendation_date - timedelta(days=6)).isoformat(), "end": recommendation_date.isoformat()}, "source_comparison": [{"source": item.get("source"), "status": item.get("status"), "date_range": item.get("actual_date_range"), "row_count": item.get("news_count", 0), "error": item.get("error")} for item in attempts]})
    return candidate


def prepare_market_input(market_key: str, recommendation_date: date) -> dict[str, Any]:
    market = MARKETS[market_key]
    prices = _prepare_price_input(market["name"], recommendation_date)
    predictions = _prepare_prediction_input(market_key, market["name"], recommendation_date)
    news = _prepare_news_input(recommendation_date)
    latest_trade_date = prices["date_range"]["end"]
    age_days = trade_data_age_days(recommendation_date, latest_trade_date)
    missing_sources = []
    source_warnings = []
    if prices["status"] != "available":
        missing_sources.append("market_prices")
    if predictions["status"] != "available":
        missing_sources.append("price_direction_predictions")
    if news["status"] != "available":
        missing_sources.append("recent_agriculture_news")
    freshness_warning = trade_data_warning(age_days)
    if freshness_warning:
        source_warnings.append(freshness_warning)
    if predictions["status"] == "available" and not any(item.get("prediction_target_date") for item in predictions["items"]):
        source_warnings.append("價格方向預測只提供下一個交易日，來源未提供實際預測目標日期。")
    source_warnings.extend(
        warning for warning in (
            "未取得價格方向預測。" if predictions["status"] != "available" else None,
            "未取得最近 7 日農業新知。" if news["status"] != "available" else None,
        ) if warning
    )
    return {
        "schema_version": SCHEMA_VERSION,
        "recommendation_date": recommendation_date.isoformat(),
        "market": {"key": market_key, **market},
        "prices": prices,
        "price_predictions": predictions,
        "agriculture_news": news,
        "source_summary": {
            "latest_trade_date": latest_trade_date,
            "trade_data_age_days": age_days,
            "prediction_target_date": next((item.get("prediction_target_date") for item in predictions.get("items", []) if item.get("prediction_target_date")), None),
            "news_start_date": news.get("actual_date_range", {}).get("start"),
            "news_end_date": news.get("actual_date_range", {}).get("end"),
            "product_count": prices.get("product_count", 0),
            "includes_price_prediction": predictions["status"] == "available",
            "includes_recent_news": news["status"] == "available",
            "missing_sources": missing_sources,
            "source_warnings": source_warnings,
            "source_comparison": {
                "prices": prices.get("source_comparison", []),
                "price_direction_predictions": predictions.get("source_comparison", []),
                "agriculture_news": news.get("source_comparison", []),
            },
        },
    }


def build_chatgpt_prompt(inputs: dict[str, dict[str, Any]]) -> str:
    combined_inputs = json.dumps(inputs, ensure_ascii=False, indent=2)
    return f"""# SmartBuy 每日 AI 推薦快照

請只根據下方輸入資料，回傳一個可解析的 JSON 物件，不要加 Markdown 或解說。
不得捏造不存在的價格、交易量、預測、新知或日期；來源沒有資料時，必須在文字中明確說明限制。
下方「每日整理輸入」包含完整的價格、交易量、日期、價格方向預測、農業新知與資料來源比較；請先使用完整資料判讀，再輸出精簡的決策型 JSON。不要把所有原始資料逐項重複到決策內容。

## 固定規則

- schema_version 必須是 {SCHEMA_VERSION}
- markets 必須完整包含 taipei-1、taichung-city、kaohsiung-city
- 每個市場必須包含 consumer、farmer、merchant，且三者內容不可相同
- 每個角色必須依照該角色的實際任務產生不同內容，不得只替換角色名稱
- generated_at 使用含時區 ISO 8601，時區使用 Asia/Taipei
- generator 固定為 {{"type":"manual-chatgpt","api_called":false}}
- latest_trade_date 取該市場 prices.date_range.end，不得改成系統日期
- trade_data_age_days 必須原樣使用輸入 source_summary.trade_data_age_days
- prediction_target_date 僅能取 price_predictions.items 的 prediction_target_date；來源只有 next_trade_day 時填 null
- news_start_date 與 news_end_date 取 agriculture_news.actual_date_range；沒有時填 null
- includes_price_prediction、includes_recent_news、missing_sources、source_warnings 必須原樣使用輸入 source_summary
- source_warnings 必須在 UI 可見；決策中的 watch 只需說明它對該角色的影響，不要複製成長篇警告
- source_summary 的日期、數字、布林值、缺漏與警告不得自行修改
- 每個決策陣列只保留最重要的 1 至 3 項；do 可有 2 至 4 個步驟
- 所有決策文字使用繁體中文；next_trade_day 在可讀文字中寫成「下一個交易日」

## 三種角色的內容規則

- consumer（消費者）：primary.label 固定為「優先採買」，回答適合買的品項、替代品、預算與家庭採買；不得產生農民生產或商家庫存指令。
- farmer（農民）：primary.label 固定為「優先採收／出貨」，回答可觀察的品項、供需、交易量、出貨與價格風險；不得假設輸入未提供的天氣或種植資訊。
- merchant（商家）：primary.label 固定為「優先進貨／銷售」，回答進貨量、庫存、促銷、售價與替代品策略；不得把消費者家庭採買建議直接複製過來。

## 輸出結構

{{
  "schema_version": 2,
  "recommendation_date": "YYYY-MM-DD",
  "generated_at": "ISO-8601 with timezone",
  "generator": {{"type": "manual-chatgpt", "api_called": false}},
  "markets": {{
    "taipei-1": {{
      "schema_version": 1,
      "recommendation_date": "YYYY-MM-DD",
      "generated_at": "ISO-8601 with timezone",
      "generator": {{"type": "manual-chatgpt", "api_called": false}},
      "market": {{"key": "taipei-1", "name": "台北一", "region": "北部"}},
      "source_summary": {{"latest_trade_date": "YYYY-MM-DD", "trade_data_age_days": 0, "prediction_target_date": null, "news_start_date": null, "news_end_date": null, "product_count": 0, "includes_price_prediction": false, "includes_recent_news": false, "missing_sources": [], "source_warnings": []}},
      "market_summary": {{"headline": "一句市場結論", "overview": "供查看完整依據的市場分析", "key_signals": ["最多三個主要訊號"]}},
      "recommendations": {{
        "consumer": {{
          "role": "consumer", "role_label": "消費者", "headline": "30 字內的一句角色結論",
          "decision": {{
            "primary": {{"label": "優先採買", "items": ["品項一", "品項二"], "reason": "一句資料依據"}},
            "watch": ["消費者需要注意的風險"],
            "know": ["消費者一定要知道的資料限制或市場訊號"],
            "do": ["現在要做的步驟一", "現在要做的步驟二"],
            "evidence": ["可回查的價格、交易量、預測或新知依據"]
          }}
        }},
        "farmer": {{
          "role": "farmer", "role_label": "農民", "headline": "30 字內的一句角色結論",
          "decision": {{
            "primary": {{"label": "優先採收／出貨", "items": ["品項一", "品項二"], "reason": "一句資料依據"}},
            "watch": ["農民需要注意的供需或價格風險"],
            "know": ["農民一定要知道的資料限制或市場訊號"],
            "do": ["現在要做的步驟一", "現在要做的步驟二"],
            "evidence": ["可回查的價格、交易量、預測或新知依據"]
          }}
        }},
        "merchant": {{
          "role": "merchant", "role_label": "商家", "headline": "30 字內的一句角色結論",
          "decision": {{
            "primary": {{"label": "優先進貨／銷售", "items": ["品項一", "品項二"], "reason": "一句資料依據"}},
            "watch": ["商家需要注意的庫存、售價或需求風險"],
            "know": ["商家一定要知道的資料限制或市場訊號"],
            "do": ["現在要做的步驟一", "現在要做的步驟二"],
            "evidence": ["可回查的價格、交易量、預測或新知依據"]
          }}
        }}
      }}
    }}
  }}
}}

其餘兩個市場使用相同欄位結構，market 欄位必須依輸入值填寫。不要輸出舊版的 summary、actions、risks 欄位；UI 的四個決策區塊只讀取 decision。

## 每日整理輸入

{combined_inputs}
"""


def prepare_daily_inputs(recommendation_date: date, output_root: Path) -> Path:
    target_dir = output_root / recommendation_date.isoformat()
    target_dir.mkdir(parents=True, exist_ok=True)
    inputs = {key: prepare_market_input(key, recommendation_date) for key in MARKETS}
    for market_key, payload in inputs.items():
        (target_dir / f"{market_key}-input.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    (target_dir / "chatgpt-prompt.md").write_text(build_chatgpt_prompt(inputs), encoding="utf-8")
    return target_dir


def _require_string(value: Any, field: str, errors: list[str]) -> None:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{field} 必須是非空字串")


def _validate_datetime(value: Any, field: str, errors: list[str]) -> None:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError
    except (TypeError, ValueError):
        errors.append(f"{field} 必須是含時區的 ISO 8601 時間")


def _require_string_list(
    value: Any,
    field: str,
    errors: list[str],
    *,
    minimum: int = 1,
    maximum: int | None = None,
) -> None:
    valid = isinstance(value, list) and minimum <= len(value) and (maximum is None or len(value) <= maximum)
    valid = valid and all(isinstance(item, str) and item.strip() for item in value)
    if not valid:
        range_text = f"{minimum} 至 {maximum} 個" if maximum is not None else f"至少 {minimum} 個"
        errors.append(f"{field} 必須包含 {range_text}非空字串")


def normalize_daily_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Repair only a safe nested schema marker mismatch from ChatGPT output.

    ChatGPT occasionally keeps the market-document marker at v1 while returning
    the complete v2 role decision object. Never rewrite the caller's payload;
    normalize a copy and let the normal validator enforce every other rule.
    """
    normalized = copy.deepcopy(payload)
    if normalized.get("schema_version") != SCHEMA_VERSION:
        return normalized
    markets = normalized.get("markets")
    if not isinstance(markets, dict):
        return normalized
    for document in markets.values():
        recommendations = document.get("recommendations") if isinstance(document, dict) else None
        has_v2_decisions = isinstance(recommendations, dict) and set(recommendations) == set(ROLES) and all(
            isinstance(recommendations[role], dict) and isinstance(recommendations[role].get("decision"), dict)
            for role in ROLES
        )
        if isinstance(document, dict) and document.get("schema_version") == LEGACY_SCHEMA_VERSION and has_v2_decisions:
            document["schema_version"] = SCHEMA_VERSION
    return normalized


def validate_daily_payload(payload: dict[str, Any], expected_date: date) -> dict[str, dict[str, Any]]:
    errors: list[str] = []
    expected_date_text = expected_date.isoformat()
    schema_version = payload.get("schema_version")
    if schema_version not in SUPPORTED_SCHEMA_VERSIONS:
        errors.append(f"schema_version 必須是 {SCHEMA_VERSION}，或相容舊版 {LEGACY_SCHEMA_VERSION}")
        schema_version = SCHEMA_VERSION
    if payload.get("recommendation_date") != expected_date_text:
        errors.append("recommendation_date 與 --date 不一致")
    _validate_datetime(payload.get("generated_at"), "generated_at", errors)
    generator = payload.get("generator")
    if generator != {"type": "manual-chatgpt", "api_called": False}:
        errors.append("generator 必須是 manual-chatgpt 且 api_called=false")
    markets = payload.get("markets")
    if not isinstance(markets, dict) or set(markets) != set(MARKETS):
        errors.append("markets 必須完整且只包含三個指定市場")
        markets = markets if isinstance(markets, dict) else {}

    for market_key, expected_market in MARKETS.items():
        document = markets.get(market_key)
        prefix = f"markets.{market_key}"
        if not isinstance(document, dict):
            errors.append(f"{prefix} 必須存在")
            continue
        if document.get("schema_version") != schema_version:
            errors.append(f"{prefix}.schema_version 必須與根節點一致")
        if document.get("recommendation_date") != expected_date_text:
            errors.append(f"{prefix}.recommendation_date 不一致")
        _validate_datetime(document.get("generated_at"), f"{prefix}.generated_at", errors)
        if document.get("generator") != generator:
            errors.append(f"{prefix}.generator 必須與根節點一致")
        if document.get("market") != {"key": market_key, **expected_market}:
            errors.append(f"{prefix}.market 名稱、區域或識別碼不正確")

        source = document.get("source_summary")
        if not isinstance(source, dict):
            errors.append(f"{prefix}.source_summary 必須存在")
        else:
            if source.get("latest_trade_date") is not None:
                _require_string(source.get("latest_trade_date"), f"{prefix}.source_summary.latest_trade_date", errors)
            for field in ("latest_trade_date", "prediction_target_date", "news_start_date", "news_end_date"):
                if source.get(field) is not None:
                    try:
                        parse_date(source[field])
                    except ValueError as exc:
                        errors.append(str(exc))
            if not isinstance(source.get("product_count"), int) or source["product_count"] < 0:
                errors.append(f"{prefix}.source_summary.product_count 必須是非負整數")
            if source.get("includes_price_prediction") is not None and not isinstance(source.get("includes_price_prediction"), bool):
                errors.append(f"{prefix}.source_summary.includes_price_prediction 必須是布林值")
            if source.get("includes_recent_news") is not None and not isinstance(source.get("includes_recent_news"), bool):
                errors.append(f"{prefix}.source_summary.includes_recent_news 必須是布林值")
            expected_age = trade_data_age_days(expected_date, source.get("latest_trade_date"))
            if source.get("trade_data_age_days") is not None and source.get("trade_data_age_days") != expected_age:
                errors.append(f"{prefix}.source_summary.trade_data_age_days 與日期計算不一致")
            for field in ("missing_sources", "source_warnings"):
                values = source.get(field)
                if values is not None and (not isinstance(values, list) or not all(isinstance(item, str) and item.strip() for item in values)):
                    errors.append(f"{prefix}.source_summary.{field} 必須是字串陣列")

        summary = document.get("market_summary")
        if not isinstance(summary, dict):
            errors.append(f"{prefix}.market_summary 必須存在")
        else:
            _require_string(summary.get("headline"), f"{prefix}.market_summary.headline", errors)
            _require_string(summary.get("overview"), f"{prefix}.market_summary.overview", errors)
            signals = summary.get("key_signals")
            if not isinstance(signals, list) or not signals or not all(isinstance(item, str) and item.strip() for item in signals):
                errors.append(f"{prefix}.market_summary.key_signals 必須是非空字串陣列")

        recommendations = document.get("recommendations")
        if not isinstance(recommendations, dict) or set(recommendations) != set(ROLES):
            errors.append(f"{prefix}.recommendations 必須完整且只包含三種身分")
            continue
        role_signatures = []
        for role in ROLES:
            content = recommendations.get(role)
            role_prefix = f"{prefix}.recommendations.{role}"
            if not isinstance(content, dict):
                errors.append(f"{role_prefix} 必須存在")
                continue
            _require_string(content.get("headline"), f"{role_prefix}.headline", errors)
            if schema_version == LEGACY_SCHEMA_VERSION:
                _require_string(content.get("summary"), f"{role_prefix}.summary", errors)
                actions = content.get("actions")
                if not isinstance(actions, list) or not 3 <= len(actions) <= 5 or not all(isinstance(item, str) and item.strip() for item in actions):
                    errors.append(f"{role_prefix}.actions 必須包含 3 至 5 個非空字串")
                risks = content.get("risks")
                if not isinstance(risks, list) or not risks or not all(isinstance(item, str) and item.strip() for item in risks):
                    errors.append(f"{role_prefix}.risks 必須是非空字串陣列")
                continue

            if content.get("role") != role:
                errors.append(f"{role_prefix}.role 必須是 {role}")
            if content.get("role_label") != ROLE_LABELS[role]:
                errors.append(f"{role_prefix}.role_label 必須是 {ROLE_LABELS[role]}")
            decision = content.get("decision")
            if not isinstance(decision, dict):
                errors.append(f"{role_prefix}.decision 必須存在")
                continue
            primary = decision.get("primary")
            if not isinstance(primary, dict):
                errors.append(f"{role_prefix}.decision.primary 必須存在")
            else:
                expected_primary_labels = {
                    "consumer": "優先採買",
                    "farmer": "優先採收／出貨",
                    "merchant": "優先進貨／銷售",
                }
                if primary.get("label") != expected_primary_labels[role]:
                    errors.append(f"{role_prefix}.decision.primary.label 不符合角色")
                _require_string_list(primary.get("items"), f"{role_prefix}.decision.primary.items", errors, maximum=3)
                _require_string(primary.get("reason"), f"{role_prefix}.decision.primary.reason", errors)
            _require_string_list(decision.get("watch"), f"{role_prefix}.decision.watch", errors, maximum=3)
            _require_string_list(decision.get("know"), f"{role_prefix}.decision.know", errors, maximum=3)
            _require_string_list(decision.get("do"), f"{role_prefix}.decision.do", errors, minimum=2, maximum=4)
            _require_string_list(decision.get("evidence"), f"{role_prefix}.decision.evidence", errors, maximum=4)
            role_signatures.append(json.dumps(decision, ensure_ascii=False, sort_keys=True))
        if schema_version == SCHEMA_VERSION and len(role_signatures) == len(ROLES) and len(set(role_signatures)) != len(ROLES):
            errors.append(f"{prefix}.recommendations 三種角色的 decision 不可完全相同")

    if errors:
        raise DailyRecommendationValidationError("\n".join(f"- {error}" for error in errors))
    return markets


def publish_daily_payload(
    payload: dict[str, Any],
    expected_date: date,
    public_root: Path,
    release_dir_name: str | None = None,
) -> list[Path]:
    normalized_payload = normalize_daily_payload(payload)
    markets = validate_daily_payload(normalized_payload, expected_date)
    date_dir = public_root / (release_dir_name or expected_date.isoformat())
    date_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for market_key, document in markets.items():
        target = date_dir / f"{market_key}.json"
        temporary = target.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(target)
        written.append(target)

    latest = {
        "schema_version": payload["schema_version"],
        "recommendation_date": expected_date.isoformat(),
        "generated_at": normalized_payload["generated_at"],
        "markets": {key: f"{date_dir.name}/{key}.json" for key in MARKETS},
        "release_dir": date_dir.name,
    }
    latest_path = public_root / "latest.json"
    latest_path.parent.mkdir(parents=True, exist_ok=True)
    latest_tmp = latest_path.with_suffix(".json.tmp")
    latest_tmp.write_text(json.dumps(latest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    latest_tmp.replace(latest_path)
    written.append(latest_path)
    return written
