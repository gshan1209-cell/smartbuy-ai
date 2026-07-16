import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Register() {
  const navigate = useNavigate();
  const { setAuthData } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || '註冊失敗');
      }
      const { member } = await res.json();
      setAuthData(member);
      navigate('/settings');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="yz-page" style={{ padding: '60px 40px' }}>
      <div style={{ maxWidth: 400, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>建立帳號</h1>
        <p style={{ fontSize: 13, color: 'var(--yz-mut)', marginBottom: 28 }}>免費註冊，立即使用 SmartBuy AI</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--yz-mut)', display: 'block', marginBottom: 6 }}>顯示名稱</label>
            <input
              className="yz-input"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--yz-mut)', display: 'block', marginBottom: 6 }}>Email</label>
            <input
              className="yz-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--yz-mut)', display: 'block', marginBottom: 6 }}>密碼</label>
            <input
              className="yz-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ width: '100%' }}
            />
          </div>
          {error && <p style={{ fontSize: 13, color: 'var(--yz-red, #e53e3e)' }}>{error}</p>}
          <button className="yz-btn yz-btn-g" type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? '建立中…' : '建立帳號'}
          </button>
        </form>

        <p style={{ fontSize: 13, color: 'var(--yz-mut)', marginTop: 20, textAlign: 'center' }}>
          已有帳號？{' '}
          <Link to="/login" style={{ color: 'var(--yz-g)', fontWeight: 600 }}>前往登入</Link>
        </p>
      </div>
    </div>
  );
}
