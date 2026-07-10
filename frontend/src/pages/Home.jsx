import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star, Search, TrendingUp, TrendingDown, ShoppingBasket,
  Building2, RefreshCw, BrainCircuit, ArrowUpRight, ArrowDownRight,
  Minus, Lock,
} from 'lucide-react';
import './Home.css';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const BG_IMG = 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=1600&q=80';

const FEATURES = [
  { Icon: Star,           title: '今日好買推薦', desc: 'AI 每天分析批發行情，自動挑出價格偏低、值得現在採購的農產品。', to: '/search' },
  { Icon: Search,         title: '即時菜價查詢', desc: '輸入品項名稱，秒查全台各批發市場今日行情與 30 天走勢圖。',   to: '/search' },
  { Icon: TrendingUp,     title: 'AI 漲跌預測',  desc: '根據歷史資料與氣候模型，預測明天各品項漲或跌，信心度一目了然。', to: '/search' },
  { Icon: ShoppingBasket, title: '我的菜籃',     desc: '建立個人採購清單，每次開啟立刻看到「立刻買 / 等等看」的採買建議。', to: '/basket' },
];

const FEAT_COLORS = [
  { bg: '#FEF3C7', color: '#92400E' },
  { bg: '#E8F5EE', color: '#166534' },
  { bg: '#EFF6FF', color: '#1D4ED8' },
  { bg: '#F5F3FF', color: '#5B21B6' },
];

const MOCK_PRICES = [
  { product_name: '高麗菜', market_name: '台北一市', today_price: 14.3, status: '偏貴' },
  { product_name: '番茄',   market_name: '台北一市', today_price: 22.0, status: '正常' },
  { product_name: '地瓜葉', market_name: '台中市場', today_price: 6.8,  status: '便宜' },
];

const MOCK_BASKET = [
  { name: '空心菜', price: 8.5,  advice: '立刻買' },
  { name: '高麗菜', price: 14.3, advice: '等等看' },
  { name: '番茄',   price: 22.0, advice: '可以買' },
  { name: '苦瓜',   price: 12.0, advice: '立刻買' },
];

const NODE_DATA = [
  { cx: 52,  cy: 52,  label: '市場', sub: 'Market'   },
  { cx: 180, cy: 52,  label: '氣象', sub: 'Weather'  },
  { cx: 190, cy: 135, label: 'AI',   sub: 'Insights' },
  { cx: 115, cy: 178, label: '預測', sub: 'Predict'  },
  { cx: 42,  cy: 140, label: '行情', sub: 'Price'    },
];

function StatusChip({ status }) {
  const map = {
    '便宜': { cls: 'hm-chip hm-chip-low',  label: '便宜', Icon: TrendingDown },
    '正常': { cls: 'hm-chip hm-chip-mid',  label: '正常', Icon: Minus       },
    '偏貴': { cls: 'hm-chip hm-chip-high', label: '偏高', Icon: TrendingUp  },
  };
  const m = map[status] ?? map['正常'];
  return <span className={m.cls}><m.Icon size={11} />{m.label}</span>;
}

function AdviceTag({ advice }) {
  const cls = advice === '立刻買' ? 'hm-adv hm-adv-buy'
    : advice === '等等看'        ? 'hm-adv hm-adv-wait'
    : 'hm-adv hm-adv-ok';
  return <span className={cls}>{advice}</span>;
}

