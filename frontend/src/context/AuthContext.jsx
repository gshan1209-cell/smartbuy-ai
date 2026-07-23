import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { normalizeRole } from '../config/roles';

const BASE = import.meta.env.VITE_API_URL ?? '';
const LS_USER = 'yz_auth_user';

function normalizeUser(user) {
  if (!user) return null;
  return { ...user, role: normalizeRole(user.role) };
}

function loadUser() {
  try {
    return normalizeUser(JSON.parse(localStorage.getItem(LS_USER)));
  } catch {
    return null;
  }
}

function persistUser(user) {
  const normalized = normalizeUser(user);
  if (normalized) localStorage.setItem(LS_USER, JSON.stringify(normalized));
  else localStorage.removeItem(LS_USER);
  return normalized;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);
  const [authLoading, setAuthLoading] = useState(() => Boolean(loadUser()));
  const [dashboardAccess, setDashboardAccess] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessError, setAccessError] = useState(null);

  const clearSessionState = useCallback(() => {
    setUser(null);
    setDashboardAccess(null);
    setAccessDenied(false);
    setAccessError(null);
    localStorage.removeItem(LS_USER);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!user) {
      setDashboardAccess(null);
      setAccessDenied(false);
      setAccessError(null);
      setAuthLoading(false);
      return;
    }

    setAuthLoading(true);
    setAccessError(null);

    try {
      const response = await fetch(`${BASE}/api/admin/access`, {
        credentials: 'include',
      });

      if (response.status === 401) {
        clearSessionState();
        return;
      }

      if (response.status === 403) {
        setDashboardAccess({
          dashboardAccess: false,
          role: normalizeRole(user.role),
          permissions: [],
        });
        setAccessDenied(true);
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || `權限服務回傳 HTTP ${response.status}`);
      }

      const access = await response.json();
      const normalizedRole = normalizeRole(access.role);
      const nextUser = persistUser({ ...user, role: normalizedRole });

      setUser(nextUser);
      setDashboardAccess({
        ...access,
        role: normalizedRole,
        permissions: Array.isArray(access.permissions) ? access.permissions : [],
        dashboardAccess: access.dashboardAccess === true,
      });
      setAccessDenied(false);
    } catch (error) {
      setAccessError(error instanceof Error ? error : new Error('權限服務暫時無法取得。'));
    } finally {
      setAuthLoading(false);
    }
  }, [clearSessionState, user]);

  useEffect(() => {
    refreshSession();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function login(email, password) {
    const response = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || '登入失敗');
    }

    const { member } = await response.json();
    setDashboardAccess(null);
    setAccessDenied(false);
    setAccessError(null);
    setAuthLoading(true);
    setUser(persistUser(member));
  }

  async function logout() {
    await fetch(`${BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    clearSessionState();
    setAuthLoading(false);
  }

  function setAuthData(nextUser) {
    setDashboardAccess(null);
    setAccessDenied(false);
    setAccessError(null);
    setAuthLoading(Boolean(nextUser));
    setUser(persistUser(nextUser));
  }

  async function updateProfile(patch) {
    const response = await fetch(`${BASE}/api/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });

    if (!response.ok) throw new Error('更新失敗');

    const { member: updated } = await response.json();
    const nextUser = persistUser({ ...user, ...updated });
    setUser(nextUser);
  }

  const permissions = dashboardAccess?.permissions || [];

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        authLoading,
        dashboardAccess,
        permissions,
        accessDenied,
        accessError,
        refreshSession,
        login,
        logout,
        updateProfile,
        setAuthData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
