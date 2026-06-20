"""
模組名稱: app.pages.02_price_search
功能說明: 菜價搜尋頁面，提供使用者查詢行情與天氣風險。

【相關元件 (Related Components)】
- 依賴: app.common.configure_page
- 依賴: app.common.demo_notice
- 依賴: app.components.alert_card.render_alert_card
- 依賴: src.data.data_loader.load_market_prices
- 依賴: src.recommendation.purchase_advisor.get_purchase_advice
"""
import streamlit as st

from app.common import configure_page, demo_notice
from app.components.alert_card import render_alert_card
from src.data.data_loader import load_market_prices
from src.recommendation.purchase_advisor import get_purchase_advice


configure_page("搜尋菜價")
st.title("🔎 搜尋菜價")
st.write("選一個品項，我們把價格、產地天氣和節氣一起看。")
demo_notice()

products = sorted(load_market_prices()["product_name"].unique().tolist())
product = st.selectbox("想查哪一種？", products, index=products.index("高麗菜") if "高麗菜" in products else 0)

result = get_purchase_advice(product)
status_icon = {"偏貴": "🟠", "正常": "🔵", "便宜": "🟢", "資料不足": "⚪"}
st.header(f"{status_icon.get(result['price_status'], '⚪')} {product}：{result['recommendation']}")

cols = st.columns(3)
cols[0].metric("今日示範行情", "—" if result["today_price"] is None else f"{result['today_price']} 元/公斤")
cols[1].metric("價格狀態", result["price_status"])
cols[2].metric("產地天氣風險", result["weather_risk"])

st.success(result["advice"])
render_alert_card("產地天氣", result["weather_detail"]["message"], result["weather_risk"])
st.write(f"節氣判斷：**{result['solar_term_status']}**")
if result["alternatives"]:
    st.write("可以改買：" + "、".join(result["alternatives"]))

