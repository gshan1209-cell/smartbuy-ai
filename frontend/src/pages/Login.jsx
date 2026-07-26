import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BYPASS_ROLE_CHECKS_IN_DEV, DEV_DEFAULT_USER } from '../config/development';

export default function Login() {
  const { login, setAuthData } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => BYPASS_ROLE_CHECKS_IN_DEV ? DEV_DEFAULT_USER.email : '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleDevLogin() {
    setError('');
    setAuthData(DEV_DEFAULT_USER);
    navigate('/dashboard');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="yz-page" style={{ padding: '60px 40px' }}>
      <div style={{ maxWidth: 400, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>登入</h1>
        <p style={{ fontSize: 13, color: 'var(--yz-mut)', marginBottom: 28 }}>登入後即可使用完整功能</p>

        {BYPASS_ROLE_CHECKS_IN_DEV && (
          <div style={{ marginBottom: 20, padding: 14, border: '1px solid var(--yz-bdr)', borderRadius: 12, background: 'var(--yz-gl)' }}>
            <strong style={{ display: 'block', fontSize: 13, marginBottom: 5 }}>開發預設帳號</strong>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--yz-mut)', marginBottom: 10 }}>
              {DEV_DEFAULT_USER.email}．開發環境免密碼驗證
            </span>
            <button className="yz-btn yz-btn-g" type="button" onClick={handleDevLogin} style={{ width: '100%' }}>
              使用預設帳號進入後台
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--yz-mut)', display: 'block', marginBottom: 6 }}>Email</label>
            <input
              className="yz-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
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
              style={{ width: '100%' }}
            />
          </div>
          {error && <p style={{ fontSize: 13, color: 'var(--yz-red, #e53e3e)' }}>{error}</p>}
          <button className="yz-btn yz-btn-g" type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? '登入中…' : '登入'}
          </button>
        </form>

        <p style={{ fontSize: 13, color: 'var(--yz-mut)', marginTop: 20, textAlign: 'center' }}>
          還沒有帳號？{' '}
          <Link to="/register" style={{ color: 'var(--yz-g)', fontWeight: 600 }}>前往註冊</Link>
        </p>
      </div>
    </div>
  );
}
