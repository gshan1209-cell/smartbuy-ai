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
  ma30: { label: 'MA30', color: '#3B82F6', dash: [4, 3] },
  ma90: { label: 'MA90', color: '#A855F7', dash: [6, 3] },
};

// ── 工具函式 ──────────────────────────────────────────────────────────────────

function calcMA(prices, n) {
  return prices.map((_, i) =>
    i < n - 1 ? null : prices.slice(i - n + 1, i + 1).reduce((s, v) => s + v, 0) / n
  );
}

function calcStd(prices) {
  if (prices.length < 2) return 0;
  const mean = prices.reduce((s, v) => s + v, 0) / prices.length;
  const variance = prices.reduce((s, v) => s + (v - mean) ** 2, 0) / (prices.length - 1);
  return Math.sqrt(variance);
}

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

// ── Bollinger Band 視覺化 ────────────────────────────────────────────────────

function BollingerGauge({ bollinger, todayPrice }) {
  if (!bollinger || todayPrice == null) return null;

  const { upper, lower, mean } = bollinger;
  const range = upper - lower;

  const W = 520, H = 90;
  const BAND_Y = 25, BAND_H = 40;

  const rawPos = range > 0 ? (todayPrice - lower) / range : 0.5;
  const clampedX = Math.min(Math.max(rawPos, -0.08), 1.08) * W;
  const dotY = BAND_Y + BAND_H / 2;

  const pct = range > 0 ? Math.round(rawPos * 100) : 50;
  let posLabel, posColor;
  if (rawPos < 0) {
    posLabel = '正常區間下方（偏低）'; posColor = '#16A34A';
  } else if (rawPos > 1) {
    posLabel = '正常區間上方（偏高）'; posColor = '#DC2626';
  } else if (pct < 20) {
    posLabel = `區間下緣（${pct}%）`; posColor = '#16A34A';
  } else if (pct > 80) {
    posLabel = `區間上緣（${pct}%）`; posColor = '#DC2626';
  } else {
    posLabel = `區間中段（${pct}%）`; posColor = '#6B7280';
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--yz-bdr)' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}
        role="img" aria-label={`布林帶圖：今日價格 ${todayPrice} 元，${posLabel}`}>
        <rect x="0" y={BAND_Y} width={W} height={BAND_H} fill="rgba(22,163,74,0.09)" rx="4" />
        <line x1="0" y1={BAND_Y} x2={W} y2={BAND_Y} stroke="#16A34A" strokeWidth="1.2" strokeDasharray="5,3" />
        <line x1="0" y1={BAND_Y + BAND_H} x2={W} y2={BAND_Y + BAND_H} stroke="#16A34A" strokeWidth="1.2" strokeDasharray="5,3" />
        <line x1="0" y1={BAND_Y + BAND_H / 2} x2={W} y2={BAND_Y + BAND_H / 2} stroke="#3B82F6" strokeWidth="1" strokeDasharray="4,3" opacity="0.7" />
        <text x="4" y={BAND_Y - 5} fontSize="10" fill="#16A34A" fontWeight="600">上界 {upper.toFixed(1)}</text>
        <text x="4" y={BAND_Y + BAND_H / 2 - 4} fontSize="9" fill="#3B82F6" opacity="0.8">MA30 {mean.toFixed(1)}</text>
        <text x="4" y={BAND_Y + BAND_H + 13} fontSize="10" fill="#16A34A" fontWeight="600">下界 {lower.toFixed(1)}</text>
        <line x1={clampedX} y1={BAND_Y - 8} x2={clampedX} y2={BAND_Y + BAND_H + 8} stroke={posColor} strokeWidth="1.2" strokeDasharray="3,2" opacity="0.5" />
        <circle cx={clampedX} cy={dotY} r="8" fill={posColor} opacity="0.12" />
        <circle cx={clampedX} cy={dotY} r="5" fill={posColor} />
        <circle cx={clampedX} cy={dotY} r="2.5" fill="white" />
        <rect x={Math.min(clampedX - 26, W - 56)} y={BAND_Y + BAND_H + 14} width="56" height="16" rx="3" fill={posColor} opacity="0.12" />
        <text x={Math.min(clampedX, W - 30)} y={BAND_Y + BAND_H + 26} fontSize="10" fill={posColor} fontWeight="700" textAnchor="middle">今日 {todayPrice} 元</text>
      </svg>
      <p style={{ fontSize: 11, color: 'var(--yz-mut)', marginTop: 6, lineHeight: 1.6 }}>
        今日價格位於 30 日正常區間的<strong style={{ color: posColor }}> {posLabel}</strong>
      </p>
      <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
        {[
          { color: 'rgba(22,163,74,0.25)', border: '1px dashed #16A34A', label: '正常區間（MA30 ± 1σ）' },
          { color: '#3B82F6', label: 'MA30', round: true },
          { color: '#6B7280', label: '今日均價', round: true },
        ].map(({ color, border, label, round }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--yz-mut)' }}>
            <div style={{ width: 10, height: 10, background: color, border: border || 'none', borderRadius: round ? '50%' : 2, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 行情解析卡 ────────────────────────────────────────────────────────────────

function PriceInsightCard({ detail, bollinger, todayPrice }) {
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
      <BollingerGauge bollinger={bollinger} todayPrice={todayPrice} />
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
    const visibleItems = sidebarItems.slice(0, 40); // 只載入前 40 個避免 burst
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

    // 水平線（均價 dataset = index 2，跳過正常上界/下界）
    const idx = chart._activeDataIndex;
    if (idx != null) {
      const priceDataset = chart.data.datasets[2]; // 均價
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
  const [period, setPeriod] = useState('90');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [history, setHistory] = useState(null);
  const [bollinger, setBollinger] = useState(null);
  // MA toggle: { ma7, ma30, ma90 }
  const [maVisible, setMaVisible] = useState({ ma7: true, ma30: true, ma90: true });

  const priceChartRef = useRef(null);
  const volChartRef = useRef(null);
  const priceChartInst = useRef(null);
  const volChartInst = useRef(null);

  // 載入走勢圖資料（固定拉 180 天，前端依 period 過濾）
  useEffect(() => {
    if (period === 'custom' && (!customFrom || !customTo)) return;
    setHistory(null);
    setBollinger(null);
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
        if (h.length >= 30) {
          const slice = h.slice(-30);
          const mean = slice.reduce((s, r) => s + r.price, 0) / 30;
          const variance = slice.reduce((s, r) => s + (r.price - mean) ** 2, 0) / 30;
          const sigma = Math.sqrt(variance);
          setBollinger({ upper: mean + sigma, lower: mean - sigma, mean });
        }
      })
      .catch(() => setHistory([]));
  }, [productName, market, period, customFrom, customTo]); // eslint-disable-line

  // 建立 Chart.js 圖表
  useEffect(() => {
    if (!history || !priceChartRef.current || !volChartRef.current) return;
    const sliced = history;
    if (sliced.length < 2) return;

    const labels = sliced.map(r => r.date.slice(5));
    const prices = sliced.map(r => r.price);
    const volumes = sliced.map(r => r.volume ?? null);

    const ma7  = calcMA(prices, 7);
    const ma30 = calcMA(prices, 30);
    const ma90 = calcMA(prices, 90);
    const std  = calcStd(prices.slice(-30));
    const upper = ma30.map(v => v != null ? parseFloat((v + std).toFixed(1)) : null);
    const lower = ma30.map(v => v != null ? parseFloat((v - std).toFixed(1)) : null);

    if (priceChartInst.current) { priceChartInst.current.destroy(); priceChartInst.current = null; }
    if (volChartInst.current) { volChartInst.current.destroy(); volChartInst.current = null; }

    priceChartInst.current = new Chart(priceChartRef.current, {
      type: 'line',
      plugins: [crosshairPlugin],
      data: {
        labels,
        datasets: [
          // index 0: 正常上界（fill 到 index 1）
          { label: '正常上界', data: upper, fill: '+1', backgroundColor: 'rgba(22,163,74,0.08)', borderColor: 'transparent', pointRadius: 0, tension: 0.3 },
          // index 1: 正常下界
          { label: '正常下界', data: lower, fill: false, borderColor: 'transparent', pointRadius: 0, tension: 0.3 },
          // index 2: 均價（crosshair plugin 讀這個）
          { label: '均價', data: prices, borderColor: '#1D9E75', borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, tension: 0.2, fill: false },
          // index 3: MA7
          { label: 'MA7',  data: ma7,  borderColor: MA_CONFIG.ma7.color,  borderWidth: 1.5, borderDash: MA_CONFIG.ma7.dash,  pointRadius: 0, tension: 0.2, fill: false, hidden: !maVisible.ma7 },
          // index 4: MA30
          { label: 'MA30', data: ma30, borderColor: MA_CONFIG.ma30.color, borderWidth: 1.5, borderDash: MA_CONFIG.ma30.dash, pointRadius: 0, tension: 0.2, fill: false, hidden: !maVisible.ma30 },
          // index 5: MA90
          { label: 'MA90', data: ma90, borderColor: MA_CONFIG.ma90.color, borderWidth: 1.5, borderDash: MA_CONFIG.ma90.dash, pointRadius: 0, tension: 0.2, fill: false, hidden: !maVisible.ma90 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: {
              filter: item => !['正常上界', '正常下界'].includes(item.text),
              font: { size: 11 }, boxWidth: 20,
            },
            onClick: (e, legendItem, legend) => {
              const label = legendItem.text;
              const key = label === 'MA7' ? 'ma7' : label === 'MA30' ? 'ma30' : label === 'MA90' ? 'ma90' : null;
              if (key) setMaVisible(prev => ({ ...prev, [key]: !prev[key] }));
              Chart.defaults.plugins.legend.onClick.call(legend.chart, e, legendItem, legend);
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                if (['正常上界', '正常下界'].includes(ctx.dataset.label)) return null;
                return ctx.raw != null ? `${ctx.dataset.label}：${ctx.raw} 元/kg` : null;
              },
              filter: item => item.raw != null,
            },
          },
        },
        scales: {
          // 價格圖隱藏 X 軸（由下方量圖的 X 軸代勞）
          x: { display: false },
          y: {
            position: 'right',
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { font: { size: 10 } },
            title: { display: true, text: '元/kg', font: { size: 10 }, color: 'var(--yz-mut)', padding: { bottom: 0 } },
          },
        },
      },
    });

    if (volumes.some(v => v != null)) {
      volChartInst.current = new Chart(volChartRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [{ label: '成交量', data: volumes, backgroundColor: 'rgba(156,163,175,0.45)', borderColor: 'rgba(156,163,175,0.7)', borderWidth: 1, borderRadius: 1 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => ctx.raw != null ? `成交量：${Math.round(ctx.raw).toLocaleString()} kg` : null } },
          },
          scales: {
            x: {
              ticks: {
                maxTicksLimit: 8,
                autoSkip: true,
                font: { size: 10 },
                maxRotation: 0,
              },
              grid: { display: false },
            },
            y: {
              position: 'right',
              ticks: { font: { size: 9 }, maxTicksLimit: 3 },
              grid: { color: 'rgba(0,0,0,0.04)' },
              title: { display: true, text: 'kg', font: { size: 10 }, color: 'var(--yz-mut)' },
            },
          },
        },
      });
    }

    return () => {
      if (priceChartInst.current) { priceChartInst.current.destroy(); priceChartInst.current = null; }
      if (volChartInst.current) { volChartInst.current.destroy(); volChartInst.current = null; }
    };
  }, [history]); // eslint-disable-line

  // MA 指標卡數值
  const allPrices = (history || []).map(r => r.price);
  const lastNonNull = arr => [...arr].reverse().find(v => v != null) ?? null;
  const ma7Val  = allPrices.length >= 7  ? lastNonNull(calcMA(allPrices, 7))  : null;
  const ma30Val = allPrices.length >= 30 ? lastNonNull(calcMA(allPrices, 30)) : null;
  const ma90Val = allPrices.length >= 90 ? lastNonNull(calcMA(allPrices, 90)) : null;

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
  // 今日均價染色（對比昨日）
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
        {[['7', '7 天'], ['30', '30 天'], ['90', '90 天']].map(([val, label]) => (
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

      {/* 2. 四格 metric 卡（今日均價改含漲跌資訊列）*/}
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
        <MetricMACard label="7 日均線" value={ma7Val} days={7} />
        <MetricMACard label="30 日均線" value={ma30Val} days={30} />
        <MetricMACard label="90 日均線" value={ma90Val} days={90} />
      </div>

      {/* 3. 走勢圖卡 */}
      <div className="yz-card" style={{ padding: '18px 22px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700 }}>{productName} · 走勢圖</h4>
          <span style={{ fontSize: 11, color: 'var(--yz-mut)' }}>
            {period === 'custom' && customFrom && customTo ? `${customFrom} ~ ${customTo}` : `近 ${period} 交易日`}
          </span>
        </div>

        {/* MA toggle 按鈕 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {Object.entries(MA_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => {
                setMaVisible(prev => ({ ...prev, [key]: !prev[key] }));
                if (priceChartInst.current) {
                  const dsIdx = key === 'ma7' ? 3 : key === 'ma30' ? 4 : 5;
                  const meta = priceChartInst.current.getDatasetMeta(dsIdx);
                  meta.hidden = maVisible[key];
                  priceChartInst.current.update();
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', border: '1.5px solid',
                background: maVisible[key] ? `${cfg.color}18` : 'transparent',
                color: maVisible[key] ? cfg.color : 'var(--yz-mut)',
                borderColor: maVisible[key] ? cfg.color : 'var(--yz-bdr)',
                transition: 'all .15s',
              }}
            >
              <span style={{ display: 'inline-block', width: 14, height: 2, background: maVisible[key] ? cfg.color : 'var(--yz-bdr)', borderRadius: 1 }} />
              {cfg.label}
            </button>
          ))}
        </div>

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

      {/* 4. 成交量卡（獨立卡片） */}
      {hasVolumeData && history !== null && history.length >= 2 && (
        <div className="yz-card" style={{ padding: '14px 22px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--yz-dim)' }}>成交量</span>
            <span style={{ fontSize: 10, color: 'var(--yz-mut)' }}>單位：kg</span>
          </div>
          <div style={{ height: 90 }}>
            <canvas ref={volChartRef} />
          </div>
        </div>
      )}

      {/* 5. 行情解析卡 */}
      <PriceInsightCard detail={detail} bollinger={bollinger} todayPrice={todayPrice} />

      {/* 6. AI 方向預測卡 */}
      <DirectionCard productName={productName} market={market} />
    </>
  );
}
