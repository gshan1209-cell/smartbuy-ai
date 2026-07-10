import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, TrendingUp, TrendingDown, Newspaper,
  Users, Building2, RefreshCw, BrainCircuit,
  Minus, MapPin, ArrowRight, BarChart2,
} from 'lucide-react';
import './Home.css';

const BG_IMG = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1600&q=80';

const FEATURES = [
  { num: '01', title: '售價動態',  desc: '查詢全台批發市場今日行情、30 天走勢，掌握每樣蔬果最新售價。',             to: '/search' },
  { num: '02', title: '農產新知',  desc: '彙整農業部公告、氣象週報與市場動態，一站掌握農業脈動。',                  to: '/news' },
  { num: '03', title: '互助網',    desc: '農友互助社群，滯銷急售、求助人手、資訊分享一鍵發佈，鄰里相挺。',          to: '/mutual-aid' },
];

// mock 7-day price trend for 高麗菜（元/斤）
const CHART_DATA = [
  { day: '6/24', price: 19.5 },
  { day: '6/25', price: 17.8 },
  { day: '6/26', price: 20.2 },
  { day: '6/27', price: 16.4 },
  { day: '6/28', price: 15.0 },
  { day: '6/29', price: 13.8 },
  { day: '6/30', price: 14.3 },
];

const MOCK_NEWS = [
  { id: 1, tag: '節氣', title: '小暑將至，葉菜類如何度過高溫期',       date: '2026-06-28', source: '農業氣象週報' },
  { id: 2, tag: '市場', title: '本季蔬果外銷動態：東南亞市場需求上升', date: '2026-06-25', source: '農業貿易情報' },
  { id: 3, tag: '農技', title: '甘藍輪作全攻略：如何避免地力衰退',     date: '2026-06-15', source: '農業試驗所' },
];

const POST_TYPE_COLORS = {
  '滯銷急售': { bg: '#FEF3C7', color: '#92400E' },
  '求助':     { bg: '#FEE2E2', color: '#991B1B' },
  '資訊分享': { bg: '#E8F5EE', color: '#166534' },
};

function StatusChip({ status }) {
  const map = {
    '便宜': { cls: 'hm-chip hm-chip-low',  label: '便宜', Icon: TrendingDown },
    '正常': { cls: 'hm-chip hm-chip-mid',  label: '正常', Icon: Minus       },
    '偏貴': { cls: 'hm-chip hm-chip-high', label: '偏高', Icon: TrendingUp  },
  };
  const m = map[status] ?? map['正常'];
  return <span className={m.cls}><m.Icon size={12} />{m.label}</span>;
}

function PriceLineChart() {
  const W = 300, H = 130;
  const pad = { t: 16, r: 20, b: 28, l: 36 };
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;
  const prices = CHART_DATA.map(d => d.price);
  const min = Math.min(...prices) - 1.5;
  const max = Math.max(...prices) + 1.5;

  const px = i => pad.l + (i / (prices.length - 1)) * cw;
  const py = v => pad.t + ch - ((v - min) / (max - min)) * ch;

  const linePoints = prices.map((v, i) => `${px(i)},${py(v)}`).join(' ');
  const fillPoints = `${px(0)},${H - pad.b} ${linePoints} ${px(prices.length - 1)},${H - pad.b}`;

  const last = prices[prices.length - 1];
  const prev = prices[prices.length - 2];
  const diff = ((last - prev) / prev * 100).toFixed(1);
  const isDown = last < prev;

  return (
    <div className="hm-chart-wrap">
      <div className="hm-chart-header">
        <div>
          <div className="hm-chart-name">高麗菜</div>
          <div className="hm-chart-sub">近 7 日批發走勢</div>
        </div>
        <div className="hm-chart-cur">
          <div className="hm-chart-price">{last} <span>元/斤</span></div>
          <div className={`hm-chart-diff ${isDown ? 'down' : 'up'}`}>
            {isDown ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            {Math.abs(diff)}%
          </div>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hm-cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16A34A" stopOpacity=".22" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* grid lines */}
        {[0, 0.5, 1].map(t => (
          <line key={t}
            x1={pad.l} y1={pad.t + ch * (1 - t)}
            x2={W - pad.r} y2={pad.t + ch * (1 - t)}
            stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4 3"
          />
        ))}
        {/* fill */}
        <polygon points={fillPoints} fill="url(#hm-cg)" />
        {/* line */}
        <polyline points={linePoints} fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* dots */}
        {prices.map((v, i) => (
          <circle key={i} cx={px(i)} cy={py(v)} r={i === prices.length - 1 ? 5 : 3}
            fill={i === prices.length - 1 ? '#16A34A' : '#fff'}
            stroke="#16A34A" strokeWidth="2"
          />
        ))}
        {/* x labels */}
        {CHART_DATA.filter((_, i) => i === 0 || i === 3 || i === 6).map((d, _, arr) => {
          const idx = CHART_DATA.indexOf(d);
          return (
            <text key={d.day} x={px(idx)} y={H - 4} textAnchor="middle"
              fontSize="9" fill="#9CA3AF" fontFamily="-apple-system,sans-serif">
              {d.day}
            </text>
          );
        })}
        {/* y label */}
        <text x={pad.l - 6} y={py(last)} textAnchor="end" dominantBaseline="middle"
          fontSize="9" fill="#16A34A" fontWeight="700" fontFamily="-apple-system,sans-serif">
          {last}
        </text>
      </svg>
    </div>
  );
}