function SectionHeader({ kicker, title, sub }) {
  return (
    <div className="hm-sec-header">
      <div className="hm-kicker">{kicker}</div>
      <h2 className="hm-sec-h">{title}</h2>
      {sub && <p className="hm-sec-sub">{sub}</p>}
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [homeData, setHomeData] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loadingHome, setLoadingHome] = useState(true);
  const [loadingPred, setLoadingPred] = useState(true);
  const [searchQ, setSearchQ] = useState('');

  useEffect(() => {
    fetch(`${API}/api/home`)
      .then(r => r.json())
      .then(d => setHomeData(d))
      .catch(() => {})
      .finally(() => setLoadingHome(false));

    fetch(`${API}/api/predictions/direction?limit=4`)
      .then(r => r.json())
      .then(d => setPredictions(Array.isArray(d) ? d.slice(0, 4) : []))
      .catch(() => {})
      .finally(() => setLoadingPred(false));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    let raf;

    canvas.width  = container.offsetWidth  || 1200;
    canvas.height = container.offsetHeight || 440;

    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pts = Array.from({ length: 55 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .4, vy: (Math.random() - .5) * .4,
      r: Math.random() * 1.8 + .8,
    }));

    function frame() {
      ctx.clearRect(0, 0, W, H);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        ctx.fill();
      });
      pts.forEach((a, i) => {
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 90) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(255,255,255,${.12 * (1 - d / 90)})`;
            ctx.lineWidth = .6;
            ctx.stroke();
          }
        }
      });
      raf = requestAnimationFrame(frame);
    }
    frame();
    return () => cancelAnimationFrame(raf);
  }, []);

  const recs = homeData?.recommendations ?? [];

  function diffPct(item) {
    const avg = item.recent_average, today = item.today_price;
    if (!avg || !today) return null;
    return Math.round((today - avg) / avg * 100);
  }

  function handleSearch(e) {
    e.preventDefault();
    navigate(searchQ.trim() ? `/search?q=${encodeURIComponent(searchQ.trim())}` : '/search');
  }

  return (
    <div className="yz-page">

      {/* ── HERO ── */}
      <div className="hm-hero" style={{ backgroundImage: `url(${BG_IMG})` }}>
        <canvas ref={canvasRef} className="hm-hero-canvas" aria-hidden="true" />
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
                <TrendingUp size={15} />探索市場趨勢
              </button>
              <button className="hm-btn-sec" onClick={() => navigate('/news')}>
                查看最新摘要
              </button>
            </div>
          </div>

          <div className="hm-hero-right" aria-hidden="true">
            <svg width="230" height="210" viewBox="0 0 230 210" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="hm-ng" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#22C55E" stopOpacity=".35" />
                  <stop offset="100%" stopColor="#15803D" stopOpacity="0"   />
                </radialGradient>
              </defs>
              <circle cx="115" cy="105" r="70" fill="url(#hm-ng)" />
              {NODE_DATA.map(n => (
                <line key={n.label} x1="115" y1="105" x2={n.cx} y2={n.cy}
                  stroke="rgba(134,239,172,.3)" strokeWidth="1" />
              ))}
              {NODE_DATA.map(n => (
                <g key={n.label}>
                  <circle cx={n.cx} cy={n.cy} r="22"
                    fill="rgba(255,255,255,.07)" stroke="rgba(134,239,172,.45)" strokeWidth="1" />
                  <text x={n.cx} y={n.cy - 3} textAnchor="middle"
                    fontSize="9" fontWeight="500" fill="rgba(255,255,255,.85)"
                    fontFamily="-apple-system,sans-serif">{n.label}</text>
                  <text x={n.cx} y={n.cy + 9} textAnchor="middle"
                    fontSize="7.5" fill="rgba(255,255,255,.45)"
                    fontFamily="-apple-system,sans-serif">{n.sub}</text>
                </g>
              ))}
              <circle cx="115" cy="105" r="36" fill="rgba(21,128,61,.3)"  stroke="rgba(134,239,172,.7)"  strokeWidth="1.5" />
              <circle cx="115" cy="105" r="24" fill="rgba(21,128,61,.4)"  stroke="rgba(134,239,172,.9)"  strokeWidth="1"   />
              <text x="115" y="101" textAnchor="middle" fontSize="14" fontWeight="700"
                fill="#fff" fontFamily="-apple-system,sans-serif">AI</text>
              <text x="115" y="115" textAnchor="middle" fontSize="8"
                fill="rgba(255,255,255,.65)" fontFamily="-apple-system,sans-serif">SmartBuy</text>
            </svg>
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

      {/* ── 功能總覽 ── */}
      <div className="hm-sec">
        <SectionHeader
          kicker="核心功能"
          title="讓數據說話，讓 AI 幫你看見趨勢"
          sub="從市場行情、批發量到天氣影響，我們提供最完整的農業市場洞察，陪伴你每一個重要決策。"
        />
        <div className="hm-feat-grid">
          {FEATURES.map(({ Icon, title, desc, to }, i) => (
            <div key={title} className="yz-card hm-feat-card" onClick={() => navigate(to)}>
              <div className="hm-feat-ico" style={{ background: FEAT_COLORS[i].bg }}>
                <Icon size={22} color={FEAT_COLORS[i].color} />
              </div>
              <div className="hm-feat-title">{title}</div>
              <div className="hm-feat-desc">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 今日好買 ── */}
      <div className="hm-sec hm-sec-alt">
        <SectionHeader
          kicker="今日好買"
          title="現在採購最划算的農產品"
          sub="根據今日批發行情篩選，較近期均價低 15% 以上的品項才會出現在這裡。"
        />
        <div className="hm-bargain-grid">
          {loadingHome
            ? [0, 1, 2].map(k => <div key={k} className="hm-skel" style={{ height: 130 }} />)
            : recs.slice(0, 3).map(item => {
                const pct = diffPct(item);
                return (
                  <div key={item.product_name} className="hm-b-card">
                    <div className="hm-b-top">
                      <span className="yz-bdg yz-bdg-o hm-b-badge">
                        <Star size={11} />今日推薦
                      </span>
                      <div className="hm-b-name">{item.product_name}</div>
                      <div className="hm-b-mkt">{item.market_name ?? '—'}</div>
                    </div>
                    <div className="hm-b-bot">
                      <span className="hm-b-price">{item.today_price ?? '—'}</span>
                      <span className="hm-b-unit"> 元/斤</span>
                      {pct !== null && (
                        <div className="hm-b-vs">
                          <TrendingDown size={12} />
                          較均價{pct < 0 ? `低 ${Math.abs(pct)}%` : `高 ${pct}%`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
          }
        </div>
      </div>

      {/* ── 菜價搜尋 ── */}
      <div className="hm-sec">
        <SectionHeader
          kicker="菜價查詢"
          title="任何品項，即時查詢今日行情"
          sub="輸入蔬果名稱，查詢今日全台各市場的批發行情與偏高偏低狀態。"
        />
        <div className="hm-search-wrap">
          <form className="hm-search-bar" onSubmit={handleSearch}>
            <input
              className="yz-input hm-search-input"
              type="text"
              placeholder="搜尋蔬果，例：高麗菜、番茄..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              aria-label="搜尋蔬果"
            />
            <button type="submit" className="yz-btn yz-btn-g hm-search-btn">
              <Search size={15} />搜尋
            </button>
          </form>
          <div className="hm-plist">
            {MOCK_PRICES.map(p => (
              <div key={p.product_name} className="hm-prow">
                <div className="hm-prow-l">
                  <div className="hm-prow-ico"><Search size={16} color="var(--yz-g)" /></div>
                  <div>
                    <div className="hm-prow-name">{p.product_name}</div>
                    <div className="hm-prow-mkt">{p.market_name} · 今日</div>
                  </div>
                </div>
                <div className="hm-prow-r">
                  <div className="hm-prow-price">
                    {p.today_price} <span className="hm-prow-unit">元/斤</span>
                  </div>
                  <StatusChip status={p.status} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button className="yz-btn yz-btn-out" onClick={() => navigate('/search')}>
              查看全部品項 →
            </button>
          </div>
        </div>
      </div>

      {/* ── AI 預測 ── */}
      <div className="hm-sec hm-sec-alt">
        <SectionHeader
          kicker="AI 漲跌預測"
          title="明天買還是等一等？AI 幫你判斷"
          sub="根據歷史行情與氣候資料，預測明天各品項的價格走向。"
        />
        <div className="hm-pred-grid">
          {loadingPred
            ? [0, 1, 2, 3].map(k => <div key={k} className="hm-skel" style={{ height: 80 }} />)
            : predictions.length > 0
              ? predictions.map(p => {
                  const isUp   = p.pred_label_name === '漲';
                  const isFlat = p.pred_label_name === '持平';
                  return (
                    <div key={`${p.crop_name}-${p.market_name}`} className="hm-pred-card">
                      <div className={`hm-pd ${isUp ? 'hm-pd-up' : isFlat ? 'hm-pd-flat' : 'hm-pd-dn'}`}>
                        {isUp ? <ArrowUpRight size={18} />
                          : isFlat ? <Minus size={18} />
                          : <ArrowDownRight size={18} />}
                      </div>
                      <div>
                        <div className="hm-pred-name">{p.crop_name}</div>
                        <div className={`hm-pred-lbl ${isUp ? 'lbl-up' : isFlat ? 'lbl-flat' : 'lbl-dn'}`}>
                          明日可能{p.pred_label_name}
                        </div>
                        <div className="hm-pred-conf">
                          信心度 {Math.round((p.pred_confidence ?? 0) * 100)}%
                        </div>
                      </div>
                    </div>
                  );
                })
              : (
                <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--yz-mut)', fontSize: 13 }}>
                  暫無預測資料
                </p>
              )
          }
        </div>
      </div>

      {/* ── 我的菜籃 ── */}
      <div className="hm-sec">
        <SectionHeader
          kicker="我的菜籃"
          title="建立採購清單，一鍵查看建議"
          sub="把常買的蔬果加入菜籃，每次開啟立刻看到今日採買建議。"
        />
        <div className="yz-card hm-basket-card">
          <div className="hm-basket-hd">
            <div className="hm-basket-title">
              <ShoppingBasket size={17} color="var(--yz-g)" />
              本週採買清單
              <span className="yz-bdg yz-bdg-g">{MOCK_BASKET.length} 樣</span>
            </div>
            <button className="yz-btn yz-btn-gho yz-btn-sm" onClick={() => navigate('/basket')}>
              管理菜籃
            </button>
          </div>
          <div className="hm-basket-items">
            {MOCK_BASKET.map(item => (
              <div key={item.name} className="hm-bitem">
                <span className="hm-bitem-name">{item.name}</span>
                <div className="hm-bitem-r">
                  <span className="hm-bitem-price">{item.price} 元/斤</span>
                  <AdviceTag advice={item.advice} />
                </div>
              </div>
            ))}
          </div>
          <div className="hm-basket-hint">
            <Lock size={13} />
            登入後可儲存菜籃、接收價格通知
          </div>
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
