import { createContext, useContext, useState } from 'react';

const LS_KEY = 'yz_auth_user';

// 簡易假登入：之後接後端 auth 時整個檔案會被換掉，呼叫端介面（login/logout/user）不變。
const DEMO_USER = {
  email: 'farmer@example.com',
  password: 'farmer1234',
  name: '王大明',
  plan: '訂閱夥伴',
};

function loadUser() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)); }
  catch { return null; }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);

  function login(email, password) {
    if (email === DEMO_USER.email && password === DEMO_USER.password) {
      const { password: _pw, ...publicUser } = DEMO_USER;
      setUser(publicUser);
      localStorage.setItem(LS_KEY, JSON.stringify(publicUser));
      return true;
    }
    return false;
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(LS_KEY);
  }

  function updateProfile(patch) {
    setUser(u => {
      const next = { ...u, ...patch };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