function PublishMockup() {
  const types = ['滯銷急售', '求助', '資訊分享'];
  return (
    <div className="hm-publish-card">
      <div className="hm-publish-hd">
        <div className="hm-publish-avatar">阿</div>
        <div className="hm-publish-info">
          <div className="hm-publish-author">阿仁 · 雲林縣</div>
          <div className="hm-publish-date">剛剛</div>
        </div>
      </div>
      <div className="hm-publish-types">
        {types.map((t, i) => {
          const tc = POST_TYPE_COLORS[t];
          return (
            <span key={t} className={`hm-pub-type ${i === 0 ? 'active' : ''}`}
              style={i === 0 ? { background: tc.bg, color: tc.color, borderColor: tc.color } : {}}>
              {t}
            </span>
          );
        })}
      </div>
      <div className="hm-publish-textarea">
        絲瓜盛產產量過大，還有 300 斤賣不掉，願意用市價六折出清，也歡迎以物易物…
      </div>
      <button className="hm-publish-btn">發布貼文</button>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [searchQ, setSearchQ] = useState('');

  function handleSearch(e) {
    e.preventDefault();
    navigate(searchQ.trim() ? `/search?q=${encodeURIComponent(searchQ.trim())}` : '/search');
  }

  return (
    <div className="yz-page">

      {/* ── HERO ── */}
      <div className="hm-hero" style={{ backgroundImage: `url(${BG_IMG})` }}>
        <div className="hm-hero-overlay" />
        <div className="hm-hero-inner">
          <div className="hm-hero-left">
            <div className="hm-hero-kicker">
              <span className="hm-kicker-dot" />
              AI × 農業市場情報
            </div>
            <h1 className="hm-hero-h1">
              用數據與 AI<br />
              解讀<em>農業市場</em><br />
              做出更好的每一步
            </h1>
            <p className="hm-hero-sub">
              整合批發市場、氣象資料與 AI 智慧分析，提供農民、農業從業者與研究人員最可靠的市場洞察。
            </p>
            <div className="hm-hero-btns">
              <button className="hm-btn-pri" onClick={() => navigate('/search')}>
                <TrendingUp size={16} />探索市場趨勢
              </button>
              <button className="hm-btn-sec" onClick={() => navigate('/news')}>
                查看最新摘要
              </button>
            </div>
          </div>
        </div>

        <div className="hm-stats-bar">
          {[
            { Icon: Search,       num: '120+', label: '追蹤農產品項' },
            { Icon: Building2,    num: '30+',  label: '全台批發市場' },
            { Icon: RefreshCw,    num: '每日', label: '行情自動更新' },
            { Icon: BrainCircuit, num: 'AI',   label: '漲跌智慧預測' },
          ].map(({ Icon, num, label }) => (
            <div key={label} className="hm-stat">
              <div className="hm-stat-ico"><Icon size={15} color="#86EFAC" /></div>
              <div>
                <div className="hm-stat-num">{num}</div>
                <div className="hm-stat-lbl">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 核心功能（圖1 style）── */}
      <div className="hm-feats-wrap">
        <div className="hm-feats-inner">
          <div className="hm-feats-title-col">
            <div className="hm-kicker">核心功能</div>
            <h2 className="hm-feats-h">三大核心<br />工具</h2>
            <p className="hm-feats-sub">從市場行情到農友互助，提供最完整的農業市場洞察，陪伴每一個重要決策。</p>
          </div>
          <div className="hm-feats-divider" />
          <div className="hm-feats-list">
            {FEATURES.map(({ num, title, desc, to }) => (
              <div key={title} className="hm-feat-item" onClick={() => navigate(to)}>
                <div className="hm-feat-num">{num}</div>
                <div>
                  <div className="hm-feat-item-title">{title}</div>
                  <div className="hm-feat-item-desc">{desc}</div>
                </div>
                <ArrowRight size={18} className="hm-feat-arrow" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 售價動態（折線圖 left, text right）── */}
      <div className="hm-split">
        <div className="hm-split-visual hm-split-green">
          <div className="hm-split-card">
            <PriceLineChart />
            <div className="hm-chart-footer">
              <BarChart2 size={13} color="var(--yz-g)" />
              <span>點擊查詢任意品項的完整走勢</span>
            </div>
          </div>
        </div>
        <div className="hm-split-text">
          <div className="hm-kicker">售價動態</div>
          <h2 className="hm-sec-h">掌握行情，從容決策</h2>
          <p className="hm-sec-sub hm-sec-sub-left">
            查詢全台各批發市場今日行情、偏高偏低狀態與 30 天走勢，讓每一次採購都有數據支撐。
          </p>
          <form className="hm-search-bar" onSubmit={handleSearch}>
            <input
              className="yz-input hm-search-input"
              type="text"
              placeholder="搜尋蔬果，例：高麗菜..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
            <button type="submit" className="yz-btn yz-btn-g hm-search-btn">
              <Search size={15} />搜尋
            </button>
          </form>
          <button className="hm-link-btn" onClick={() => navigate('/search')}>
            查看全部行情 <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* ── 農產新知（text left, 文章卡 right）── */}
      <div className="hm-split hm-split-rev">
        <div className="hm-split-text">
          <div className="hm-kicker">農產新知</div>
          <h2 className="hm-sec-h">掌握農業脈動，搶先一步</h2>
          <p className="hm-sec-sub hm-sec-sub-left">
            彙整農業部最新公告、氣象週報與市場動態，讓你不錯過任何影響採購決策的重要訊息。
          </p>
          <button className="hm-link-btn" style={{ marginTop: 24 }} onClick={() => navigate('/news')}>
            閱讀更多農產新知 <ArrowRight size={15} />
          </button>
        </div>
        <div className="hm-split-visual hm-split-amber">
          <div className="hm-split-card">
            <div className="hm-mini-card-title">最新農業資訊</div>
            {MOCK_NEWS.map(a => (
              <div key={a.id} className="hm-mini-article">
                <span className="hm-mini-tag">{a.tag}</span>
                <div className="hm-mini-article-title">{a.title}</div>
                <div className="hm-mini-article-meta">{a.source} · {a.date}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 互助網（發布 UI left, text right）── */}
      <div className="hm-split">
        <div className="hm-split-visual hm-split-teal">
          <PublishMockup />
        </div>
        <div className="hm-split-text">
          <div className="hm-kicker">互助網</div>
          <h2 className="hm-sec-h">農友互助，共好共榮</h2>
          <p className="hm-sec-sub hm-sec-sub-left">
            滯銷急售、求助人手、資訊分享——農友社群讓你不孤軍奮戰，鄰里相挺讓農業更有溫度。
          </p>
          <button className="hm-link-btn" style={{ marginTop: 24 }} onClick={() => navigate('/mutual-aid')}>
            加入互助網 <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* ── 頁尾 CTA ── */}
      <div className="hm-footer-cta">
        <h2 className="hm-footer-h">免費加入，天天省菜錢</h2>
        <p className="hm-footer-sub">
          加入會員，儲存個人菜籃、接收偏愛品項的價格異動通知<br />
          讓 AI 幫你做出更聰明的採購決策
        </p>
        <div className="hm-footer-btns">
          <button className="hm-cta-pri" onClick={() => navigate('/register')}>免費立即加入</button>
          <button className="hm-cta-sec" onClick={() => navigate('/search')}>了解更多功能</button>
        </div>
      </div>

    </div>
  );
}
