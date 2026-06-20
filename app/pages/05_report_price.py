"""
模組名稱: app.pages.05_report_price
功能說明: 買貴通報頁面，讓使用者回報市場真實價格。

【相關元件 (Related Components)】
- 依賴: app.common.configure_page
- 依賴: app.common.demo_notice
- 依賴: src.data.data_loader.load_market_prices
- 依賴: src.data.report_store.add_price_report
"""
import streamlit as st

from app.common import configure_page, demo_notice
from src.data.data_loader import load_market_prices
from src.data.report_store import add_price_report


configure_page("買貴通報")
st.title("🧾 買貴通報")
st.write("覺得買得比行情高？留下通報供後續人工確認。")
demo_notice()

products = sorted(load_market_prices()["product_name"].unique().tolist())
with st.form("price-report", clear_on_submit=True):
    product = st.selectbox("品項", products)
    price = st.number_input("買入價格（元／公斤）", min_value=0.0, step=1.0)
    market = st.text_input("市場或購買地點", placeholder="例如：○○市場")
    submitted = st.form_submit_button("送出通報", type="primary", use_container_width=True)

if submitted:
    if price <= 0 or not market.strip():
        st.error("請填寫有效價格與購買地點。")
    else:
        report = add_price_report(product, price, market)
        st.success(f"通報已收到（{report['report_id']}），初步比較：{report['comparison']}。資料仍待人工確認。")

