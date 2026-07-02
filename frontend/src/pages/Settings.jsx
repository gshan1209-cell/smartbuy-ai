import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const LS_KEY = 'smartbuy_notif_prefs';
const DEFAULT_PREFS = { priceAlert: true, weatherAlert: true, mutualAidReply: false };

function loadPrefs() {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(LS_KEY)) }; }
  catch { return DEFAULT_PREFS; }
}

const PREF_ITEMS = [
  { key: 'priceAlert', label: '品項降價通知', desc: '菜籃內的品項價格明顯下降時通知我' },
  { key: 'weatherAlert', label: '產地天氣異常警示', desc: '關注品項的產地發生多雨、乾旱等異常天氣時通知我' },
  { key: 'mutualAidReply', label: '互助網回應通知', desc: '我發布的貼文有新留言時通知我' },
];

function Toggle({ on, onClick }) {
  return <button type="button" className={`yz-tgl ${on ? 'on' : 'off'}`} onClick={onClick} aria-pressed={on} />;
}

export default function Settings() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saved, setSaved] = useState(false);
  const [prefs, setPrefs] = useState(loadPrefs);

  if (!user) {
    return (
      <div className="yz-page" style={{ padding: '60px 40px', textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: 'var(--yz-mut)' }}>請先登入才能使用設定頁面</p>
      </div>
    );
  }

  function handleSaveName(e) {
    e.preventDefault();
    if (!name.trim()) return;
    updateProfile({ name: name.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function togglePref(key) {
    setPrefs(p => {
      const next = { ...p, [key]: !p[key] };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="yz-page" style={{ padding: '32px 40px 60px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>⚙️ 設定</h1>
        <p style={{ fontSize: 13, color: 'var(--yz-mut)', marginBottom: 24 }}>
          管理帳號資料與推播通知偏好
        </p>

        {/* 帳號資料 */}
        <div className="yz-card" style={{ padding: '22px 24px', marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>帳號資料</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--yz-gl)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--yz-gd)' }}>
              {user.name[0]}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600 }}>{user.name}</p>
              <span className="yz-bdg yz-bdg-g" style={{ marginTop: 4 }}>{user.plan}</span>
            </div>
          </div>

          <form onSubmit={handleSaveName}>
            <label htmlFor="yz-settings-name" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--yz-mut)', marginBottom: 6 }}>顯示名稱</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input id="yz-settings-name" className="yz-input" value={name} onChange={e => setName(e.target.value)} />
              <button className="yz-btn yz-btn-g" type="submit" style={{ flexShrink: 0 }}>儲存</button>
            </div>
            {saved && <p style={{ fontSize: 12, color: 'var(--yz-g)', marginTop: -8, marginBottom: 14 }}>✓ 已儲存</p>}
          </form>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--yz-mut)', marginBottom: 6 }}>Email</label>
          <p style={{ fontSize: 14, color: 'var(--yz-dim)' }}>{user.email}</p>
        </div>

        {/* 推播偏好 */}
        <div className="yz-card" style={{ padding: '22px 24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>推播偏好</h2>
          <p style={{ fontSize: 12, color: 'var(--yz-dim)', marginBottom: 16 }}>目前為示範設定，尚未串接實際推播</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {PREF_ITEMS.map(item => (
              <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{item.label}</p>
                  <p style={{ fontSize: 12, color: 'var(--yz-mut)' }}>{item.desc}</p>
                </div>
                <Toggle on={prefs[item.key]} onClick={() => togglePref(item.key)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
