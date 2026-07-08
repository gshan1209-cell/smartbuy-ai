import { createContext, useContext, useState } from 'react';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const LS_USER = 'yz_auth_user';
const LS_TOKEN = 'yz_auth_token';

function loadUser() {
  try { return JSON.parse(localStorage.getItem(LS_USER)); }
  catch { return null; }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

  async function login(email, password) {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || '登入失敗');
    }
    const { token, user: u } = await res.json();
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_USER, JSON.stringify(u));
    setUser(u);
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
  }

  function setAuthData(token, u) {
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_USER, JSON.stringify(u));
    setUser(u);
  }

  async function updateProfile(patch) {
    const token = localStorage.getItem(LS_TOKEN);
    const res = await fetch(`${BASE}/auth/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('更新失敗');
    const updated = await res.json();
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
