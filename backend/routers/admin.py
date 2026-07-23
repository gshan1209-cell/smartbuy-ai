from fastapi import APIRouter, Depends

from backend.security.roles import permissions_for_role, require_permissions

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/access")
def admin_access(member: dict = Depends(require_permissions("dashboard.view"))):
    return {
        "role": member["role"],
        "permissions": permissions_for_role(member["role"]),
        "dashboardAccess": True,
    }


@router.get("/weather/status")
def weather_status(member: dict = Depends(require_permissions("weather.view"))):
    return {
        "available": False,
        "status": "unavailable",
        "provider": None,
        "lastUpdatedAt": None,
        "reason": "尚未接入正式中央氣象署資料來源",
        "capabilities": {
            "countyForecast": False,
            "weatherAlerts": False,
            "cropRiskRules": False,
        },
    }
