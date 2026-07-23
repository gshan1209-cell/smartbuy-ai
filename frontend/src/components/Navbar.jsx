import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchNotifications, fetchUnreadCount, markNotificationRead, markAllNotificationsRead } from '../lib/notificationsApi';

const NOTIF_POLL_MS = 45000; // 未讀通知輪詢間隔：介於已確認的 30~60 秒範圍內
const NOTIF_PAGE_SIZE = 10;

// ready:false 的頁面尚未重做完成，先顯示為不可點擊的灰字（依序施工中）
const links = [
  { to: '/',           label: '首頁',     ready: true },
  { to: '/search',     label: '售價動態', ready: true },
  { to: '/news',       label: '農產新知', ready: true },
  { to: '/mutual-aid', label: '互助網',   ready: true },
  { to: '/basket',     label: '我的菜籃', ready: true },
  { to: '/settings',   label: '設定',     ready: true },
];

function formatNotifTime(iso) {
  return iso ? iso.slice(0, 16).replace('T', ' ') : '';
}

function notifText(item) {
  return item.type === 'mutual_aid_reply'
    ? `${item.actorName} 回覆了你的貼文`
    : `${item.actorName} 按讚了你的貼文`;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      fetchUnreadCount()
        .then(({ unreadCount: count }) => { if (!cancelled) setUnreadCount(count); })
        .catch(() => {});
    };
    poll();
    const timer = setInterval(poll, NOTIF_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function loadNotifications(offset) {
    setLoading(true);
    setLoadError('');
    fetchNotifications({ limit: NOTIF_PAGE_SIZE, offset })
      .then(data => {
        setItems(list => (offset === 0 ? data.items : [...list, ...data.items]));
        setHasMore(offset + data.items.length < data.total);
        setUnreadCount(data.unreadCount);
      })
      .catch(err => setLoadError(err.message || '載入通知失敗'))
      .finally(() => setLoading(false));
  }

  function toggleOpen() {
    setOpen(o => {
      const next = !o;
      if (next) loadNotifications(0);
      return next;
    });
  }

  function handleItemClick(item) {
    setOpen(false);
    if (!item.isRead) {
      setItems(list => list.map(n => (n.id === item.id ? { ...n, isRead: true } : n)));
      setUnreadCount(c => Math.max(c - 1, 0));
      markNotificationRead(item.id).catch(() => {});
    }
    navigate(`/mutual-aid?post=${item.postId}`);
  }

  function handleMarkAllRead() {
    setItems(list => list.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    markAllNotificationsRead().catch(() => {});
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={toggleOpen}
        title="通知"
        style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 7, fontSize: 17 }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 8, background: 'var(--yz-red, #e53e3e)', color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: '15px', textAlign: 'center' }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 340, maxHeight: 420, overflowY: 'auto', background: '#fff', border: '1px solid var(--yz-bdr)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--yz-bdr)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--yz-txt)' }}>通知</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--yz-g)' }}>
                全部標為已讀
              </button>
            )}
          </div>

          {loading && items.length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--yz-mut)' }}>載入中...</p>
          )}
          {!loading && loadError && (
            <p style={{ padding: '14px', fontSize: 12.5, color: 'var(--yz-red, #e53e3e)' }}>{loadError}</p>
          )}
          {!loading && !loadError && items.length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--yz-mut)' }}>目前沒有通知</p>
          )}

          {items.map(item => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--yz-bdr)', background: item.isRead ? 'transparent' : 'var(--yz-gl)', cursor: 'pointer' }}
            >
              <div style={{ fontSize: 13, color: 'var(--yz-txt)', fontWeight: item.isRead ? 400 : 600 }}>
                {notifText(item)}
              </div>
              {item.postPreview && (
                <div style={{ fontSize: 12, color: 'var(--yz-mut)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.postPreview}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--yz-dim)', marginTop: 4 }}>{formatNotifTime(item.createdAt)}</div>
            </button>
          ))}

          {hasMore && (
            <div style={{ textAlign: 'center', padding: 8 }}>
              <button
                onClick={() => loadNotifications(items.length)}
                disabled={loading}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--yz-g)' }}
              >
                {loading ? '載入中...' : '載入更多'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', borderBottom: '1px solid var(--yz-bdr)', height: 58, display: 'flex', alignItems: 'center', padding: '0 36px' }}>
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
            <NotificationBell />
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
          <button className="yz-btn yz-btn-out yz-btn-sm" onClick={() => navigate('/login')}>登入</button>
        )}
      </div>
    </header>
  );
}
