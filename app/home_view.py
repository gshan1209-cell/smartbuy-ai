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
from __future__ import annotations

import streamlit as st

from app.common import demo_notice
from app.components.alert_card import render_alert_card
from app.components.price_card import render_price_card
from app.components.solar_term_card import render_solar_term_card
from src.calendar.solar_terms import get_today_solar_term_advice
from src.recommendation.purchase_advisor import get_bargain_recommendations
from src.weather.origin_weather_risk import get_origin_weather_risk
from src.weather.typhoon_alert import get_typhoon_alert


def render_home() -> None:
    st.title("🛒 SmartBuy AI｜便宜買 AI")
    st.subheader("今天菜價幫你看好了")
    demo_notice()

    render_solar_term_card(get_today_solar_term_advice())

    typhoon = get_typhoon_alert()
    if typhoon["active"]:
        render_alert_card("颱風提醒", typhoon["message"], "很高")
    weather = get_origin_weather_risk("高麗菜")
    render_alert_card("產地天氣提醒", weather["message"], weather["risk_level"])

    st.header("今日採買參考")
    cols = st.columns(2)
    for index, item in enumerate(get_bargain_recommendations()):
        with cols[index % 2]:
            render_price_card(item)

    st.info("要查特定品項，請從左側選單進入「Price Search」。")

