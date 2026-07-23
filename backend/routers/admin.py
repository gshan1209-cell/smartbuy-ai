from fastapi import APIRouter, Depends

from backend.security.roles import permissions_for_role, require_roles

router = APIRouter()

@router.get('/api/admin/access')
def admin_access(member = Depends(require_roles('farmer', 'merchant', 'admin'))):
    return {
        'role': member['role'],
        'permissions': permissions_for_role(member['role']),
        'dashboardAccess': True,
    }
