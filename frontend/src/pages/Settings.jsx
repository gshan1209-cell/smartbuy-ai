import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const LS_KEY = 'smartbuy_notif_prefs';
const DEFAULT_PREFS = { priceAlert: true, weatherAlert: true, mutualAidReply: false };

const LS_DISPLAY_KEY = 'smartbuy_display_prefs';
const DEFAULT_DISPLAY = { fontSize: 'md', layout: 'simple', theme: 'light' };

function loadPrefs() {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(LS_KEY)) }; }
  catch { return DEFAULT_PREFS; }
}

function loadDisplayPrefs() {
  try { return { ...DEFAULT_DISPLAY, ...JSON.parse(localStorage.getItem(LS_DISPLAY_KEY)) }; }
  catch { return DEFAULT_DISPLAY; }
}

function saveDisplayPrefs(next) {
  localStorage.setItem(LS_DISPLAY_KEY, JSON.stringify(next));
  document.documentElement.setAttribute('data-theme', next.theme);
  document.documentElement.setAttribute('data-fontsize', next.fontSize);
}

function splitPrefs(data) {
  return {
    prefs: {
      priceAlert:     data.priceAlert     ?? DEFAULT_PREFS.priceAlert,
      weatherAlert:   data.weatherAlert   ?? DEFAULT_PREFS.weatherAlert,
      mutualAidReply: data.mutualAidReply ?? DEFAULT_PREFS.mutualAidReply,
    },
    display: {
      fontSize: data.fontSize ?? DEFAULT_DISPLAY.fontSize,
      layout:   data.layout   ?? DEFAULT_DISPLAY.layout,
      theme:    data.theme    ?? DEFAULT_DISPLAY.theme,
    },
  };
}

async function savePreferences(patch) {
  const res = await fetch(`${BASE}/api/auth/preferences`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('設定同步失敗');
  return res.json();
}

const PREF_ITEMS = [
  { key: 'priceAlert', label: '品項降價通知', desc: '菜籃內的品項價格明顯下降時通知我' },
  { key: 'mutualAidReply', label: '互助網回應通知', desc: '我發布的貼文有新留言時通知我' },
];

const FAQ_ITEMS = [
  { id: 'data-source', q: '價格資料來源是什麼？', a: '本站批發行情資料來自行政院農業部農產品批發市場交易行情，每日更新。' },
  { id: 'accuracy', q: 'AI 方向預測的準確率如何？', a: '目前模型預測次日漲跌方向，準確率約 51%，僅供參考，請勿作為唯一採買依據。' }, /* UPDATE after each model retrain */
  { id: 'basket', q: '菜籃資料會消失嗎？', a: '菜籃品項儲存在瀏覽器本機，清除瀏覽器快取或換裝置後資料不保留。' },
];

function Toggle({ on, onClick }) {
  return <button type="button" className={`yz-tgl ${on ? 'on' : 'off'}`} onClick={onClick} aria-pressed={on} />;
}

function OptionGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(({ val, label }) => (
        <button
          key={val}
          type="button"
          onClick={() => val !== value && onChange(val)}
          style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', border: '1.5px solid',
            background: value === val ? 'var(--yz-g)' : 'var(--yz-bgs)',
            color: value === val ? '#fff' : 'var(--yz-mut)',
            borderColor: value === val ? 'var(--yz-g)' : 'var(--yz-bdr)',
            transition: 'all .15s',
          }}
        >{label}</button>
      ))}
    </div>
  );
}

