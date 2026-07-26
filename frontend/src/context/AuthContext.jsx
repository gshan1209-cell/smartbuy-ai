import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { normalizeRole } from '../config/roles';
import {
  fetchDashboardAccess,
  loginAccount,
  logoutAccount,
  updateAccountProfile,
} from '../lib/authApi';
import { resetFavoriteAuthCheck } from '../lib/favoritesService';

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
    resetFavoriteAuthCheck();
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
      const access = await fetchDashboardAccess();
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
      if (error?.status === 401) {
        clearSessionState();
        return;
      }

      if (error?.status === 403) {
        setDashboardAccess({
          dashboardAccess: false,
          role: normalizeRole(user.role),
          permissions: [],
        });
        setAccessDenied(true);
        return;
      }

      setAccessError(error instanceof Error ? error : new Error('權限服務暫時無法取得。'));
    } finally {
      setAuthLoading(false);
    }
  }, [clearSessionState, user]);

  useEffect(() => {
    refreshSession();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function login(email, password) {
    const { member } = await loginAccount({ email, password });
    setDashboardAccess(null);
    setAccessDenied(false);
    setAccessError(null);
    setAuthLoading(true);
    resetFavoriteAuthCheck();
    setUser(persistUser(member));
  }

  async function logout() {
    await logoutAccount().catch(() => {});
    clearSessionState();
    setAuthLoading(false);
  }

  function setAuthData(nextUser) {
    setDashboardAccess(null);
    setAccessDenied(false);
    setAccessError(null);
    setAuthLoading(Boolean(nextUser));
    resetFavoriteAuthCheck();
    setUser(persistUser(nextUser));
  }

  async function updateProfile(patch) {
    const { member: updated } = await updateAccountProfile(patch);
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
