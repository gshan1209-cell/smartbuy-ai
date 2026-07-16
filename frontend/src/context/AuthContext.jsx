import { createContext, useContext, useState } from 'react';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const LS_USER = 'yz_auth_user';

function loadUser() {
  try { return JSON.parse(localStorage.getItem(LS_USER)); }
  catch { return null; }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

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
    setUser(u);
  }

  async function logout() {
    await fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
    localStorage.removeItem(LS_USER);
  }

  function setAuthData(u) {
    localStorage.setItem(LS_USER, JSON.stringify(u));
    setUser(u);
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
    setUser(updated);
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, updateProfile, setAuthData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
