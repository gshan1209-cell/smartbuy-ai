import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { get } from '../hooks/useApi';
import Chart from 'chart.js/auto';

// ── 常數 ───────────────────────────────────────────────────────────────────────

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

const DIRECTION_META = {
  up:   { label: '預測方向：漲', color: '#DC2626', bg: '#FEF2F2', badge: '#FCA5A5', arrow: '↑' },
  down: { label: '預測方向：跌', color: '#16A34A', bg: '#F0FDF4', badge: '#86EFAC', arrow: '↓' },
  flat: { label: '預測方向：持平', color: '#6B7280', bg: '#F9FAFB', badge: '#D1D5DB', arrow: '→' },
};

// MA 線設定
const MA_CONFIG = {
  ma7:  { label: 'MA7',  color: '#F59E0B', dash: [4, 3] },
  ma14: { label: 'MA14', color: '#3B82F6', dash: [4, 3] },
  ma30: { label: 'MA30', color: '#A855F7', dash: [6, 3] },
};

// ── Sparkline（sidebar 用 SVG 迷你折線）────────────────────────────────────

function Sparkline({ data, color = '#1D9E75', width = 48, height = 20 }) {
  if (!data || data.length < 2) return <span style={{ width, display: 'inline-block' }} />;
  const vals = data.filter(v => v != null);
  if (vals.length < 2) return <span style={{ width, display: 'inline-block' }} />;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * (width - 2) + 1;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── 行情位置儀表盤 ────────────────────────────────────────────────────────────

function getZScoreLabel(z) {
  if (z == null)  return { label: '資料不足',               color: '#9CA3AF' };
  if (z < -1.5)   return { label: '比過去 9 成交易日都便宜', color: '#16A34A' };
  if (z < -1.0)   return { label: '比過去 7 成交易日便宜',   color: '#16A34A' };
  if (z < 0)      return { label: '略低於近期均價',           color: '#6B7280' };
  if (z < 1.0)    return { label: '接近近期均價',             color: '#6B7280' };
  if (z < 1.5)    return { label: '略高於近期均價',           color: '#D97706' };
  return           { label: '比過去 7 成交易日都貴',           color: '#DC2626' };
}

function PriceInsightCard({ detail, todayPrice }) {
  const zScore     = detail?.z_score       ?? null;
  const priceVsMa7 = detail?.price_vs_ma_7 ?? null;
  const ma7        = detail?.price_ma_7    ?? null;
  const ma14       = detail?.price_ma_14   ?? null;
  const ma30       = detail?.price_ma_30   ?? null;

  if (zScore == null && ma7 == null) return null;

  const dotPct = zScore != null
    ? Math.min(Math.max(((zScore + 3) / 6) * 100, 2), 98)
    : 50;
  const { label, color } = getZScoreLabel(zScore);
  const vsMa7Pct = priceVsMa7 != null
    ? `${priceVsMa7 >= 0 ? '+' : ''}${(priceVsMa7 * 100).toFixed(1)}%`
    : null;

  return (
    <div className="yz-card" style={{ padding: '16px 20px', marginBottom: 16 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--yz-dim)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        行情位置
      </p>
      {/* 色帶 */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ flex: 1, background: 'rgba(22,163,74,0.25)' }} />
          <div style={{ flex: 1, background: 'rgba(22,163,74,0.15)' }} />
          <div style={{ flex: 1, background: 'rgba(156,163,175,0.20)' }} />
          <div style={{ flex: 1, background: 'rgba(217,119,6,0.20)' }} />
          <div style={{ flex: 1, background: 'rgba(220,38,38,0.25)' }} />
        </div>
        <div style={{
          position: 'absolute', top: -4, left: `${dotPct}%`,
          transform: 'translateX(-50%)',
          width: 20, height: 20, borderRadius: '30%',
          background: color, border: '2px solid #fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        }} />
      </div>
      {/* 標籤 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--yz-mut)', marginBottom: 14 }}>
        <span>偏低</span><span>正常</span><span>偏高</span>
      </div>
      {/* 說明文字方塊 */}
      <div style={{
        background: color === '#16A34A' ? 'rgba(22,163,74,0.08)' : color === '#DC2626' ? 'rgba(220,38,38,0.08)' : 'rgba(156,163,175,0.10)',
        border: `1px solid ${color}33`,
        borderRadius: 8, padding: '10px 14px', marginBottom: 14,
      }}>
        <p style={{ fontSize: 14, fontWeight: 700, color, margin: '0 0 4px' }}>{label}</p>
        {todayPrice != null && ma7 != null && (
          <p style={{ fontSize: 12, color: 'var(--yz-mut)', margin: 0 }}>
            今日 {todayPrice} 元
            {vsMa7Pct && <span style={{ color, fontWeight: 600 }}> {vsMa7Pct}</span>}
            {' '}vs MA7 均價 {ma7.toFixed(1)} 元
          </p>
        )}
      </div>
      {/* MA 三格 */}
      {(ma7 != null || ma14 != null || ma30 != null) && (
        <div style={{ display: 'flex', gap: 8 }}>
          {[['MA7', ma7], ['MA14', ma14], ['MA30', ma30]].map(([lbl, val]) => (
            <div key={lbl} style={{ flex: 1, background: 'var(--yz-gl)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <p style={{ fontSize: 10, color: 'var(--yz-mut)', margin: '0 0 4px' }}>{lbl}</p>
              <p style={{ fontSize: val != null ? 15 : 10, fontWeight: 700, color: val != null ? 'var(--yz-txt)' : 'var(--yz-mut)', margin: 0 }}>
                {val != null ? val.toFixed(1) : '資料不足'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 行情解析文字卡 ────────────────────────────────────────────────────────────

function PriceReasonCard({ detail }) {
  const reason = detail?.price_detail?.reason;
  const advice = detail?.advice;
  const suggestion = detail?.price_detail?.suggestion;
  const priceStatus = detail?.price_status;
  const priceEmoji = priceStatus === '便宜' ? '📉' : priceStatus === '偏貴' ? '📈' : '📊';

  if (!reason && !advice) return null;

  return (
    <div className="yz-card" style={{ padding: '16px 20px', marginBottom: 16 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--yz-dim)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>行情解析</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>{priceEmoji}</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--yz-txt)', lineHeight: 1.6, marginBottom: advice || suggestion ? 6 : 0 }}>{reason}</p>
          {(advice || suggestion) && (
            <p style={{ fontSize: 12, color: 'var(--yz-mut)', lineHeight: 1.65 }}>{advice}{advice && suggestion ? ' ' : ''}{suggestion}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AI 方向預測卡 ─────────────────────────────────────────────────────────────

function _normalizeBatchPrediction(d) {
  const dirMap = { 漲: 'up', 跌: 'down', 持平: 'flat' };
  return {
    direction: dirMap[d.pred_label_name] || 'flat',
    confidence: d.pred_confidence,
    prob_down: d.prob_down,
    prob_flat: d.prob_flat,
    prob_up: d.prob_up,
    trade_date: d.base_date,
    note: d.display_message,
    risk_level: d.risk_level,
    risk_note: d.risk_note,
    data_staleness_days: d.data_staleness_days,
    base_date: d.base_date,
    source: 'batch',
  };
}

function DirectionCard({ productName, market }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!productName) return;
    setData(null);
    setLoading(true);
    const params = market
      ? `crop_name=${encodeURIComponent(productName)}&market_name=${encodeURIComponent(market)}`
      : `crop_name=${encodeURIComponent(productName)}`;
    get(`/api/predictions/direction/latest?${params}`)
      .then(d => setData(_normalizeBatchPrediction(d)))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [productName, market]);

  if (loading) return (
    <div style={{ padding: '10px 14px', borderRadius: 8, background: '#F9FAFB', fontSize: 12, color: 'var(--yz-mut)', marginBottom: 16 }}>
      AI 方向預測載入中…
    </div>
  );
  if (!data || !data.direction) return (
    <div style={{ padding: '10px 14px', borderRadius: 8, background: '#F9FAFB', fontSize: 12, color: 'var(--yz-mut)', marginBottom: 16 }}>
      AI 方向預測：尚無下一交易日方向預測結果
    </div>
  );

  const meta = DIRECTION_META[data.direction] || DIRECTION_META.flat;
  const bars = [
    { label: '看跌', key: 'prob_down', color: '#16A34A' },
    { label: '持平', key: 'prob_flat', color: '#9CA3AF' },
    { label: '看漲', key: 'prob_up',   color: '#DC2626' },
  ];
  const confPct = Math.round((data.confidence || 0) * 100);

  return (
    <div style={{ borderRadius: 10, border: `1.5px solid ${meta.badge}`, background: meta.bg, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${meta.badge}` }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>{meta.arrow}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: meta.color }}>{meta.label}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 12, background: meta.badge, color: meta.color }}>
              信心 {confPct}%
            </span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--yz-mut)', marginTop: 2 }}>
            預測目標：下一交易日 · 資料基準日：{data.base_date || data.trade_date}
          </p>
        </div>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {bars.map(({ label, key, color }) => {
          const pct = Math.round((data[key] || 0) * 100);
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 28, fontSize: 11, fontWeight: 600, color, flexShrink: 0 }}>{label}</span>
              <div style={{ flex: 1, height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width .4s' }} />
              </div>
              <span style={{ width: 32, fontSize: 11, fontWeight: 700, color, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
            </div>
          );
        })}
      </div>
      {data.risk_level && data.risk_level !== 'normal' && data.risk_note && (
        <div style={{ margin: '0 16px 10px', padding: '8px 10px', borderRadius: 6, background: data.risk_level === 'high' ? '#FEF2F2' : '#FFFBEB', fontSize: 11, color: data.risk_level === 'high' ? '#DC2626' : '#92400E' }}>
          ⚠ {data.risk_note}
        </div>
      )}
      {data.data_staleness_days === 0 && (
        <div style={{ padding: '0 16px 6px', fontSize: 10, color: 'var(--yz-mut)' }}>資料新鮮度：最新交易日資料</div>
      )}
      {data.data_staleness_days > 0 && (
        <div style={{ padding: '0 16px 6px', fontSize: 10, color: 'var(--yz-mut)' }}>資料新鮮度：距全域最新交易日 {data.data_staleness_days} 天</div>
      )}
      {data.note && <div style={{ padding: '0 16px 6px', fontSize: 10, color: 'var(--yz-mut)' }}>{data.note}</div>}
      <div style={{ padding: '0 16px 10px', fontSize: 10, color: 'var(--yz-mut)' }}>僅供參考，請勿作為唯一採買依據</div>
    </div>
  );
}

// ── 詳情頁主體 ────────────────────────────────────────────────────────────────

export default function ProductDetail() {
  const { name: paramName } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const market = searchParams.get('market') || '';
  const filterStatus = searchParams.get('filter') || '';
  const sortBy = searchParams.get('sort') || 'default';

  const productName = decodeURIComponent(paramName || '');

  const [sidebarItems, setSidebarItems] = useState([]);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [sidebarQuery, setSidebarQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // sparkline 資料 map: product_name -> price[]
  const [sparklineMap, setSparklineMap] = useState({});

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);

  // 左側品項列表
  useEffect(() => {
    const params = new URLSearchParams();
    if (market) params.set('market', market);
    if (filterStatus) params.set('filter', filterStatus);
    get(`/api/products?${params.toString()}`)
      .then(data => {
        let list = data;
        const STATUS_RANK = { '便宜': 0, '正常': 1, '偏貴': 2, '資料不足': 3 };
        const diffPct = item => item.today_price != null && item.recent_average
          ? Math.round((item.today_price - item.recent_average) / item.recent_average * 100) : null;
        if (sortBy === 'diff_desc') list = [...list].sort((a, b) => (diffPct(b) ?? -999) - (diffPct(a) ?? -999));
        else if (sortBy === 'diff_asc') list = [...list].sort((a, b) => (diffPct(a) ?? 999) - (diffPct(b) ?? 999));
        else list = [...list].sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9));
        setSidebarItems(list);
      })
      .catch(() => setSidebarItems([]))
      .finally(() => setSidebarLoading(false));
  }, [market, filterStatus, sortBy]);

  // 批次載入 sidebar sparkline（每個品項打一次 history API，取近 7 筆）
  useEffect(() => {
    if (!sidebarItems.length) return;
    const visibleItems = sidebarItems.slice(0, 40);
    visibleItems.forEach(item => {
      const mktParam = market ? `&market=${encodeURIComponent(market)}` : '';
      get(`/api/products/${encodeURIComponent(item.product_name)}/history?days=14${mktParam}`)
        .then(d => {
          const prices = (d.history || []).map(r => r.price).filter(v => v != null);
          setSparklineMap(prev => ({ ...prev, [item.product_name]: prices }));
        })
        .catch(() => {});
    });
  }, [sidebarItems, market]); // eslint-disable-line

  // 右側詳情
  useEffect(() => {
    if (!productName) return;
    setDetail(null);
    setDetailLoading(true);
    const params = market ? `?market=${encodeURIComponent(market)}` : '';
    get(`/api/products/${encodeURIComponent(productName)}${params}`)
      .then(d => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [productName, market]);

  function navigateToProduct(name) {
    navigate(`/product/${encodeURIComponent(name)}?${searchParams.toString()}`);
  }

  const backUrl = `/search?${searchParams.toString()}`;

  return (
    <div className="yz-page" style={{ padding: '0 0 56px' }}>
      {/* 回到列表 */}
      <div style={{ padding: '14px 32px 0', borderBottom: '1px solid var(--yz-bdr)', background: '#fff' }}>
        <button
          onClick={() => navigate(backUrl)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--yz-g)', fontWeight: 600, padding: '6px 0 10px' }}
        >
          ← 回到列表
        </button>
      </div>

      <div style={{ display: 'flex', maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
        {/* 左側品項切換欄 */}
        <div style={{
          width: sidebarOpen ? 240 : 0,
          flexShrink: 0,
          borderRight: sidebarOpen ? '1px solid var(--yz-bdr)' : 'none',
          height: 'calc(100vh - 110px)',
          overflowY: sidebarOpen ? 'auto' : 'hidden',
          overflowX: 'hidden',
          position: 'sticky',
          top: 0,
          paddingTop: sidebarOpen ? 14 : 0,
          transition: 'width .2s ease',
        }}>
          {sidebarOpen && (
            <>
              <div style={{ padding: '0 10px 10px', borderBottom: '1px solid var(--yz-bdr)' }}>
                <input
                  className="yz-input"
                  placeholder="搜尋品項..."
                  value={sidebarQuery}
                  onChange={e => setSidebarQuery(e.target.value)}
                  style={{ fontSize: 12, width: '100%' }}
                />
              </div>
              {sidebarLoading && <p style={{ padding: '8px 14px', fontSize: 12, color: 'var(--yz-dim)' }}>載入中…</p>}
              {(sidebarQuery.trim()
                ? sidebarItems.filter(i => i.product_name.includes(sidebarQuery.trim()))
                : sidebarItems
              ).map(item => {
                const active = item.product_name === productName;
                const { arrow, color } = STATUS_ARROW[item.status] || STATUS_ARROW['資料不足'];
                const sparkPrices = sparklineMap[item.product_name];
                const sparkColor = item.status === '便宜' ? '#16A34A' : item.status === '偏貴' ? '#DC2626' : '#9CA3AF';
                return (
                  <div
                    key={item.product_name}
                    onClick={() => navigateToProduct(item.product_name)}
                    style={{
                      padding: '9px 14px', cursor: 'pointer',
                      borderLeft: active ? '3px solid var(--yz-g)' : '3px solid transparent',
                      background: active ? 'var(--yz-gl)' : 'transparent',
                      borderBottom: '1px solid #F0ECE5',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: active ? 700 : 400, color: active ? 'var(--yz-gd)' : 'var(--yz-txt)' }}>
                        {item.product_name}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 600, color }}>{arrow} {item.status}</span>
                    </div>
                    {/* 價格 + sparkline */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'var(--yz-dim)' }}>
                        {item.today_price != null ? `${item.today_price} 元/kg` : '暫無報價'}
                      </span>
                      {sparkPrices && sparkPrices.length >= 2 && (
                        <Sparkline data={sparkPrices} color={sparkColor} width={48} height={18} />
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* 右側詳情內容 */}
        <div style={{ flex: 1, padding: '20px 0 0 28px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            <button
              onClick={() => setSidebarOpen(v => !v)}
              title={sidebarOpen ? '收合品項欄' : '展開品項欄'}
              style={{
                background: 'none', border: '1px solid var(--yz-bdr)',
                borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                fontSize: 13, color: 'var(--yz-mut)', marginRight: 8, flexShrink: 0,
              }}
            >
              {sidebarOpen ? '◀' : '▶'}
            </button>
          </div>
          {detailLoading && <p style={{ color: 'var(--yz-dim)', fontSize: 14 }}>載入中…</p>}
          {!detailLoading && !detail && <p style={{ color: 'var(--yz-dim)', fontSize: 14 }}>無法取得詳細資料</p>}
          {!detailLoading && detail && (
            <DetailContent productName={productName} market={market} detail={detail} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── MetricMACard ──────────────────────────────────────────────────────────────

function MetricMACard({ label, value, days }) {
  const hasValue = value != null && !isNaN(value);
  return (
    <div className="yz-card" style={{ padding: '16px 18px' }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--yz-mut)', marginBottom: 7 }}>{label}</p>
      {hasValue ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 26, fontWeight: 900 }}>{value.toFixed(1)}</span>
          <span style={{ fontSize: 12, color: 'var(--yz-mut)' }}>元/kg</span>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--yz-dim)' }}>—</span>
          <p style={{ fontSize: 10, color: 'var(--yz-mut)', marginTop: 6, lineHeight: 1.5 }}>
            需至少 {days} 筆交易日資料，<br />目前資料不足
          </p>
        </div>
      )}
    </div>
  );
}

// ── 黃色十字準線 Plugin ───────────────────────────────────────────────────────

const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart) {
    if (chart._crosshairX == null) return;
    const { ctx, chartArea: { top, bottom, left, right }, scales: { y } } = chart;
    const xPos = chart._crosshairX;

    ctx.save();

    // 垂直線
    ctx.beginPath();
    ctx.moveTo(xPos, top);
    ctx.lineTo(xPos, bottom);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.stroke();

    // 水平線（找 label === '均價' 的 dataset）
    const idx = chart._activeDataIndex;
    if (idx != null) {
      const priceDataset = chart.data.datasets.find(ds => ds.label === '均價');
      const priceVal = priceDataset?.data?.[idx];
      if (priceVal != null) {
        const yPos = y.getPixelForValue(priceVal);

        ctx.beginPath();
        ctx.moveTo(left, yPos);
        ctx.lineTo(right, yPos);
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.stroke();

        // Y 軸價格標籤（右側）
        const labelW = 52, labelH = 18;
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(right + 2, yPos - labelH / 2, labelW, labelH);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${priceVal.toFixed(1)} 元`, right + 6, yPos + 4);

        // X 軸日期標籤（底部）
        const label = chart.data.labels?.[idx];
        if (label) {
          const labelW2 = 52, labelH2 = 16;
          ctx.fillStyle = '#FFD700';
          ctx.fillRect(xPos - labelW2 / 2, bottom + 2, labelW2, labelH2);
          ctx.fillStyle = '#000';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(label, xPos, bottom + 13);
        }
      }
    }

    ctx.restore();
  },
  afterEvent(chart, args) {
    const event = args.event;
    if (event.type === 'mousemove') {
      const { left, right } = chart.chartArea;
      const x = event.x;
      if (x >= left && x <= right) {
        chart._crosshairX = x;
        const scale = chart.scales.x;
        const idx = Math.round(scale.getValueForPixel(x));
        chart._activeDataIndex = Math.max(0, Math.min(idx, (chart.data.labels?.length ?? 1) - 1));
      } else {
        chart._crosshairX = null;
        chart._activeDataIndex = null;
      }
      chart.draw();
    } else if (event.type === 'mouseout') {
      chart._crosshairX = null;
      chart._activeDataIndex = null;
      chart.draw();
    }
  },
};

// ── 詳情內容 ──────────────────────────────────────────────────────────────────

function DetailContent({ productName, market, detail }) {
  const [period, setPeriod] = useState('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [history, setHistory] = useState(null);
  const [chartMode, setChartMode] = useState('line');
  // MA toggle: { ma7, ma14, ma30 }
  const [maVisible, setMaVisible] = useState({
    upper: true, lower: true, avg: true,
    ma7: true, ma14: true, ma30: true,
    volume: true,
  });

  const priceChartRef = useRef(null);
  const priceChartInst = useRef(null);

  // 載入走勢圖資料（固定拉 180 天，前端依 period 過濾）
  useEffect(() => {
    if (period === 'custom' && (!customFrom || !customTo)) return;
    setHistory(null);
    const params = new URLSearchParams({ days: '180' });
    if (market) params.set('market', market);
    get(`/api/products/${encodeURIComponent(productName)}/history?${params.toString()}`)
      .then(d => {
        let h = d.history || [];
        if (period === 'custom' && customFrom && customTo) {
          h = h.filter(r => r.date >= customFrom && r.date <= customTo);
        } else {
          h = h.slice(-Number(period));
        }
        setHistory(h);
      })
      .catch(() => setHistory([]));
  }, [productName, market, period, customFrom, customTo]); // eslint-disable-line

  // 建立 Chart.js 圖表
  useEffect(() => {
    if (!history || !priceChartRef.current) return;
    const sliced = history;
    if (sliced.length < 2) return;

    const labels     = sliced.map(r => r.date.slice(5));
    const prices     = sliced.map(r => r.price);
    const volumes    = sliced.map(r => r.volume ?? null);
    const upperPrices = sliced.map(r => r.upper_price ?? null);
    const lowerPrices = sliced.map(r => r.lower_price ?? null);
    const ma7Data    = sliced.map(r => r.price_ma_7  ?? null);
    const ma14Data   = sliced.map(r => r.price_ma_14 ?? null);
    const ma30Data   = sliced.map(r => r.price_ma_30 ?? null);

    if (priceChartInst.current) { priceChartInst.current.destroy(); priceChartInst.current = null; }

    const hasVolume = volumes.some(v => v != null);
    const step = Math.max(1, Math.floor(labels.length / 8));
    const xAxisTicksConfig = {
      autoSkip: false,
      maxRotation: 0,
      font: { size: 12 },
      callback: function(val, index) {
        return index % step === 0 ? this.getLabelForValue(val) : '';
      },
    };
    const xAxisGridConfig = { display: false };

    if (chartMode === 'line') {
      priceChartInst.current = new Chart(priceChartRef.current, {
        type: 'line',
        plugins: [crosshairPlugin],
        data: {
          labels,
          datasets: [
            // index 0: 上價色帶（fill 到 index 1）
            {
              label: '上價',
              data: upperPrices,
              fill: '+1',
              backgroundColor: 'rgba(29,158,117,0.10)',
              borderColor: 'rgba(29,158,117,0.4)',
              borderWidth: 1,
              borderDash: [3, 3],
              pointRadius: 0,
              tension: 0.2,
              yAxisID: 'y',
              hidden: !maVisible.upper,
            },
            // index 1: 下價色帶下界
            {
              label: '下價',
              data: lowerPrices,
              fill: false,
              borderColor: 'rgba(29,158,117,0.4)',
              borderWidth: 1,
              borderDash: [3, 3],
              pointRadius: 0,
              tension: 0.2,
              yAxisID: 'y',
              hidden: !maVisible.lower,
            },
            // index 2: 均價主線（crosshair plugin 讀這個）
            {
              label: '均價',
              data: prices,
              borderColor: '#1D9E75',
              borderWidth: 2.2,
              pointRadius: 0,
              pointHoverRadius: 4,
              tension: 0.2,
              fill: false,
              yAxisID: 'y',
              hidden: !maVisible.avg,
            },
            // index 3: MA7
            {
              label: 'MA7', data: ma7Data,
              borderColor: MA_CONFIG.ma7.color,
              borderWidth: 1.5,
              //borderDash: MA_CONFIG.ma7.dash, 
              pointRadius: 0,
              tension: 0.2, 
              fill: false, 
              yAxisID: 'y',
              hidden: !maVisible.ma7,
            },
            // index 4: MA14
            {
              label: 'MA14', data: ma14Data,
              borderColor: MA_CONFIG.ma14.color, 
              borderWidth: 1.5,
              //borderDash: MA_CONFIG.ma14.dash, 
              pointRadius: 0,
              tension: 0.2, fill: false, 
              yAxisID: 'y',
              hidden: !maVisible.ma14,
            },
            // index 5: MA30
            {
              label: 'MA30', data: ma30Data,
              borderColor: MA_CONFIG.ma30.color, 
              borderWidth: 1.5,
              //borderDash: MA_CONFIG.ma30.dash, 
              pointRadius: 0,
              tension: 0.2, fill: false, 
              yAxisID: 'y',
              hidden: !maVisible.ma30,
            },
            // index 6: 成交量 bar（左 Y 軸）
            {
              type: 'bar',
              label: '成交量',
              data: hasVolume ? volumes : [],
              backgroundColor: 'rgba(156,163,175,0.35)',
              borderColor: 'rgba(156,163,175,0.6)',
              borderWidth: 1,
              borderRadius: 1,
              yAxisID: 'yVol',
              hidden: !maVisible.volume || !hasVolume,
              order: 10,
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => {
                  if (ctx.dataset.label === '成交量') {
                    return ctx.raw != null ? `成交量：${Math.round(ctx.raw).toLocaleString()} kg` : null;
                  }
                  return ctx.raw != null ? `${ctx.dataset.label}：${ctx.raw} 元/kg` : null;
                },
                filter: item => item.raw != null,
              },
            },
          },
          scales: {
            x: {
              display: true,
              ticks: xAxisTicksConfig,
              grid: xAxisGridConfig,
            },
            y: {
              suggestedMin: 0,
              position: 'right',
              grid: { color: 'rgba(0,0,0,0.05)' },
              ticks: { font: { size: 12 } },
              title: { display: true, text: '成交價(元 / kg)', font: { size: 14 }, color: 'var(--yz-mut)', padding: { bottom: 0 } },
            },
            yVol: {
              position: 'left',
              display: hasVolume && maVisible.volume,
              grid: { display: false },
              ticks: { font: { size: 12 }, maxTicksLimit: 3,
                callback: v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v },
              title: { display: true, text: '成交量(公斤)', font: { size: 14 }, color: 'var(--yz-mut)' },
            },
          },
        },
      });
    } else {
      // 技術圖模式（floating bar 三價棒）
      priceChartInst.current = new Chart(priceChartRef.current, {
        type: 'bar',
        plugins: [crosshairPlugin],
        data: {
          labels,
          datasets: [
            // index 0: 三價棒主體
            {
              type: 'bar',
              label: '成交區間',
              data: sliced.map(r => [r.lower_price ?? r.price, r.upper_price ?? r.price]),
              backgroundColor: 'rgba(29,158,117,0.18)',
              borderColor: '#1D9E75',
              borderWidth: 1,
              borderRadius: 1,
              borderSkipped: false,
              yAxisID: 'y',
              hidden: !maVisible.upper,
            },
            // index 1: 均價點（crosshair plugin 讀這個）
            {
              type: 'line',
              label: '均價',
              data: prices,
              borderColor: '#1D9E75',
              borderWidth: 0,
              pointRadius: 3,
              pointBackgroundColor: '#1D9E75',
              pointHoverRadius: 5,
              fill: false,
              tension: 0,
              yAxisID: 'y',
              hidden: !maVisible.avg,
            },
            // index 2: MA7
            {
              type: 'line', label: 'MA7', data: ma7Data,
              borderColor: MA_CONFIG.ma7.color, borderWidth: 1.5,
              pointRadius: 0, tension: 0.2, fill: false,
              borderDash: MA_CONFIG.ma7.dash, yAxisID: 'y',
              hidden: !maVisible.ma7,
            },
            // index 3: MA14
            {
              type: 'line', label: 'MA14', data: ma14Data,
              borderColor: MA_CONFIG.ma14.color, borderWidth: 1.5,
              pointRadius: 0, tension: 0.2, fill: false,
              borderDash: MA_CONFIG.ma14.dash, yAxisID: 'y',
              hidden: !maVisible.ma14,
            },
            // index 4: MA30
            {
              type: 'line', label: 'MA30', data: ma30Data,
              borderColor: MA_CONFIG.ma30.color, borderWidth: 1.5,
              pointRadius: 0, tension: 0.2, fill: false,
              borderDash: MA_CONFIG.ma30.dash, yAxisID: 'y',
              hidden: !maVisible.ma30,
            },
            // index 5: 成交量 bar（左 Y 軸）
            {
              type: 'bar',
              label: '成交量',
              data: hasVolume ? volumes : [],
              backgroundColor: 'rgba(156,163,175,0.35)',
              borderColor: 'rgba(156,163,175,0.6)',
              borderWidth: 1,
              borderRadius: 1,
              yAxisID: 'yVol',
              hidden: !maVisible.volume || !hasVolume,
              order: 10,
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => {
                  if (ctx.dataset.label === '成交量') {
                    return ctx.raw != null ? `成交量：${Math.round(ctx.raw).toLocaleString()} kg` : null;
                  }
                  if (ctx.dataset.label === '成交區間') {
                    const [lo, hi] = Array.isArray(ctx.raw) ? ctx.raw : [null, null];
                    return lo != null ? `上價：${hi} 元/kg  下價：${lo} 元/kg` : null;
                  }
                  return ctx.raw != null ? `${ctx.dataset.label}：${ctx.raw} 元/kg` : null;
                },
                filter: item => item.raw != null,
              },
            },
          },
          scales: {
            x: {
              display: true,
              ticks: xAxisTicksConfig,
              grid: xAxisGridConfig,
            },
            y: {
              position: 'right',
              grid: { color: 'rgba(0,0,0,0.05)' },
              ticks: { font: { size: 10 } },
              title: { display: true, text: '元/kg', font: { size: 10 }, color: 'var(--yz-mut)', padding: { bottom: 0 } },
            },
            yVol: {
              position: 'left',
              display: hasVolume && maVisible.volume,
              grid: { display: false },
              ticks: { font: { size: 9 }, maxTicksLimit: 3,
                callback: v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v },
              title: { display: false },
            },
          },
        },
      });
    }

    return () => {
      if (priceChartInst.current) { priceChartInst.current.destroy(); priceChartInst.current = null; }
    };
  }, [history, chartMode]); // eslint-disable-line

  // MA 指標卡數值（從 history 最後一筆取後端預計算值）
  const lastRecord = history && history.length > 0 ? history[history.length - 1] : null;
  const ma7Val  = lastRecord?.price_ma_7  ?? null;
  const ma14Val = lastRecord?.price_ma_14 ?? null;
  const ma30Val = lastRecord?.price_ma_30 ?? null;

  // 昨日價格（history 倒數第二筆）
  const yesterdayPrice = history && history.length >= 2 ? history[history.length - 2]?.price ?? null : null;

  const todayPrice = detail.today_price;
  const priceStatus = detail.price_status;
  const pd = detail.price_detail || {};

  // 今日漲跌計算
  const priceDiff = todayPrice != null && yesterdayPrice != null ? parseFloat((todayPrice - yesterdayPrice).toFixed(1)) : null;
  const pricePct  = priceDiff != null && yesterdayPrice > 0 ? parseFloat(((priceDiff / yesterdayPrice) * 100).toFixed(2)) : null;
  const diffColor = priceDiff == null ? 'var(--yz-dim)' : priceDiff > 0 ? '#DC2626' : priceDiff < 0 ? '#16A34A' : '#9CA3AF';
  const diffArrow = priceDiff == null ? '' : priceDiff > 0 ? '▲' : priceDiff < 0 ? '▼' : '—';
  const todayPriceColor = priceDiff == null ? 'var(--yz-txt)' : priceDiff > 0 ? '#DC2626' : priceDiff < 0 ? '#16A34A' : 'var(--yz-txt)';

  const hasVolumeData = (history || []).some(r => r.volume != null);

  return (
    <>
      {/* 1. 品名 + 狀態 badge + 今日漲跌 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h2 style={{ fontSize: 26, fontWeight: 900 }}>{productName}</h2>
          <span className={`yz-bdg ${STATUS_BADGE[priceStatus] || 'yz-bdg-gr'}`}>{priceStatus}</span>
        </div>
        {/* 股票風格：大數字 + 漲跌幅 */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: todayPriceColor, lineHeight: 1.1 }}>
            {todayPrice ?? '—'}
          </span>
          {todayPrice != null && <span style={{ fontSize: 14, color: 'var(--yz-mut)', fontWeight: 500 }}>元/kg</span>}
          {priceDiff != null && (
            <span style={{ fontSize: 16, fontWeight: 700, color: diffColor }}>
              {diffArrow} {priceDiff > 0 ? '+' : ''}{priceDiff} ({pricePct > 0 ? '+' : ''}{pricePct}%)
            </span>
          )}
          {priceDiff == null && history !== null && (
            <span style={{ fontSize: 12, color: 'var(--yz-mut)' }}>（昨日資料載入中）</span>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--yz-mut)', marginTop: 4 }}>
          {pd.market_name ? `${pd.market_name} · ` : ''}
          {pd.trans_date ? `${pd.trans_date} ` : ''}
          資料範圍依下方切換器決定
        </p>
      </div>

      {/* 1b. 日期切換器 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['7', '7 天'], ['14', '14 天'], ['30', '30 天']].map(([val, label]) => (
          <button key={val} onClick={() => setPeriod(val)} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', border: '1.5px solid',
            background: period === val ? 'var(--yz-g)' : 'transparent',
            color: period === val ? '#fff' : 'var(--yz-mut)',
            borderColor: period === val ? 'var(--yz-g)' : 'var(--yz-bdr)',
          }}>{label}</button>
        ))}
        <button onClick={() => setPeriod('custom')} style={{
          padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
          cursor: 'pointer', border: '1.5px solid',
          background: period === 'custom' ? 'var(--yz-g)' : 'transparent',
          color: period === 'custom' ? '#fff' : 'var(--yz-mut)',
          borderColor: period === 'custom' ? 'var(--yz-g)' : 'var(--yz-bdr)',
        }}>自訂</button>
        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <input type="date" value={customFrom}
              max={customTo || new Date().toISOString().slice(0, 10)}
              onChange={e => setCustomFrom(e.target.value)}
              style={{ border: '1px solid var(--yz-bdr)', borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: 'inherit' }}
            />
            <span style={{ color: 'var(--yz-mut)' }}>—</span>
            <input type="date" value={customTo}
              min={customFrom}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setCustomTo(e.target.value)}
              style={{ border: '1px solid var(--yz-bdr)', borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: 'inherit' }}
            />
          </div>
        )}
      </div>

      {/* 2. 四格 metric 卡 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
        {/* 今日均價卡 */}
        <div className="yz-card" style={{ padding: '16px 18px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--yz-mut)', marginBottom: 7 }}>今日均價</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: todayPriceColor }}>{todayPrice ?? '—'}</span>
            {todayPrice != null && <span style={{ fontSize: 12, color: 'var(--yz-mut)' }}>元/kg</span>}
          </div>
          {priceDiff != null && (
            <div style={{ fontSize: 12, fontWeight: 700, color: diffColor, marginBottom: 8 }}>
              {diffArrow} {priceDiff > 0 ? '+' : ''}{priceDiff} ({pricePct > 0 ? '+' : ''}{pricePct}%)
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid var(--yz-bdr)', paddingTop: 8 }}>
            {[
              ['上價', pd.upper_price != null ? `${pd.upper_price} 元` : null],
              ['下價', pd.lower_price != null ? `${pd.lower_price} 元` : null],
              ['交易量', pd.volume != null ? `${pd.volume.toLocaleString()} kg` : null],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--yz-mut)' }}>{label}</span>
                <span style={{ fontWeight: 600, color: 'var(--yz-txt)' }}>{val ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
        <MetricMACard label="7 日均線"  value={ma7Val}  days={7} />
        <MetricMACard label="14 日均線" value={ma14Val} days={14} />
        <MetricMACard label="30 日均線" value={ma30Val} days={30} />
      </div>

      {/* 3. 走勢圖卡 */}
      <div className="yz-card" style={{ padding: '22px 22px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h4 style={{ fontSize: 18, fontWeight: 700 }}>
            {productName} · {chartMode === 'line' ? '折線圖' : '技術圖'}
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--yz-mut)', marginRight: 8 }}>
              {period === 'custom' && customFrom && customTo ? `${customFrom} ~ ${customTo}` : `近 ${period} 交易日`}
            </span>
            {/* 折線圖 / 技術圖 切換 */}
            {['line', 'bar'].map(mode => (
              <button key={mode} onClick={() => setChartMode(mode)} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', border: '1.5px solid',
                background: chartMode === mode ? 'var(--yz-g)' : 'transparent',
                color: chartMode === mode ? '#fff' : 'var(--yz-mut)',
                borderColor: chartMode === mode ? 'var(--yz-g)' : 'var(--yz-bdr)',
              }}>{mode === 'line' ? '折線圖' : '技術圖'}</button>
            ))}
          </div>
        </div>

        {/* 圖層 toggle — 分三組 */}
        {(() => {
          function toggleLayer(key, label) {
            const newVal = !maVisible[key];
            setMaVisible(prev => ({ ...prev, [key]: newVal }));
            if (priceChartInst.current) {
              const chart = priceChartInst.current;
              const dsIdx = chart.data.datasets.findIndex(ds => ds.label === label);
              if (dsIdx !== -1) {
                chart.getDatasetMeta(dsIdx).hidden = !newVal;
                if (key === 'upper') {
                  const loIdx = chart.data.datasets.findIndex(ds => ds.label === '下價');
                  if (loIdx !== -1) chart.getDatasetMeta(loIdx).hidden = !newVal;
                }
                if (key === 'volume' && chart.options.scales.yVol) {
                  chart.options.scales.yVol.display = newVal && hasVolume;
                }
                chart.update();
              }
            }
          }

          const btnStyle = (active, color) => ({
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            cursor: 'pointer', border: '1.5px solid',
            background: active ? `${color}18` : 'transparent',
            color: active ? color : 'var(--yz-mut)',
            borderColor: active ? color : 'var(--yz-bdr)',
            transition: 'all .15s',
          });

          const lineIcon = (active, color) => (
            <span style={{ display: 'inline-block', width: 14, height: 2,
              background: active ? color : 'var(--yz-bdr)', borderRadius: 1 }} />
          );

          const sep = (
            <span style={{ width: 1, height: 16, background: 'var(--yz-bdr)',
              alignSelf: 'center', flexShrink: 0 }} />
          );

          return (
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* 群組一：價格帶 */}
              <button onClick={() => toggleLayer('upper', '上價')} style={btnStyle(maVisible.upper, '#1D9E75')}>
                {lineIcon(maVisible.upper, '#1D9E75')} 上/下價
              </button>
              <button onClick={() => toggleLayer('avg', '均價')} style={btnStyle(maVisible.avg, '#1D9E75')}>
                {lineIcon(maVisible.avg, '#1D9E75')} 均價
              </button>

              {sep}

              {/* 群組二：MA 線 */}
              {Object.entries(MA_CONFIG).map(([key, cfg]) => (
                <button key={key} onClick={() => toggleLayer(key, cfg.label)} style={btnStyle(maVisible[key], cfg.color)}>
                  {lineIcon(maVisible[key], cfg.color)} {cfg.label}
                </button>
              ))}

              {sep}

              {/* 群組三：成交量 */}
              {hasVolumeData && (
                <button onClick={() => toggleLayer('volume', '成交量')} style={btnStyle(maVisible.volume, '#9CA3AF')}>
                  <span style={{ display: 'inline-block', width: 10, height: 10,
                    background: maVisible.volume ? 'rgba(156,163,175,0.6)' : 'var(--yz-bdr)',
                    borderRadius: 2, flexShrink: 0 }} />
                  成交量
                </button>
              )}
            </div>
          );
        })()}

        {history === null && (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--yz-dim)', fontSize: 12 }}>載入中…</div>
        )}
        {history !== null && history.length < 2 && (
          <div style={{ height: 80, display: 'flex', alignItems: 'center', color: 'var(--yz-dim)', fontSize: 12 }}>歷史資料不足</div>
        )}
        {history !== null && history.length >= 2 && (
          <div style={{ height: 260 }}>
            <canvas ref={priceChartRef} />
          </div>
        )}
      </div>


      {/* 5. 行情位置儀表盤 */}
      <PriceInsightCard detail={detail} todayPrice={todayPrice} />

      {/* 5b. 行情解析文字 */}
      <PriceReasonCard detail={detail} />

      {/* 6. AI 方向預測卡 */}
      <DirectionCard productName={productName} market={market} />
    </>
  );
}
