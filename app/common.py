"""
模組名稱: app.common
功能說明: 包含 Streamlit 前端共用的設定與工具函式。

【相關元件 (Related Components)】
- 無內部相依模組
"""
from __future__ import annotations

import sys
from pathlib import Path

import streamlit as st


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def configure_page(title: str) -> None:
    st.set_page_config(page_title=f"{title}｜便宜買 AI", page_icon="🛒", layout="wide")
    st.markdown(
        """
        <style>
        .block-container {max-width: 1050px; padding-top: 1.4rem; padding-bottom: 3rem;}
        html, body, [class*="css"] {font-size: 18px;}
        h1 {font-size: 2.15rem !important;}
        h2 {font-size: 1.55rem !important;}
        .sb-card {border: 1px solid #dfe8df; border-radius: 18px; padding: 1rem 1.15rem;
                  margin: .5rem 0 1rem; background: #fbfdf9; box-shadow: 0 2px 8px rgba(0,0,0,.04);}
        .sb-title {font-size: 1.2rem; font-weight: 750; margin-bottom: .35rem;}
        .sb-value {font-size: 1.45rem; font-weight: 800; color: #246b43;}
        .sb-note {color: #4c5b50; margin-top: .25rem;}
        div.stButton > button, div.stFormSubmitButton > button {min-height: 48px; font-size: 1.05rem; border-radius: 12px;}
        </style>
        """,
        unsafe_allow_html=True,
    )


def demo_notice() -> None:
    st.caption("目前使用離線示範資料，價格與天氣僅供功能展示，不可作為實際採買依據。")

