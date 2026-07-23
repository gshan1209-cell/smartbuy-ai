import { createContext, useContext, useEffect, useState } from 'react';
import { normalizeRole } from '../config/roles';

const BASE = import.meta.env.VITE_API_URL ?? '';
const LS_USER = 'yz_auth_user';

function loadUser() {
  try { return JSON.parse(localStorage.getItem(LS_USER)); }
  catch { return null; }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);
  const [authLoading, setAuthLoading] = useState(false);
  const [dashboardAccess, setDashboardAccess] = useState(null);
  const [accessError, setAccessError] = useState(null);

  async function refreshSession() {
    if (!user) { setDashboardAccess(null); return; }
    setAuthLoading(true); setAccessError(null);
    try { const res = await fetch(`${BASE}/api/admin/access`, { credentials: 'include' }); if (!res.ok) throw new Error(`HTTP ${res.status}`); const access = await res.json(); setDashboardAccess(access); setUser((current) => ({ ...current, role: normalizeRole(access.role) })); }
    catch (error) { setDashboardAccess(null); setAccessError(error); }
    finally { setAuthLoading(false); }
  }
  useEffect(() => { refreshSession(); }, [user?.id]);

  async function login(email, password) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || '登入失敗');
    }
    const { member: u } = await res.json();
    localStorage.setItem(LS_USER, JSON.stringify(u));
    setUser({ ...u, role: normalizeRole(u.role) });
  }

  async function logout() {
    await fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null); setDashboardAccess(null);
    localStorage.removeItem(LS_USER);
  }

  function setAuthData(u) {
    localStorage.setItem(LS_USER, JSON.stringify(u));
    setUser({ ...u, role: normalizeRole(u.role) });
  }

  async function updateProfile(patch) {
    const res = await fetch(`${BASE}/api/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('更新失敗');
    const { member: updated } = await res.json();
    localStorage.setItem(LS_USER, JSON.stringify(updated));
    setUser({ ...updated, role: normalizeRole(updated.role) });
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, authLoading, dashboardAccess, permissions: dashboardAccess?.permissions || [], accessError, refreshSession, login, logout, updateProfile, setAuthData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
