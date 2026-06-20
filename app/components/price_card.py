"""
模組名稱: app.components.price_card
功能說明: 價格卡片元件，負責格式化並顯示菜價資訊。

【相關元件 (Related Components)】
- 無內部相依模組
"""
from __future__ import annotations

import html

import streamlit as st


ICONS = {"便宜": "🟢", "正常": "🔵", "偏貴": "🟠", "資料不足": "⚪"}


def render_price_card(item: dict) -> None:
    name = html.escape(str(item["product_name"]))
    status = html.escape(str(item["status"]))
    price = "—" if item.get("today_price") is None else f"{float(item['today_price']):.1f} 元／公斤"
    suggestion = html.escape(str(item.get("suggestion", "")))
    st.markdown(
        f'<div class="sb-card"><div class="sb-title">{ICONS.get(status, "⚪")} {name}</div>'
        f'<div class="sb-value">{status}・{price}</div><div class="sb-note">{suggestion}</div></div>',
        unsafe_allow_html=True,
    )

