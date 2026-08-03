from __future__ import annotations

import copy
import json
from datetime import date

import pytest

from src.recommendation.daily_snapshot import (
    DailyRecommendationValidationError,
    MARKETS,
    SCHEMA_VERSION,
    build_chatgpt_prompt,
    normalize_daily_payload,
    publish_daily_payload,
    trade_data_age_days,
    trade_data_warning,
    _prepare_price_input,
    validate_daily_payload,
)


@pytest.mark.parametrize(
    ("latest", "expected_age", "warning"),
    [("2026-07-31", 0, None), ("2026-07-27", 4, "行情資料較舊"), ("2026-07-23", 8, "行情資料尚未更新，建議僅供參考")],
)
def test_trade_data_freshness_boundaries(latest, expected_age, warning):
    age = trade_data_age_days(date(2026, 7, 31), latest)
    assert age == expected_age
    assert trade_data_warning(age) == warning


def test_price_sources_are_compared_and_selected_in_priority_order(monkeypatch):
    unavailable = {"status": "unavailable", "date_range": {"start": None, "end": None}, "row_count": 0, "product_count": 0}
    api = {"status": "available", "source": "api", "date_range": {"start": "2026-07-31", "end": "2026-07-31"}, "row_count": 2, "product_count": 2}
    local = {"status": "available", "source": "csv", "date_range": {"start": "2026-07-23", "end": "2026-07-23"}, "row_count": 3, "product_count": 3}
    monkeypatch.setattr("src.recommendation.daily_snapshot._prepare_supabase_price_input", lambda *_: unavailable)
    monkeypatch.setattr("src.recommendation.daily_snapshot._prepare_api_price_input", lambda *_: api)
    monkeypatch.setattr("src.recommendation.daily_snapshot._prepare_local_price_input", lambda *_: local)
    result = _prepare_price_input("台北一", date(2026, 7, 31))
    assert result["source"] == "api"
    assert [item["status"] for item in result["source_comparison"]] == ["unavailable", "available", "available"]


def valid_payload() -> dict:
    generated_at = "2026-07-31T08:15:00+08:00"
    payload = {
        "schema_version": SCHEMA_VERSION,
        "recommendation_date": "2026-07-31",
        "generated_at": generated_at,
        "generator": {"type": "manual-chatgpt", "api_called": False},
        "markets": {},
    }
    for key, market in MARKETS.items():
        payload["markets"][key] = {
            "schema_version": SCHEMA_VERSION,
            "recommendation_date": "2026-07-31",
            "generated_at": generated_at,
            "generator": payload["generator"],
            "market": {"key": key, **market},
            "source_summary": {
                "latest_trade_date": "2026-07-29",
                "trade_data_age_days": 2,
                "prediction_target_date": None,
                "news_start_date": None,
                "news_end_date": None,
                "product_count": 12,
                "includes_price_prediction": False,
                "includes_recent_news": False,
                "missing_sources": [],
                "source_warnings": [],
            },
            "market_summary": {
                "headline": f"{market['name']}市場結論",
                "overview": "依實際行情資料整理，未取得的來源不納入判斷。",
                "key_signals": ["最新交易日為 2026-07-29"],
            },
            "recommendations": {
                role: {
                    "role": role,
                    "role_label": {"consumer": "消費者", "farmer": "農民", "merchant": "商家"}[role],
                    "headline": f"{role} 建議",
                    "decision": {
                        "primary": {
                            "label": {"consumer": "優先採買", "farmer": "優先採收／出貨", "merchant": "優先進貨／銷售"}[role],
                            "items": [f"{role}品項"],
                            "reason": "依最新行情資料判斷。",
                        },
                        "watch": ["最新資料不是今日交易資料"],
                        "know": ["目前僅能依現有行情判斷。"],
                        "do": ["先確認需求", "分批執行"],
                        "evidence": ["最新交易日為 2026-07-29"],
                    },
                }
                for role in ("consumer", "farmer", "merchant")
            },
        }
    return payload


def test_validate_daily_payload_accepts_complete_three_market_contract():
    markets = validate_daily_payload(valid_payload(), date(2026, 7, 31))
    assert set(markets) == set(MARKETS)


def test_prompt_passes_detailed_inputs_and_requires_role_specific_decisions():
    prompt = build_chatgpt_prompt({"taipei-1": {"prices": {"products": [{"crop_name": "高麗菜", "avg_price": 20}]}, "price_predictions": {}, "agriculture_news": {}}})
    assert '完整的價格、交易量、日期、價格方向預測、農業新知' in prompt
    assert 'consumer（消費者）' in prompt
    assert 'farmer（農民）' in prompt
    assert 'merchant（商家）' in prompt
    assert '不要輸出舊版的 summary、actions、risks 欄位' in prompt
    assert '"decision"' in prompt


def test_validate_legacy_schema_remains_supported():
    payload = valid_payload()
    payload["schema_version"] = 1
    for document in payload["markets"].values():
        document["schema_version"] = 1
        for role, content in document["recommendations"].items():
            content.pop("role")
            content.pop("role_label")
            decision = content.pop("decision")
            content["summary"] = decision["primary"]["reason"]
            content["actions"] = decision["do"] + ["比較替代選擇"]
            content["risks"] = decision["watch"]
    markets = validate_daily_payload(payload, date(2026, 7, 31))
    assert set(markets) == set(MARKETS)


def test_normalize_repairs_only_nested_v2_marker_without_mutating_input():
    payload = valid_payload()
    for document in payload["markets"].values():
        document["schema_version"] = 1
    normalized = normalize_daily_payload(payload)
    assert all(document["schema_version"] == 1 for document in payload["markets"].values())
    assert all(document["schema_version"] == SCHEMA_VERSION for document in normalized["markets"].values())
    assert set(validate_daily_payload(normalized, date(2026, 7, 31))) == set(MARKETS)


def test_publish_rejects_invalid_schema_without_updating_latest(tmp_path):
    payload = copy.deepcopy(valid_payload())
    payload["markets"]["taipei-1"]["recommendations"]["consumer"]["decision"]["primary"]["items"] = []
    with pytest.raises(DailyRecommendationValidationError):
        publish_daily_payload(payload, date(2026, 7, 31), tmp_path)
    assert not (tmp_path / "latest.json").exists()


def test_publish_writes_market_documents_before_latest_pointer(tmp_path):
    written = publish_daily_payload(valid_payload(), date(2026, 7, 31), tmp_path)
    assert written[-1] == tmp_path / "latest.json"
    assert (tmp_path / "2026-07-31" / "taipei-1.json").exists()


def test_publish_can_write_a_versioned_release_without_replacing_old_snapshot(tmp_path):
    publish_daily_payload(valid_payload(), date(2026, 7, 31), tmp_path, "2026-07-31-chatgpt-2026-08-03")
    assert (tmp_path / "2026-07-31-chatgpt-2026-08-03" / "taipei-1.json").exists()
    assert json.loads((tmp_path / "latest.json").read_text(encoding="utf-8"))["release_dir"] == "2026-07-31-chatgpt-2026-08-03"
