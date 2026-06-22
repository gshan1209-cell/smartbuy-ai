from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[2]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pandas as pd
import streamlit as st

from src.db import get_engine
from src.anomaly.price_status import get_price_status


st.title("菜價狀態分析測試")
st.write("從 Supabase 讀取農產品行情資料，判斷指定品項目前是偏貴、正常、便宜或資料不足。")

engine = get_engine()

query = """
SELECT
    trans_date,
    crop_name AS product_name,
    market_name,
    avg_price
FROM agri_price_daily
WHERE avg_price IS NOT NULL
ORDER BY trans_date DESC;
"""

try:
    prices = pd.read_sql(query, engine)

    if prices.empty:
        st.warning("目前 agri_price_daily 沒有可分析的價格資料。")
        st.stop()

    prices["trans_date"] = pd.to_datetime(prices["trans_date"])

    product_options = sorted(prices["product_name"].dropna().unique())

    selected_product = st.selectbox(
        "請選擇品項",
        product_options,
    )

    product_data = prices[prices["product_name"] == selected_product]

    market_options = ["全部市場"] + sorted(product_data["market_name"].dropna().unique())

    selected_market = st.selectbox(
        "請選擇市場",
        market_options,
    )

    market_name = None if selected_market == "全部市場" else selected_market

    result = get_price_status(
        product_name=selected_product,
        market_name=market_name,
        prices=prices,
    )

    st.subheader("分析結果")

    status = result["status"]

    if status == "偏貴":
        st.error(f"狀態：{status}")
    elif status == "便宜":
        st.success(f"狀態：{status}")
    elif status == "正常":
        st.info(f"狀態：{status}")
    else:
        st.warning(f"狀態：{status}")

    col1, col2, col3 = st.columns(3)

    with col1:
        st.metric("品項", result["product_name"])

    with col2:
        st.metric(
            "今日價格",
            "無資料" if result["today_price"] is None else f"{result['today_price']} 元/公斤",
        )

    with col3:
        st.metric(
            "近期平均",
            "無資料" if result.get("recent_average") is None else f"{result['recent_average']} 元/公斤",
        )

    st.write("市場：", result["market_name"] if result["market_name"] else "全部市場")
    st.write("原因：", result["reason"])
    st.write("建議：", result["suggestion"])

    st.subheader("近期價格資料")

    display_data = product_data.copy()

    if market_name:
        display_data = display_data[display_data["market_name"] == market_name]

    display_data = display_data.sort_values("trans_date", ascending=False)

    st.dataframe(
        display_data.head(50),
        use_container_width=True,
    )

except Exception as e:
    st.error("菜價狀態分析失敗。")
    st.exception(e)