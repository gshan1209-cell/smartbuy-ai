"""
模組名稱: app.pages.02_price_search
功能說明: 菜價搜尋頁面，提供使用者查詢行情與天氣風險。

【相關元件 (Related Components)】
- 依賴: app.common.configure_page
- 依賴: app.common.demo_notice
- 依賴: app.components.alert_card.render_alert_card
- 依賴: src.data.price_repository.load_latest_prices
- 依賴: src.data.price_repository.load_price_history
- 依賴: src.data.price_repository.get_latest_trans_date
- 依賴: src.recommendation.purchase_advisor.get_purchase_advice
"""
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import streamlit as st

from app.common import configure_page, demo_notice
from app.components.alert_card import render_alert_card
from src.data.price_repository import load_latest_prices, load_price_history, get_latest_trans_date
from src.data.prediction_repository import load_predictions
from src.recommendation.purchase_advisor import get_purchase_advice
import pandas as pd

configure_page("搜尋菜價")
st.title("🔎 搜尋菜價")
st.write("選一個品項，我們把價格、產地天氣和節氣一起看。")

# 1. 取得最新資料日期與目前使用的資料來源
latest_date, source_name = get_latest_trans_date()

if source_name == "Supabase":
    st.info(f"📊 資料來源：Supabase 線上資料庫 (最新資料日期：{latest_date or '無'})")
else:
    st.warning(f"⚠️ 目前使用本機示範資料 (Supabase 離線) (最新資料日期：{latest_date or '無'})")
    demo_notice()

# 2. 載入最新價格以取得所有可查詢品項
latest_prices = load_latest_prices()
products = sorted(latest_prices["product_name"].unique().tolist()) if not latest_prices.empty else []

if not products:
    st.error("目前無可查詢的農產品資料。")
else:
    product = st.selectbox(
        "想查哪一種？", 
        products, 
        index=products.index("高麗菜") if "高麗菜" in products else 0
    )

    # 3. 載入該作物的 90 天歷史價格以供整合採買建議引擎分析
    history_df = load_price_history(crop_name=product, days=90)
    
    # 4. 取得整合採買建議
    result = get_purchase_advice(product, prices=history_df)
    
    status_icon = {"偏貴": "🟠", "正常": "🔵", "便宜": "🟢", "資料不足": "⚪"}
    st.header(f"{status_icon.get(result['price_status'], '⚪')} {product}：{result['recommendation']}")

    cols = st.columns(3)
    cols[0].metric("今日行情", "—" if result["today_price"] is None else f"{result['today_price']} 元/公斤")
    cols[1].metric("價格狀態", result["price_status"])
    cols[2].metric("產地天氣風險", result["weather_risk"])

    st.success(result["advice"])
    render_alert_card("產地天氣", result["weather_detail"]["message"], result["weather_risk"])
    st.write(f"節氣判斷：**{result['solar_term_status']}**")
    if result["alternatives"]:
        st.write("可以改買：" + "、".join(result["alternatives"]))

    # 🔮 AI 未來行情預測
    st.markdown("---")
    st.subheader("🔮 AI 未來價格預測")

    crop_code = None
    market_code = None
    market_name = None
    if not history_df.empty:
        latest_row = history_df.iloc[-1]
        crop_code = latest_row.get("crop_code")
        market_code = latest_row.get("market_code")
        market_name = latest_row.get("market_name")
        
        if pd.isna(crop_code) or not str(crop_code).strip():
            crop_code = None
        if pd.isna(market_code) or not str(market_code).strip():
            market_code = None
        if pd.isna(market_name) or not str(market_name).strip():
            market_name = None

    if crop_code and market_code:
        predictions = load_predictions(crop_code=crop_code, market_code=market_code)
    else:
        predictions = load_predictions(crop_name=product, market_name=market_name)

    if predictions.empty:
        st.info("🔮 目前尚無該品項的未來價格預測資料。")
    else:
        pred_source = predictions.attrs.get("source", "本機 CSV")
        st.caption(f"預測資料來源：{pred_source}")
        
        display_df = predictions.head(5)
        cols_pred = st.columns(len(display_df))
        for idx, (_, row_pred) in enumerate(display_df.iterrows()):
            p_date = row_pred["predict_date"]
            if hasattr(p_date, "strftime"):
                p_date_str = p_date.strftime("%Y-%m-%d")
            else:
                p_date_str = str(p_date)
            p_price = row_pred["predicted_price"]
            p_status = row_pred["predicted_status"]

            status_map = {
                "cheap": "🟢 便宜",
                "normal": "🔵 正常",
                "expensive": "🟠 偏貴",
                "便宜": "🟢 便宜",
                "正常": "🔵 正常",
                "偏貴": "🟠 偏貴"
            }
            status_desc = status_map.get(p_status, f"⚪ {p_status}")
            
            with cols_pred[idx]:
                st.metric(
                    label=p_date_str,
                    value="—" if pd.isna(p_price) else f"{float(p_price):.1f} 元",
                    delta=status_desc,
                    delta_color="off" if p_status in ["normal", "正常"] else "normal"
                )
