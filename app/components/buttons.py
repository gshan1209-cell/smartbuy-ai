"""
模組名稱: app.components.buttons
功能說明: 共用按鈕元件。

【相關元件 (Related Components)】
- 無內部相依模組
"""
from __future__ import annotations

import streamlit as st


def primary_action(label: str, key: str | None = None) -> bool:
    return st.button(label, key=key, type="primary", use_container_width=True)

