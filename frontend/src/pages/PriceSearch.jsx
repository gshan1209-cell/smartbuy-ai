import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi, get } from '../hooks/useApi';
import Chart from 'chart.js/auto';
import { fetchFavorites, addFavorite, removeFavorite } from '../lib/favoritesService';

const FEATURED_COUNT = 20;
const STATUS_RANK = { '便宜': 0, '正常': 1, '偏貴': 2, '資料不足': 3 };

const STATUS_BADGE = {
  '便宜': 'yz-bdg-g',
  '正常': 'yz-bdg-gr',
  '偏貴': 'yz-bdg-o',
  '資料不足': 'yz-bdg-gr',
};

const STATUS_ARROW = {
  '便宜': { arrow: '↓', color: '#16A34A' },
  '偏貴': { arrow: '↑', color: '#DC2626' },
  '正常': { arrow: '→', color: '#888' },
  '資料不足': { arrow: '·', color: '#9B9A90' },
};

// ── 市場選擇器 ────────────────────────────────────────────────────────────────

function MarketSelector({ markets, market, onChange }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = markets.filter(m => !input || m.includes(input));

  function select(m) {
    onChange(m);
    setOpen(false);
    setInput('');
  }

  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: 12 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
          background: 'var(--yz-gl)', border: '1px solid var(--yz-bdr)',
          fontSize: 14, fontWeight: 600, color: 'var(--yz-txt)',
          minWidth: 220,
        }}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>{market || '選擇市場'}</span>
        <span style={{ fontSize: 11, color: 'var(--yz-mut)' }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          background: '#fff', border: '1px solid var(--yz-bdr)', borderRadius: 8,
          zIndex: 20, minWidth: 320, maxWidth: 520, boxShadow: '0 4px 16px rgba(0,0,0,.1)',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--yz-bdr)' }}>
            <input
              className="yz-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="搜尋市場..."
              autoFocus
              style={{ fontSize: 13 }}
            />
          </div>
          <div style={{ padding: '10px 12px', maxHeight: 280, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--yz-mut)', padding: '4px 2px' }}>無符合市場</div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {filtered.map(m => (
                <button
                  key={m}
                  onMouseDown={() => select(m)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', border: '1.5px solid',
                    background: m === market ? 'var(--yz-g)' : 'transparent',
                    color: m === market ? '#fff' : 'var(--yz-mut)',
                    borderColor: m === market ? 'var(--yz-g)' : 'var(--yz-bdr)',
                  }}
                >{m}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 本週市場情報區塊 ────────────────────────────────────────────────────────────

const MOCK_VOLATILITY = [
  { crop_name: '甘藍', volatility_pct: 8.2, is_anomaly: false },
  { crop_name: '芒果', volatility_pct: 22.5, is_anomaly: true },
  { crop_name: '番茄', volatility_pct: 11.4, is_anomaly: false },
  { crop_name: '青蔥', volatility_pct: 19.8, is_anomaly: true },
  { crop_name: '蘿蔔', volatility_pct: 6.3, is_anomaly: false },
  { crop_name: '香蕉', volatility_pct: 14.1, is_anomaly: false },
  { crop_name: '辣椒', volatility_pct: 28.7, is_anomaly: true },
  { crop_name: '菠菜', volatility_pct: 9.6, is_anomaly: false },
];

function RiskGauge({ value, color }) {
  const r = 34;
  const cx = 40;
  const cy = 40;
  const circumference = Math.PI * r;
  const filled = Math.min(Math.max(value || 0, 0), 1) * circumference;
  return (
    <svg viewBox="0 0 80 44" width="80" height="44" style={{ display: 'block', margin: '6px 0 4px' }}>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#E5E7EB" strokeWidth="6" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>
        {value != null ? value.toFixed(2) : '—'}
      </text>
    </svg>
  );
}

