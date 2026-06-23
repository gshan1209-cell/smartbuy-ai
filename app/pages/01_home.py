"""
模組名稱: app.pages.01_home
功能說明: 首頁入口，顯示節氣、推薦與系統總覽。

【相關元件 (Related Components)】
- 依賴: app.common.configure_page
- 依賴: app.home_view.render_home
"""
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.common import configure_page
from app.home_view import render_home


configure_page("首頁")
render_home()

