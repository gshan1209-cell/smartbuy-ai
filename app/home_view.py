"""
模組名稱: app.home_view
功能說明: 首頁視圖，負責呈現首頁的 UI 元件與排版。

【相關元件 (Related Components)】
- 依賴: app.common.demo_notice
- 依賴: app.components.alert_card.render_alert_card
- 依賴: app.components.price_card.render_price_card
- 依賴: app.components.solar_term_card.render_solar_term_card
- 依賴: src.calendar.solar_terms.get_today_solar_term_advice
- 依賴: src.recommendation.purchase_advisor.get_bargain_recommendations
- 依賴: src.weather.origin_weather_risk.get_origin_weather_risk
- 依賴: src.weather.typhoon_alert.get_typhoon_alert
"""
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from datetime import date, datetime
import pandas as pd
import streamlit as st

from app.common import demo_notice
from app.components.alert_card import render_alert_card
from app.components.price_card import render_price_card
from app.components.solar_term_card import render_solar_term_card
from src.calendar.solar_terms import get_today_solar_term_advice
from src.recommendation.purchase_advisor import get_bargain_recommendations
from src.weather.origin_weather_risk import get_origin_weather_risk
from src.weather.typhoon_alert import get_typhoon_alert
from src.data.price_repository import load_price_history


def render_home() -> None:
    st.title("🛒 SmartBuy AI｜便宜買 AI")
    st.subheader("今天菜價幫你看好了")

    # 1. 統一以 load_price_history(days=90) 作為首頁唯一行情資料來源
    history_df = load_price_history(days=90)
    source_name = history_df.attrs.get("source", "本機 CSV")

    # 2. 解析最新交易日期
    if history_df.empty:
        latest_date = "無"
    else:
        max_date = history_df["trans_date"].max()
        if isinstance(max_date, (date, datetime, pd.Timestamp)):
            latest_date = max_date.strftime("%Y-%m-%d")
        else:
            latest_date = str(max_date) if max_date is not None else "無"

    # 3. 顯示資料來源標示與提示
    if source_name == "Supabase":
        st.info(f"📊 資料來源：Supabase 線上資料庫 (最新資料日期：{latest_date})")
    else:
        st.warning(f"⚠️ 目前使用本機示範資料 (Supabase 離線) (最新資料日期：{latest_date})")
        demo_notice()

    render_solar_term_card(get_today_solar_term_advice())

    typhoon = get_typhoon_alert()
    if typhoon["active"]:
        render_alert_card("颱風提醒", typhoon["message"], "很高")
    weather = get_origin_weather_risk("高麗菜")
    render_alert_card("產地天氣提醒", weather["message"], weather["risk_level"])

    st.header("今日採買參考")
    
    # 4. 若 history_df 為空，顯示友善提示，並避免繼續呼叫 get_bargain_recommendations
    if history_df.empty:
        st.info("目前無可用行情資料")
    else:
        cols = st.columns(2)
        recommendations = get_bargain_recommendations(prices=history_df)
        for index, item in enumerate(recommendations):
            with cols[index % 2]:
                render_price_card(item)

    st.info("要查特定品項，請從左側選單進入「Price Search」。")