function FaqAccordion() {
  const [open, setOpen] = useState(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {FAQ_ITEMS.map((item, i) => (
        <div key={item.id} style={{ borderBottom: i < FAQ_ITEMS.length - 1 ? '1px solid var(--yz-bdr)' : 'none' }}>
          <button
            type="button"
            onClick={() => setOpen(open === item.id ? null : item.id)}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 8 }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--yz-txt)' }}>{item.q}</span>
            <span style={{ fontSize: 12, color: 'var(--yz-dim)', flexShrink: 0 }}>{open === item.id ? '▴' : '▾'}</span>
          </button>
          {open === item.id && (
            <p style={{ fontSize: 12, color: 'var(--yz-mut)', lineHeight: 1.7, paddingBottom: 12 }}>{item.a}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Settings() {
  const { user, updateProfile, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [feedback, setFeedback] = useState(null);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [displayPrefs, setDisplayPrefs] = useState(loadDisplayPrefs);
  const [copied, setCopied] = useState(false);
  const [pwForm, setPwForm] = useState({ old: '', new: '', confirm: '' });
  const [pwState, setPwState] = useState('idle');
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (!user) return;

    async function loadServerPreferences() {
      try {
        const res = await fetch(`${BASE}/api/auth/preferences`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        const { prefs: nextPrefs, display: nextDisplay } = splitPrefs(data);
        setPrefs(nextPrefs);
        setDisplayPrefs(nextDisplay);
        localStorage.setItem(LS_KEY, JSON.stringify(nextPrefs));
        saveDisplayPrefs(nextDisplay);
      } catch {
        // server preferences unavailable; fall back to localStorage
      }
    }

    loadServerPreferences();
  }, [user]);

  if (!user) {
    return (
      <div className="yz-page" style={{ padding: '60px 40px', textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: 'var(--yz-mut)', marginBottom: 16 }}>請先登入才能使用設定頁面</p>
        <Link to="/login" className="yz-btn yz-btn-g" style={{ display: 'inline-block' }}>前往登入</Link>
      </div>
    );
  }

  async function handleSaveName(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await updateProfile({ name: name.trim() });
      setFeedback({ type: 'success', msg: '✓ 已儲存' });
      setTimeout(() => setFeedback(null), 2000);
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message });
      setTimeout(() => setFeedback(null), 3000);
    }
  }

  function togglePref(key) {
    const prevPrefs = prefs;
    const nextPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(nextPrefs);
    localStorage.setItem(LS_KEY, JSON.stringify(nextPrefs));
    savePreferences({ [key]: nextPrefs[key] })
      .catch(err => {
        setPrefs(prevPrefs);
        localStorage.setItem(LS_KEY, JSON.stringify(prevPrefs));
        setFeedback({ type: 'error', msg: err.message });
        setTimeout(() => setFeedback(null), 3000);
      });
  }

  function updateDisplay(key, val) {
    if (val === displayPrefs[key]) return;
    const prevDisplay = displayPrefs;
    const nextDisplay = { ...displayPrefs, [key]: val };
    setDisplayPrefs(nextDisplay);
    saveDisplayPrefs(nextDisplay);
    savePreferences({ [key]: val })
      .catch(err => {
        setDisplayPrefs(prevDisplay);
        saveDisplayPrefs(prevDisplay);
        setFeedback({ type: 'error', msg: err.message });
        setTimeout(() => setFeedback(null), 3000);
      });
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (pwForm.new !== pwForm.confirm) {
      setPwError('兩次輸入的新密碼不一致');
      return;
    }
    setPwState('loading');
    setPwError('');
    try {
      const res = await fetch(`${BASE}/api/auth/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ old_password: pwForm.old, new_password: pwForm.new }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || '密碼變更失敗');
      }
      setPwState('success');
      setPwForm({ old: '', new: '', confirm: '' });
      setTimeout(() => setPwState('idle'), 3000);
    } catch (err) {
      setPwError(err.message);
      setPwState('error');
    }
  }

  function handleShare() {
    const url = window.location.origin;
    if (navigator.share) {
      navigator.share({ title: 'SmartBuy AI 便宜買', url });
    } else {
      navigator.clipboard.writeText(url)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          setFeedback({ type: 'error', msg: '無法自動複製，請手動複製網址' });
          setTimeout(() => setFeedback(null), 3000);
        });
    }
  }

  const sectionStyle = { padding: '22px 24px', marginBottom: 20 };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--yz-mut)', marginBottom: 8, display: 'block' };
  const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 18 };

  return (
    <div className="yz-page" style={{ padding: '32px 40px 60px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>設定</h1>
        <p style={{ fontSize: 13, color: 'var(--yz-mut)', marginBottom: 24 }}>帳號、顯示偏好與推播設定</p>
        {feedback && (
          <p style={{
            fontSize: 13,
            color: feedback.type === 'success' ? 'var(--yz-g)' : 'var(--yz-red, #e53e3e)',
            marginBottom: 16,
          }}>{feedback.msg}</p>
        )}

        {/* 帳號資料 */}
        <div className="yz-card" style={sectionStyle}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>帳號資料</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--yz-gl)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--yz-gd)' }}>
              {(user.name?.[0] ?? '?').toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600 }}>{user.name}</p>
              <span className="yz-bdg yz-bdg-g" style={{ marginTop: 4 }}>{user.plan}</span>
            </div>
          </div>

          <form onSubmit={handleSaveName}>
            <label htmlFor="yz-settings-name" style={labelStyle}>顯示名稱</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input id="yz-settings-name" className="yz-input" value={name} onChange={e => setName(e.target.value)} />
              <button className="yz-btn yz-btn-g" type="submit" style={{ flexShrink: 0 }}>儲存</button>
            </div>

          </form>

          <label style={labelStyle}>Email</label>
          <p style={{ fontSize: 14, color: 'var(--yz-dim)', marginBottom: 20 }}>{user.email}</p>

          <hr style={{ border: 'none', borderTop: '1px solid var(--yz-bdr)', margin: '16px 0' }} />

          <form onSubmit={handleChangePassword}>
            <label style={labelStyle}>變更密碼</label>
            <input
              className="yz-input"
              type="password"
              placeholder="舊密碼"
              value={pwForm.old}
              onChange={e => setPwForm(f => ({ ...f, old: e.target.value }))}
              style={{ marginBottom: 8 }}
            />
            <input
              className="yz-input"
              type="password"
              placeholder="新密碼"
              value={pwForm.new}
              onChange={e => setPwForm(f => ({ ...f, new: e.target.value }))}
              style={{ marginBottom: 8 }}
            />
            <input
              className="yz-input"
              type="password"
              placeholder="確認新密碼"
              value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
              style={{ marginBottom: 8 }}
            />
            {pwError && (
              <p style={{ fontSize: 12, color: 'var(--yz-re)', marginBottom: 8 }}>{pwError}</p>
            )}
            <button
              className="yz-btn yz-btn-g"
              type="submit"
              disabled={pwState === 'loading' || pwState === 'success'}
              style={{ marginBottom: 16 }}
            >
              {pwState === 'loading' ? '處理中…' : pwState === 'success' ? '✓ 已變更' : '變更密碼'}
            </button>
          </form>

          <button
            type="button"
            className="yz-btn yz-btn-gho yz-btn-sm"
            onClick={logout}
          >登出</button>
        </div>

        {/* 顯示與版面 */}
        <div className="yz-card" style={sectionStyle}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>顯示與版面</h2>

          <div style={rowStyle}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>字體大小</p>
              <p style={{ fontSize: 12, color: 'var(--yz-mut)' }}>調整全站文字大小</p>
            </div>
            <OptionGroup
              options={[{ val: 'sm', label: '小' }, { val: 'md', label: '中' }, { val: 'lg', label: '大' }]}
              value={displayPrefs.fontSize}
              onChange={val => updateDisplay('fontSize', val)}
            />
          </div>

          <div style={rowStyle}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>版面設定</p>
              <p style={{ fontSize: 12, color: 'var(--yz-mut)' }}>詳細模式顯示更多行情數據</p>
            </div>
            <OptionGroup
              options={[{ val: 'simple', label: '簡易' }, { val: 'detailed', label: '詳細' }]}
              value={displayPrefs.layout}
              onChange={val => updateDisplay('layout', val)}
            />
          </div>

          <div style={{ ...rowStyle, marginBottom: 0 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>主題配色</p>
              <p style={{ fontSize: 12, color: 'var(--yz-mut)' }}>切換亮色或暗色介面</p>
            </div>
            <OptionGroup
              options={[{ val: 'light', label: '亮色' }, { val: 'dark', label: '暗色' }]}
              value={displayPrefs.theme}
              onChange={val => updateDisplay('theme', val)}
            />
          </div>
        </div>

        {/* 推播偏好 */}
        <div className="yz-card" style={sectionStyle}>
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

        {/* 關於 */}
        <div className="yz-card" style={{ ...sectionStyle, marginBottom: 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>關於</h2>

          {/* 作者 */}
          <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--yz-bdr)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--yz-dim)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 10 }}>幕後</p>
            <p style={{ fontSize: 13, color: 'var(--yz-mut)', lineHeight: 1.75 }}>
              SmartBuy AI 由一位關心台灣農產市場的開發者獨立製作。<br />
              如有建議或回饋，歡迎透過互助網或其他管道聯繫。
            </p>
          </div>

          {/* FAQ */}
          <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--yz-bdr)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--yz-dim)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 4 }}>常見問題</p>
            <FaqAccordion />
          </div>

          {/* 分享 + 版本 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              className="yz-btn yz-btn-out yz-btn-sm"
              onClick={handleShare}
            >
              {copied ? '✓ 已複製連結' : '分享 App'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--yz-dim)' }}>v0.1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
