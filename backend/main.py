"""SmartBuy AI — FastAPI 部署入口。

應用程式組裝集中於 ``backend.application``，此檔案只保留 Uvicorn／Render 所需的穩定入口。
"""
from backend.application import create_app

app = create_app()