function VolatilityBarChart({ items }) {
  const THRESHOLD = 15;
  const maxVal = Math.max(...items.map(i => i.volatility_pct), THRESHOLD + 2);
  const H = 100;
  const PAD_B = 20;
  const chartH = H - PAD_B;
  const barW = Math.max(12, Math.floor((100 / items.length) * 0.6));

  return (
    <svg viewBox={`0 0 100 ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
      {/* 閾值虛線 */}
      {(() => {
        const y = chartH - (THRESHOLD / maxVal) * chartH;
        return (
          <line x1="0" y1={y} x2="100" y2={y}
            stroke="#F59E0B" strokeWidth="0.8" strokeDasharray="2,2" />
        );
      })()}
      {items.map((item, i) => {
        const x = (i / items.length) * 100 + (100 / items.length) * 0.2;
        const barH = (item.volatility_pct / maxVal) * chartH;
        const y = chartH - barH;
        return (
          <g key={item.crop_name}>
            <rect x={x} y={y} width={barW} height={barH}
              fill={item.is_anomaly ? '#F59E0B' : '#D1D5DB'} rx="1" />
            <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize="4.5" fill="#9CA3AF">
              {item.crop_name.slice(0, 2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function MarketIntelPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    get('/api/market-intel')
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!data || !chartRef.current) return;
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    const gainers = (data.gainers || []).slice().reverse();
    const losers = (data.losers || []).slice();
    const allItems = [...gainers, ...losers];
    const labels = allItems.map(i => i.crop_name);
    const values = allItems.map(i => Math.round((i.price_return_7 || 0) * 1000) / 10);
    const colors = values.map(v => v >= 0 ? 'rgba(239,68,68,0.8)' : 'rgba(22,163,74,0.8)');
    const prices = allItems.map(i => i.today_price);

    chartInstance.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pct = ctx.raw > 0 ? `+${ctx.raw}%` : `${ctx.raw}%`;
                const price = prices[ctx.dataIndex];
                return [`7日漲跌：${pct}`, price != null ? `今日均價：${price} 元` : ''];
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { callback: v => `${v > 0 ? '+' : ''}${v}%`, font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          y: { ticks: { font: { size: 11 } } },
        },
      },
    });
    return () => { chartInstance.current?.destroy(); chartInstance.current = null; };
  }, [data]);

  if (loading) return (
    <div style={{ padding: '16px 20px', marginBottom: 16, background: 'var(--yz-gl)', borderRadius: 10, border: '1px solid var(--yz-bdr)', fontSize: 12, color: 'var(--yz-mut)' }}>
      全台市場總覽載入中…
    </div>
  );

  if (!data || (!data.market_stability && !data.gainers)) return null;

  const { market_stability: ms, market_bias: mb, gainers = [], losers = [], alerts = [] } = data;
  const riskColor = ms?.risk_level === '高風險' ? '#DC2626' : ms?.risk_level === '中風險' ? '#D97706' : '#16A34A';
  const biasColor = mb?.bias === '偏多' ? '#DC2626' : mb?.bias === '偏空' ? '#16A34A' : '#6B7280';
  const volatilityItems = data.crop_volatility || MOCK_VOLATILITY;
  const normalCount = volatilityItems.filter(i => !i.is_anomaly).length;
  const cardLabel = { fontSize: 13, fontWeight: 700, color: 'var(--yz-dim)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8 };
  const cardText = { fontSize: 12, color: 'var(--yz-mut)', lineHeight: 1.7 };

  return (
    <div style={{ marginBottom: 20 }}>
      {/* 標題 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--yz-txt)' }}>全台市場總覽</span>
        {data.latest_trade_date && (
          <span style={{ fontSize: 10, color: 'var(--yz-dim)', marginLeft: 'auto' }}>
            資料日：{data.latest_trade_date}
          </span>
        )}
      </div>
      <p style={{ fontSize: 11, color: 'var(--yz-mut)', marginBottom: 14 }}>
        資料來源：全台批發市場（綜合統計），非當前市場專屬
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 2fr', gap: 10 }}>
        {/* 風險指數卡 */}
        <div className="yz-card" style={{ padding: '16px 18px' }}>
          <p style={cardLabel}>市場風險指數</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 32, fontWeight: 900, color: riskColor }}>{ms?.risk_index}</span>
            <span style={{ fontSize: 12, color: riskColor, fontWeight: 700 }}>{ms?.risk_level}</span>
          </div>
          <RiskGauge value={ms?.risk_index} color={riskColor} />
          <p style={{ ...cardText, fontSize: 10, lineHeight: 1.5, marginBottom: 6 }}>
            綜合近 7 日價格波動幅度與異常品項比例計算
          </p>
          {ms?.volatile_crops?.length > 0 && (
            <p style={{ ...cardText, fontSize: 11 }}>波動：{ms.volatile_crops.join('、')}</p>
          )}
          {ms?.stable_crops?.length > 0 && (
            <p style={{ ...cardText, fontSize: 11 }}>穩定：{ms.stable_crops.join('、')}</p>
          )}
        </div>

        {/* 多空偏向卡 */}
        <div className="yz-card" style={{ padding: '16px 18px' }}>
          <p style={cardLabel}>本週漲跌偏向</p>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 900, color: biasColor }}>
              {mb?.bias}
            </span>
            {mb?.bias && (
              <span style={{ fontSize: 12, color: 'var(--yz-mut)', marginLeft: 6 }}>
                （{mb.bias === '偏多' ? `看漲 ${mb?.bullish_count} 項` : `看跌 ${mb?.bearish_count} 項`}）
              </span>
            )}
          </div>
          <p style={cardText}>
            ↑ 看漲：<strong style={{ color: '#DC2626' }}>{mb?.bullish_count}</strong>
            {'  '}↓ 看跌：<strong style={{ color: '#16A34A' }}>{mb?.bearish_count}</strong>
          </p>
          {mb?.top_bullish?.length > 0 && (
            <p style={{ ...cardText, fontSize: 11, color: '#DC2626' }}>↑ {mb.top_bullish.join('、')}</p>
          )}
          {mb?.top_bearish?.length > 0 && (
            <p style={{ ...cardText, fontSize: 11, color: '#16A34A' }}>↓ {mb.top_bearish.join('、')}</p>
          )}
        </div>

        {/* 漲跌榜 Chart.js */}
        <div className="yz-card" style={{ padding: '16px 18px' }}>
          <p style={cardLabel}>漲幅榜 / 跌幅榜（7日）</p>
          <div style={{ height: 180 }}>
            <canvas ref={chartRef} />
          </div>
        </div>

        {/* 異常警報 */}
        <div className="yz-card" style={{ padding: '16px 18px', overflowY: 'auto', maxHeight: 260 }}>
          <p style={cardLabel}>異常警報</p>
          {alerts.length === 0 ? (
            <div>
              <p style={{ ...cardText, marginBottom: 10 }}>
                本週 <strong style={{ color: 'var(--yz-txt)' }}>{volatilityItems.length}</strong> 個品項中，
                <strong style={{ color: '#16A34A' }}>{normalCount}</strong> 項波動在正常範圍（±1.5σ）內
              </p>
              <VolatilityBarChart items={volatilityItems} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontSize: 10, color: 'var(--yz-mut)' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#D1D5DB', borderRadius: 2, verticalAlign: 'middle', marginRight: 3 }} />正常</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#F59E0B', borderRadius: 2, verticalAlign: 'middle', marginRight: 3 }} />異常（&gt;1.5σ）</span>
              </div>
            </div>
          ) : (
            alerts.map(a => (
              <div key={a.crop_name} style={{ padding: '8px 0', borderBottom: '1px solid var(--yz-bdr)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => navigate(`/product/${encodeURIComponent(a.crop_name)}`)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--yz-gd)', textDecoration: 'underline' }}
                  >
                    {a.crop_name}
                  </button>
                  <span className={`yz-bdg ${a.severity === 'high' ? 'yz-bdg-o' : 'yz-bdg-gr'}`}
                    style={a.severity === 'high' ? { background: '#FEF2F2', color: '#DC2626', borderColor: '#FCA5A5' } : {}}>
                    {a.status}
                  </span>
                  {a.divergence && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#92400E', background: '#FEF3C7', padding: '1px 6px', borderRadius: 4 }}>
                      {a.divergence}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'var(--yz-mut)' }}>
                  z={a.z_score > 0 ? '+' : ''}{a.z_score}
                  {' · '}7日{a.price_return_7 >= 0 ? '+' : ''}{Math.round(a.price_return_7 * 100)}%
                  {a.today_price != null && ` · ${a.today_price} 元`}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── 節氣條 ────────────────────────────────────────────────────────────────────

const SEASON_EMOJI = { 春: '🌱', 夏: '☀️', 秋: '🍂', 冬: '❄️' };
const TERM_SEASON = {
  立春: '春', 雨水: '春', 驚蟄: '春', 春分: '春', 清明: '春', 穀雨: '春',
  立夏: '夏', 小滿: '夏', 芒種: '夏', 夏至: '夏', 小暑: '夏', 大暑: '夏',
  立秋: '秋', 處暑: '秋', 白露: '秋', 秋分: '秋', 寒露: '秋', 霜降: '秋',
  立冬: '冬', 小雪: '冬', 大雪: '冬', 冬至: '冬', 小寒: '冬', 大寒: '冬',
};
const TERM_ORDER = [
  '春分','清明','穀雨','立夏','小滿','芒種','夏至','小暑','大暑',
  '立秋','處暑','白露','秋分','寒露','霜降','立冬','小雪','大雪',
  '冬至','小寒','大寒','立春','雨水','驚蟄',
];
function nextTermName(current) {
  const i = TERM_ORDER.indexOf(current);
  return i === -1 ? null : TERM_ORDER[(i + 1) % TERM_ORDER.length];
}
function _termDate(i, year) {
  const baseYear = i >= 19 ? year - 1 : year;
  return new Date(Date.UTC(baseYear, 2, 20) + i * 15.218 * 86400000);
}
function daysUntilNextTerm(currentTermName) {
  const todayUTC = new Date(); todayUTC.setUTCHours(0, 0, 0, 0);
  const year = todayUTC.getUTCFullYear();
  const ci = TERM_ORDER.indexOf(currentTermName);
  if (ci === -1) return null;
  const ni = (ci + 1) % TERM_ORDER.length;
  const refYear = ni < ci ? year + 1 : year;
  let d = _termDate(ni, refYear);
  if (d <= todayUTC) d = _termDate(ni, refYear + 1);
  return Math.round((d - todayUTC) / 86400000) || null;
}

function SolarTermStrip() {
  const { data: term, loading } = useApi('/api/solar-term');
  if (loading) return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--yz-gl)', border: '1px solid var(--yz-bdr)', borderRadius: 20, padding: '6px 14px', marginBottom: 14, fontSize: 12, color: 'var(--yz-mut)' }}>
      ⏳ 載入節氣…
    </div>
  );
  if (!term || term.error) return null;
  const season = TERM_SEASON[term.term_name];
  const emoji = SEASON_EMOJI[season] || '🌿';
  const resolvedNext = term.next_term_name || nextTermName(term.term_name);
  const days = term.days_until_next ?? daysUntilNextTerm(term.term_name);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--yz-gl)', border: '1px solid var(--yz-bdr)', borderRadius: 20, padding: '6px 14px' }}>
        <span style={{ fontSize: 15, lineHeight: 1 }}>{emoji}</span>
        <span style={{ fontSize: 11, color: 'var(--yz-mut)', fontWeight: 500 }}>現在節氣</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--yz-gd)' }}>{term.term_name}</span>
      </div>
      {resolvedNext && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#F7F4EF', border: '1px solid var(--yz-bdr)', borderRadius: 20, padding: '6px 14px' }}>
          <span style={{ fontSize: 11, color: 'var(--yz-mut)' }}>距</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--yz-txt)' }}>{resolvedNext}</span>
          {days != null && <>
            <span style={{ fontSize: 11, color: 'var(--yz-mut)' }}>還有</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--yz-gd)' }}>{days}</span>
            <span style={{ fontSize: 11, color: 'var(--yz-mut)' }}>天</span>
          </>}
        </div>
      )}
    </div>
  );
}

// ── 列表頁主體 ─────────────────────────────────────────────────────────────────

export default function PriceSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const market = searchParams.get('market') || '';
  const filterStatus = searchParams.get('filter') || '';
  const sortBy = searchParams.get('sort') || 'default';

  const [query, setQuery] = useState('');
  const [markets, setMarkets] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 500]);
  const [savedProductNames, setSavedProductNames] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchFavorites('product')
      .then(names => { if (!cancelled) setSavedProductNames(names); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function handleToggleSavedProduct(name) {
    if (savedProductNames.includes(name)) {
      setSavedProductNames(prev => prev.filter(n => n !== name));
      removeFavorite('product', name).catch(() => {});
    } else {
      setSavedProductNames(prev => [...prev, name]);
      addFavorite('product', name).catch(() => {});
    }
  }

  const updateParam = useCallback((key, value) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (value) p.set(key, value);
      else p.delete(key);
      return p;
    });
  }, [setSearchParams]);

  // 初始化：載入市場清單
  useEffect(() => {
    get('/api/markets').then(d => {
      const list = d.markets || [];
      setMarkets(list);
    }).catch(() => setMarkets([]));
  }, []); // eslint-disable-line

  // 每次 market / filterStatus 變化重新載入品項
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (market) params.set('market', market);
    get(`/api/products?${params.toString()}`)
      .then(data => setItems(data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [market]);

  function diffPct(item) {
    if (item.today_price == null || !item.recent_average) return null;
    return Math.round((item.today_price - item.recent_average) / item.recent_average * 100);
  }

  const processedItems = (() => {
    let list = filterStatus ? items.filter(i => i.status === filterStatus) : items;
    list = list.filter(i => i.today_price == null || (i.today_price >= priceRange[0] && i.today_price <= priceRange[1]));
    if (query.trim()) list = list.filter(i => i.product_name.includes(query.trim()));
    const [col, dir] = sortBy.includes(':') ? sortBy.split(':') : [sortBy, 'desc'];
    const asc = dir === 'asc';
    if (col === 'price') {
      list = [...list].sort((a, b) => asc ? (a.today_price ?? -1) - (b.today_price ?? -1) : (b.today_price ?? -1) - (a.today_price ?? -1));
    } else if (col === 'upper') {
      list = [...list].sort((a, b) => asc ? (a.upper_price ?? -1) - (b.upper_price ?? -1) : (b.upper_price ?? -1) - (a.upper_price ?? -1));
    } else if (col === 'lower') {
      list = [...list].sort((a, b) => asc ? (a.lower_price ?? -1) - (b.lower_price ?? -1) : (b.lower_price ?? -1) - (a.lower_price ?? -1));
    } else if (col === 'volume') {
      list = [...list].sort((a, b) => asc ? (a.volume ?? -1) - (b.volume ?? -1) : (b.volume ?? -1) - (a.volume ?? -1));
    } else if (col === 'diff' || col === 'diff_desc') {
      list = [...list].sort((a, b) => (diffPct(b) ?? -999) - (diffPct(a) ?? -999));
    } else if (col === 'diff_asc') {
      list = [...list].sort((a, b) => (diffPct(a) ?? 999) - (diffPct(b) ?? 999));
    } else if (col === 'diff7') {
      list = [...list].sort((a, b) => asc ? (diffPct(a) ?? -999) - (diffPct(b) ?? -999) : (diffPct(b) ?? -999) - (diffPct(a) ?? -999));
    } else {
      list = [...list].sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9));
    }
    return list;
  })();

  function handleColSort(colKey) {
    const [curCol, curDir] = sortBy.includes(':') ? sortBy.split(':') : [sortBy, 'desc'];
    if (curCol === colKey) {
      updateParam('sort', `${colKey}:${curDir === 'desc' ? 'asc' : 'desc'}`);
    } else {
      updateParam('sort', `${colKey}:desc`);
    }
  }

  function colSortIcon(colKey) {
    const [curCol, curDir] = sortBy.includes(':') ? sortBy.split(':') : [sortBy, ''];
    if (curCol !== colKey) return <span style={{ opacity: 0.25, fontSize: 9 }}>↕</span>;
    return <span style={{ fontSize: 9, color: 'var(--yz-g)' }}>{curDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const isFiltering = query.trim() !== '';
  const visibleItems = isFiltering || showAll || filterStatus
    ? processedItems
    : processedItems.slice(0, FEATURED_COUNT);

  function handleItemClick(name) {
    navigate(`/product/${encodeURIComponent(name)}?${searchParams.toString()}`);
  }

  return (
    <div className="yz-page yz-price-page" style={{ padding: '28px 40px 56px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <SolarTermStrip />

        {/* 全台市場總覽（置頂灰底區塊） */}
        <div style={{ background: 'var(--yz-gl)', borderTop: '1px solid var(--yz-bdr)', borderBottom: '1px solid var(--yz-bdr)', margin: '0 -40px 24px', padding: '20px 40px' }}>
          <MarketIntelPanel />
        </div>

        {/* 市場選擇器 */}
        <MarketSelector markets={markets} market={market} onChange={m => updateParam('market', m)} />

        {/* 篩選 + 搜尋 控制列 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <form onSubmit={e => e.preventDefault()} style={{ display: 'flex', gap: 6 }}>
            <input
              className="yz-input"
              placeholder="搜尋品項..."
              value={query}
              onChange={e => { setQuery(e.target.value); setShowAll(false); }}
              style={{ width: 160 }}
            />
          </form>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['', '全部'], ['便宜', '↓ 便宜'], ['正常', '→ 正常'], ['偏貴', '↑ 偏貴']].map(([val, label]) => (
              <button key={val} onClick={() => { updateParam('filter', val); setShowAll(false); }}
                style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                  background: filterStatus === val ? 'var(--yz-g)' : '#F7F4EF',
                  color: filterStatus === val ? '#fff' : 'var(--yz-mut)',
                  borderColor: filterStatus === val ? 'var(--yz-g)' : 'var(--yz-bdr)',
                }}
              >{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--yz-mut)' }}>
            <span>價格</span>
            <input type="range" min={0} max={500} step={5} value={priceRange[0]}
              onChange={e => setPriceRange([Math.min(Number(e.target.value), priceRange[1] - 5), priceRange[1]])}
              style={{ width: 80, accentColor: 'var(--yz-g)' }} />
            <span>{priceRange[0]}–{priceRange[1]}</span>
            <input type="range" min={0} max={500} step={5} value={priceRange[1]}
              onChange={e => setPriceRange([priceRange[0], Math.max(Number(e.target.value), priceRange[0] + 5)])}
              style={{ width: 80, accentColor: 'var(--yz-g)' }} />
            <span>元</span>
          </div>
        </div>

        {/* 品項計數標題 */}
        {!isFiltering && !filterStatus && (
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--yz-dim)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 6 }}>
            {showAll ? `全部品項（${items.length}）` : '精選品項'}
          </p>
        )}
        {filterStatus && !loading && (
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--yz-dim)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 6 }}>
            {filterStatus}（{processedItems.length} 項）
          </p>
        )}

        {/* 品項列表 */}
        <div style={{ border: '1px solid var(--yz-bdr)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
          {loading && <p style={{ padding: 14, fontSize: 12, color: 'var(--yz-dim)' }}>載入中...</p>}
          {!loading && items.length === 0 && (
            <p style={{ padding: 14, fontSize: 12, color: 'var(--yz-dim)' }}>查無品項，請確認後端已啟動或換個關鍵字</p>
          )}
          {!loading && visibleItems.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr 0.8fr 0.8fr 1fr 1fr 1fr 40px',
              padding: '8px 16px',
              borderBottom: '2px solid var(--yz-bdr)',
              background: 'var(--yz-gl)',
            }}>
              {[
                { label: '品項名稱', col: null },
                { label: '今日均價', col: 'price' },
                { label: '上價',     col: 'upper' },
                { label: '下價',     col: 'lower' },
                { label: '交易量',   col: 'volume' },
                { label: '7 日漲跌', col: 'diff7' },
                { label: '市場',     col: null },
                { label: '收藏',     col: null },
              ].map(({ label, col }) => (
                <span
                  key={label}
                  onClick={col ? () => handleColSort(col) : undefined}
                  style={{
                    fontSize: 10, fontWeight: 700, color: 'var(--yz-dim)',
                    letterSpacing: '.06em', textTransform: 'uppercase',
                    cursor: col ? 'pointer' : 'default',
                    userSelect: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}
                >
                  {label}
                  {col && colSortIcon(col)}
                </span>
              ))}
            </div>
          )}
          {visibleItems.map((item, idx) => {
            const { arrow, color } = STATUS_ARROW[item.status] || STATUS_ARROW['資料不足'];
            const d = diffPct(item);
            const dc = d == null ? 'var(--yz-dim)' : d > 0 ? '#DC2626' : d < 0 ? '#16A34A' : '#9CA3AF';
            const dArrow = d == null ? '' : d > 0 ? '↑' : d < 0 ? '↓' : '→';
            const isSaved = savedProductNames.includes(item.product_name);
            return (
              <div
                key={item.product_name}
                onClick={() => handleItemClick(item.product_name)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1fr 0.8fr 0.8fr 1fr 1fr 1fr 40px',
                  padding: '11px 16px', cursor: 'pointer', alignItems: 'center',
                  borderBottom: idx < visibleItems.length - 1 ? '1px solid #F0ECE5' : 'none',
                  transition: 'background .12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--yz-gl)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--yz-txt)' }}>{item.product_name}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color, marginLeft: 6 }}>{arrow} {item.status}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--yz-dim)' }}>
                  {item.today_price != null ? `${item.today_price} 元` : '—'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--yz-mut)' }}>
                  {item.upper_price != null ? `${item.upper_price} 元` : '—'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--yz-mut)' }}>
                  {item.lower_price != null ? `${item.lower_price} 元` : '—'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--yz-mut)' }}>
                  {item.volume != null ? `${item.volume.toLocaleString()} kg` : '—'}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: dc }}>
                  {d != null ? `${dArrow} ${d > 0 ? '+' : ''}${d}%` : '—'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--yz-mut)' }}>
                  {market || '全台'}
                </span>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleToggleSavedProduct(item.product_name);
                  }}
                  title={isSaved ? '取消收藏' : '收藏'}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 16, padding: 0, lineHeight: 1,
                    color: isSaved ? 'var(--yz-or)' : 'var(--yz-dim)',
                  }}
                >
                  {isSaved ? '★' : '☆'}
                </button>
              </div>
            );
          })}
        </div>

        {/* 顯示更多 */}
        {!isFiltering && !loading && items.length > FEATURED_COUNT && (
          <button
            onClick={() => setShowAll(v => !v)}
            style={{ marginTop: 8, width: '100%', padding: '10px 14px', background: 'none', border: '1px solid var(--yz-bdr)', borderRadius: 8, color: 'var(--yz-g)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {showAll ? '▴ 收合' : `顯示全部 ${items.length} 項 ▾`}
          </button>
        )}
      </div>
    </div>
  );
}
