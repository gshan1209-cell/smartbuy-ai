"""
模組名稱: app.pages.04_weather_alert
功能說明: 天氣警示頁面，處理颱風與極端天氣的防範提醒。

【相關元件 (Related Components)】
- 依賴: app.common.configure_page
- 依賴: app.common.demo_notice
- 依賴: app.components.alert_card.render_alert_card
- 依賴: src.data.data_loader.load_product_origins
- 依賴: src.weather.origin_weather_risk.get_origin_weather_risk
- 依賴: src.weather.typhoon_alert.get_typhoon_alert
"""
import streamlit as st

from app.common import configure_page, demo_notice
from app.components.alert_card import render_alert_card
from src.data.data_loader import load_product_origins
from src.weather.origin_weather_risk import get_origin_weather_risk
from src.weather.typhoon_alert import get_typhoon_alert


configure_page("產地天氣提醒")
st.title("🌧️ 產地天氣與天災提醒")
demo_notice()

typhoon = get_typhoon_alert()
render_alert_card("颱風狀況", typhoon["message"], "很高" if typhoon["active"] else "低")

products = load_product_origins()["product_name"].tolist()
product = st.selectbox("查看哪個品項的主要產地？", products)
risk = get_origin_weather_risk(product)
render_alert_card(f"{product}｜風險 {risk['risk_level']}", risk["message"], risk["risk_level"])
st.write("主要產地：" + "、".join(risk["origins"]))
if risk.get("affected_origins"):
    st.write("需要留意：" + "、".join(risk["affected_origins"]))
st.info("天氣只是影響價格的因素之一，畫面使用「可能」而非保證漲跌。")

