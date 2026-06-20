"""
模組名稱: app.components.alert_card
功能說明: 警示卡片元件，用於顯示各種系統或天氣提醒。

【相關元件 (Related Components)】
- 無內部相依模組
"""
from __future__ import annotations

import html

import streamlit as st


def render_alert_card(title: str, message: str, level: str = "提醒") -> None:
    icon = {"低": "🌤️", "中": "🌦️", "高": "🌧️", "很高": "🌀"}.get(level, "📣")
    st.markdown(
        f'<div class="sb-card"><div class="sb-title">{icon} {html.escape(title)}</div>'
        f'<div class="sb-note">{html.escape(message)}</div></div>',
        unsafe_allow_html=True,
    )

