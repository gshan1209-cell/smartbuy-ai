import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// 功能預覽卡：to/ready 對應目前實際可用的路由，尚未重做完成的頁面先標示「即將推出」
const FEATURES = [
  { icon: '📊', title: '售價動態', desc: '即時批發行情、走勢圖表與 AI 價格預測', to: '/search', ready: true },
  { icon: '📰', title: '農產新知', desc: '同步農業部公告，掌握最新農業資訊', to: '/news', ready: true },
  { icon: '🤝', title: '互助網', desc: '滯銷、急銷媒合，農民互相幫一把', to: '/mutual-aid', ready: true },
  { icon: '🧺', title: '我的菜籃', desc: '加入常買品項，一鍵查看採買建議', to: '/basket', ready: true },
  { icon: '⚙️', title: '設定', desc: '管理追蹤品項與推播通知偏好', to: '/settings', ready: true },
];

function FeatureCard({ feature, onNavigate }) {
  return (
    <div
      className="yz-card"
      style={{ padding: '20px 22px', cursor: feature.ready ? 'pointer' : 'default', opacity: feature.ready ? 1 : .6 }}
      onClick={() => feature.ready && onNavigate(feature.to)}
    >
      <span style={{ fontSize: 26 }}>{feature.icon}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 6 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>{feature.title}</h3>
        {!feature.ready && <span className="yz-bdg yz-bdg-gr">即將推出</span>}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--yz-mut)', lineHeight: 1.6, marginBottom: 12 }}>{feature.desc}</p>
      {feature.ready && <span style={{ fontSize: 12, color: 'var(--yz-g)', fontWeight: 600 }}>前往 →</span>}
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError(false);
    try {
      await login(form.email, form.password);
      navigate('/search');
    } catch {
      setLoginError(true);
    }
  }

  return (
    <div className="yz-page">
      {/* Hero */}
      <div style={{ background: 'linear-gradient(138deg,#E3F4ED 0%,#F7F4EF 52%,#FDF8EC 100%)', padding: '60px 40px 52px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: isAuthenticated ? '1fr' : '1fr 370px', gap: 64, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #C2E5D5', borderRadius: 99, padding: '5px 14px', marginBottom: 22 }}>
              <span style={{ width: 7, height: 7, background: 'var(--yz-g)', borderRadius: '50%' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--yz-gd)' }}>農民決策支援平台</span>
            </div>
            <h1 style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.18, letterSpacing: '-.025em', marginBottom: 18 }}>
              即時批發行情<br /><span style={{ color: 'var(--yz-g)' }}>讓每個決策</span><br />有數據支撐
            </h1>
            <p style={{ fontSize: 15, color: 'var(--yz-mut)', lineHeight: 1.75, maxWidth: 420, marginBottom: 28 }}>
              整合農業部 MOA 每日批發價格，提供售價趨勢分析、農民互助網與農產新知，協助農民與消費者做出更明智的決策。
            </p>
            {!isAuthenticated && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 42 }}>
                <button className="yz-btn yz-btn-g" style={{ padding: '12px 28px', fontSize: 14 }} onClick={() => document.getElementById('yz-login-card')?.scrollIntoView({ behavior: 'smooth' })}>成為訂閱夥伴</button>
                <button className="yz-btn yz-btn-gho" style={{ padding: '12px 28px', fontSize: 14 }} onClick={() => navigate('/search')}>訪客瀏覽 →</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 40, paddingTop: 26, borderTop: '1px solid #C0DECE' }}>
              <div><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--yz-g)' }}>800+</div><div style={{ fontSize: 12, color: 'var(--yz-mut)', marginTop: 2 }}>批發品項</div></div>
              <div><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--yz-g)' }}>30+</div><div style={{ fontSize: 12, color: 'var(--yz-mut)', marginTop: 2 }}>批發市場</div></div>
              <div><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--yz-g)' }}>每日</div><div style={{ fontSize: 12, color: 'var(--yz-mut)', marginTop: 2 }}>自動更新</div></div>
            </div>
          </div>

          {!isAuthenticated && (
            <div id="yz-login-card" className="yz-card" style={{ padding: '28px 30px' }}>
              <p style={{ fontSize: 12, color: 'var(--yz-mut)', marginBottom: 4 }}>歡迎回來</p>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 22 }}>登入以使用完整功能</h3>
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 14 }}>
                  <label htmlFor="yz-login-email" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--yz-mut)', marginBottom: 6 }}>帳號 / Email</label>
                  <input id="yz-login-email" className="yz-input" type="email" placeholder="farmer@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label htmlFor="yz-login-password" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--yz-mut)', marginBottom: 6 }}>密碼</label>
                  <input id="yz-login-password" className="yz-input" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                {loginError && <p style={{ fontSize: 12, color: 'var(--yz-re)', marginBottom: 10 }}>Email 或密碼錯誤，請再試一次</p>}
                <button className="yz-btn yz-btn-g" style={{ width: '100%', padding: 11, fontSize: 14 }} type="submit">登入</button>
              </form>
              <div style={{ height: 1, background: 'var(--yz-bdr)', margin: '16px 0' }} />
              <button className="yz-btn yz-btn-gho" style={{ width: '100%', fontSize: 13 }} onClick={() => navigate('/search')}>訪客瀏覽（不需帳號）</button>
            </div>
          )}
        </div>
      </div>

      {/* Feature overview */}
      <div style={{ padding: '44px 40px 56px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>站內功能</h2>
          <p style={{ fontSize: 13, color: 'var(--yz-mut)', marginBottom: 20 }}>快速了解優值生鮮情報站能幫你做什麼</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16 }}>
            {FEATURES.map(f => (
              <FeatureCard key={f.to} feature={f} onNavigate={navigate} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
