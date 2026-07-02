import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ready:false 的頁面尚未重做完成，先顯示為不可點擊的灰字（依序施工中）
const links = [
  { to: '/',           label: '首頁',     ready: true },
  { to: '/search',     label: '售價動態', ready: true },
  { to: '/news',       label: '農產新知', ready: true },
  { to: '/mutual-aid', label: '互助網',   ready: true },
  { to: '/basket',     label: '我的菜籃', ready: true },
  { to: '/settings',   label: '設定',     ready: true },
];

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header style={{ background: '#fff', borderBottom: '1px solid var(--yz-bdr)', height: 58, display: 'flex', alignItems: 'center', padding: '0 36px' }}>
      <NavLink to="/" style={{ fontSize: 17, fontWeight: 900, color: 'var(--yz-g)', marginRight: 28, letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>
        🌿 優值生鮮情報站
      </NavLink>
      <nav style={{ display: 'flex', gap: 2, flex: 1 }}>
        {links.map(l => l.ready ? (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            style={({ isActive }) => ({
              padding: '7px 13px',
              borderRadius: 7,
              fontSize: 14,
              whiteSpace: 'nowrap',
              color: isActive ? 'var(--yz-g)' : 'var(--yz-mut)',
              background: isActive ? 'var(--yz-gl)' : 'transparent',
              fontWeight: isActive ? 600 : 400,
            })}
          >
            {l.label}
          </NavLink>
        ) : (
          <span key={l.to} title="施工中" style={{ padding: '7px 13px', borderRadius: 7, fontSize: 14, color: 'var(--yz-dim)', cursor: 'default', whiteSpace: 'nowrap' }}>
            {l.label}
          </span>
        ))}
      </nav>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {isAuthenticated ? (
          <>
            <button
              onClick={() => navigate('/settings')}
              title="個人設定"
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 7 }}
            >
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--yz-gl)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--yz-gd)' }}>
                {user.name[0]}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--yz-txt)' }}>{user.name}</span>
            </button>
            <button className="yz-btn yz-btn-gho yz-btn-sm" onClick={() => { logout(); navigate('/'); }}>登出</button>
          </>
        ) : (
          <button className="yz-btn yz-btn-out yz-btn-sm" onClick={() => navigate('/')}>登入</button>
        )}
      </div>
    </header>
  );
}
