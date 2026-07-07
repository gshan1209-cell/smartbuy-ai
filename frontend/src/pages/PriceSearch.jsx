import { useState, useEffect } from 'react';
import { useApi, get } from '../hooks/useApi';

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

const labelStyle = { fontSize: 10, fontWeight: 700, color: 'var(--yz-dim)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 7 };
const metricLabel = { fontSize: 11, fontWeight: 600, color: 'var(--yz-mut)', marginBottom: 7 };

// 24節氣推薦食材沿用早期示範資料的命名，跟批發市場真實品名（crop_name）用詞不同，
// 例如「高麗菜」在真實資料叫「甘藍」、「冬瓜」沒有單一品項只有「冬瓜-其他」等細分品種。
// 這裡做別名對照，讓點擊後能找到對應的真實品項。
const PRODUCT_ALIASES = {
  '高麗菜': '甘藍',
  '空心菜': '蕹菜',
  '四季豆': '菜豆',
  '地瓜': '甘薯',
  '地瓜葉': '甘薯葉',
  '白蘿蔔': '蘿蔔',
  '青江菜': '青江白菜',
};

const EVENT_LABELS = {
  heavy_rain: { icon: '🌧', text: '多雨', color: '#1D4ED8' },
  drought:    { icon: '🏜', text: '乾旱', color: '#B45309' },
  high_heat:  { icon: '🌡', text: '高溫', color: '#DC2626' },
  cold_snap:  { icon: '🧊', text: '低溫', color: '#0891B2' },
};

function countyAdvice(county, events) {
  if (!events || events.length === 0) return null;
  const ev = events[0];
  const d = ev.detail || {};
  if (ev.type === 'heavy_rain') {
    const days = d.rain_days ?? 0;
    if (days >= 5) return `${county}連續 ${days} 天有效降雨，採收困難，建議等雨停後 10 天再大量出貨`;
    if (days >= 3) return `${county}有效雨日 ${days} 天，採收品質不穩，建議觀望 7 天`;
    return `${county}降雨集中但天數少（${days} 天），採收窗口相對充裕，可適量安排出貨`;
  }
  if (ev.type === 'drought') return `${county}雨量偏少，加強灌溉，密切注意後續行情`;
  if (ev.type === 'high_heat') return `${county}高溫持續 ${d.high_heat_days ?? ''} 天，葉菜老化加速，少量多批出貨`;
  if (ev.type === 'cold_snap') return `${county}氣溫偏低，葉菜生長加速，供應增加，短期可能降價`;
  return null;
}

// 合併「行情分析」與「天氣影響」成統一的行情解析卡
function PriceInsightCard({ detail }) {
  const [weatherExpanded, setWeatherExpanded] = useState(true);
  const impact = detail?.weather_impact;
  const priceStatus = detail?.price_status;
  const todayPrice = detail?.today_price;
  const recentAvg = detail?.price_detail?.recent_average;
  const reason = detail?.price_detail?.reason;
  const advice = detail?.advice;
  const suggestion = detail?.price_detail?.suggestion;

  const priceDiff = todayPrice && recentAvg
    ? Math.round((todayPrice - recentAvg) / recentAvg * 100)
    : null;

  const hasWeather = impact?.has_impact;
  const counties = impact?.all_counties || impact?.county_details || [];
  const allRains = counties.map(c => { const ev = (c.events || [])[0]; return ev ? (ev.detail?.rain_total_mm ?? 0) : 0; });
  const maxRain = Math.max(...allRains, 200) * 1.1;
  const warnPct = (200 / maxRain) * 100;
  const period = counties.find(c => c.impact_period && !c.no_data)?.impact_period;
  const showPriceCorr = impact?.overall_direction === 'up' && priceStatus === '偏貴' && priceDiff > 10;
  const affectedAdvices = counties.filter(c => c.events?.length > 0).map(c => countyAdvice(c.county, c.events)).filter(Boolean);

  const priceEmoji = priceStatus === '便宜' ? '📉' : priceStatus === '偏貴' ? '📈' : '📊';

  return (
    <div className="yz-card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
      {/* 行情說明（常駐展開） */}
      <div style={{ padding: '16px 20px', borderBottom: hasWeather ? '1px solid var(--yz-bdr)' : 'none' }}>
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

      {/* 天氣影響（有異常才展開，無異常顯示小條） */}
      {impact && !hasWeather && (
        <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6, background: '#F0FDF4', fontSize: 12, color: '#15803D' }}>
          <span>✓</span>
          <span>近期產地天氣正常</span>
          {impact.all_counties?.length > 0 && (
            <span style={{ color: '#86EFAC', fontSize: 11 }}>（{impact.all_counties.map(c => c.county).join('、')}）</span>
          )}
        </div>
      )}
      {hasWeather && (
        <div style={{ background: '#FFFBF5' }}>
          {/* 天氣區標題 */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid #FEE9C9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>⛈</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#92400E' }}>產地天氣異常</span>
              {impact.overall_direction === 'up' && <span className="yz-bdg yz-bdg-o">供應風險 ↑</span>}
              {impact.overall_direction === 'down' && <span className="yz-bdg yz-bdg-g">供應充足 ↓</span>}
              {period && (
                <span style={{ fontSize: 10, color: '#B45309', background: '#FEF3C7', padding: '2px 7px', borderRadius: 4 }}>
                  {period.from} ～ {period.to}
                </span>
              )}
            </div>
            <button onClick={() => setWeatherExpanded(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#B45309', fontWeight: 600 }}>
              {weatherExpanded ? '▴ 收合' : '▾ 展開'}
            </button>
          </div>

          {weatherExpanded && (
            <>
              {/* 縣市雨量條 */}
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #FEE9C9' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                  各產地 · 累積降雨 vs 200mm 警戒
                </p>
                {counties.map(c => {
                  const ev = (c.events || [])[0];
                  const rain = ev ? (ev.detail?.rain_total_mm ?? 0) : 0;
                  const days = ev ? (ev.detail?.rain_days ?? 0) : 0;
                  const vsNormal = ev ? (ev.detail?.vs_normal_pct ?? null) : null;
                  const hasEvent = c.events?.length > 0;
                  const noData = c.no_data === true;
                  const evMeta = ev ? (EVENT_LABELS[ev.type] || {}) : {};
                  const fillPct = rain > 0 ? Math.min((rain / maxRain) * 100, 100) : 0;
                  const isOverWarn = rain >= 200;
                  return (
                    <div key={c.county} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid #FFF3E0', opacity: hasEvent ? 1 : noData ? 0.35 : 0.6 }}>
                      <div style={{ width: 44, flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{c.county}</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>{Math.round(c.weight * 100)}%</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#6B7280', marginBottom: 3 }}>
                          <span>
                            {noData ? <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>無測站資料</span>
                              : rain > 0 ? <><strong style={{ color: '#B45309' }}>{rain} mm</strong>{vsNormal !== null && vsNormal > 0 ? ` (+${vsNormal}%)` : vsNormal !== null && vsNormal < 0 ? ` (${vsNormal}%)` : ''}</>
                              : '正常'}
                          </span>
                          {hasEvent && (
                            <span style={{ color: isOverWarn ? '#EF4444' : '#F59E0B', fontWeight: 600 }}>
                              {evMeta.icon} {evMeta.text}{isOverWarn ? ' ⚠ 超警戒' : ' ⚠ 超基準'}
                            </span>
                          )}
                        </div>
                        <div style={{ position: 'relative', height: 7, background: '#FEF3C7', borderRadius: 4, overflow: 'hidden' }}>
                          {fillPct > 0 && (
                            <div style={{ height: '100%', width: `${fillPct}%`, borderRadius: 4, background: isOverWarn ? 'linear-gradient(90deg,#F59E0B,#EF4444)' : '#FCD34D' }} />
                          )}
                          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${warnPct}%`, width: 2, background: '#EF4444', opacity: .7 }} />
                        </div>
                      </div>
                      <div style={{ width: 36, flexShrink: 0, textAlign: 'right', fontSize: 10.5, color: '#9CA3AF' }}>
                        {days > 0 ? <><strong style={{ fontSize: 11, color: '#B45309' }}>{days}</strong>天</> : '—'}
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
                  <span>■ <span style={{ color: '#F59E0B' }}>超基準</span></span>
                  <span>■ <span style={{ color: '#EF4444' }}>超 200mm</span></span>
                  <span style={{ marginLeft: 'auto' }}>右側 = 有效雨日</span>
                </div>
              </div>

              {/* 價格天氣關聯 */}
              {showPriceCorr && (
                <div style={{ padding: '10px 20px', borderBottom: '1px solid #FEE9C9', display: 'flex', gap: 8, background: '#FFF7ED' }}>
                  <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>📈</span>
                  <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.65 }}>
                    今日均價 <strong>{todayPrice} 元</strong>，比 30 天均價高 <strong>{priceDiff}%</strong>（均價 {recentAvg} 元）。
                    {impact.affected_counties?.length > 0 && `${impact.affected_counties.join('、')}近期持續降雨，供應縮減可能是主要漲價原因。`}
                  </p>
                </div>
              )}

              {/* 建議 */}
              <div style={{ padding: '10px 20px' }}>
                {affectedAdvices.length > 0
                  ? affectedAdvices.map((text, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < affectedAdvices.length - 1 ? 8 : 0 }}>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>💡</span>
                      <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.65 }}>{text}</p>
                    </div>
                  ))
                  : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 13 }}>💡</span>
                      <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.65 }}>{impact.farmer_advice}</p>
                    </div>
                  )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const DIRECTION_META = {
  up:   { label: '預測明日看漲', color: '#DC2626', bg: '#FEF2F2', badge: '#FCA5A5', arrow: '↑' },
  down: { label: '預測明日看跌', color: '#16A34A', bg: '#F0FDF4', badge: '#86EFAC', arrow: '↓' },
  flat: { label: '預測明日持平', color: '#6B7280', bg: '#F9FAFB', badge: '#D1D5DB', arrow: '→' },
};

// 將每日批次表的欄位正規化成 DirectionCard 的統一格式
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
    confidence_level: d.confidence_level,
    data_staleness_days: d.data_staleness_days,
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

    const batchParams = market
      ? `crop_name=${encodeURIComponent(productName)}&market_name=${encodeURIComponent(market)}`
      : `crop_name=${encodeURIComponent(productName)}`;

    get(`/api/predictions/direction/latest?${batchParams}`)
      .then(d => setData(_normalizeBatchPrediction(d)))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [productName, market]);

  if (loading) return (
    <div style={{ padding: '10px 14px', borderRadius: 8, background: '#F9FAFB', fontSize: 12, color: 'var(--yz-mut)' }}>
      AI 方向預測載入中…
    </div>
  );

  if (!data || !data.direction) return (
    <div style={{ padding: '10px 14px', borderRadius: 8, background: '#F9FAFB', fontSize: 12, color: 'var(--yz-mut)' }}>
      ✦ AI 方向預測：{data?.note || '資料不足，無法預測'}
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
    <div style={{ borderRadius: 10, border: `1.5px solid ${meta.badge}`, background: meta.bg, overflow: 'hidden' }}>
      {/* 標題列 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${meta.badge}` }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>{meta.arrow}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: meta.color }}>{meta.label}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 12,
              background: meta.badge, color: meta.color,
            }}>信心 {confPct}%</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--yz-mut)', marginTop: 2 }}>
            依據截至 {data.trade_date} 的歷史行情，LightGBM 模型預測
          </p>
        </div>
      </div>

      {/* 機率條 */}
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

      {/* 風險提醒（批次資料才有） */}
      {data.risk_level && data.risk_level !== 'normal' && data.risk_note && (
        <div style={{ margin: '0 16px 10px', padding: '8px 10px', borderRadius: 6, background: data.risk_level === 'high' ? '#FEF2F2' : '#FFFBEB', fontSize: 11, color: data.risk_level === 'high' ? '#DC2626' : '#92400E' }}>
          ⚠ {data.risk_note}
        </div>
      )}

      {/* 資料新鮮度（批次才有） */}
      {data.data_staleness_days > 0 && (
        <div style={{ padding: '0 16px 6px', fontSize: 10, color: 'var(--yz-mut)' }}>
          依據 {data.data_staleness_days} 天前交易資料推算
        </div>
      )}

      <div style={{ padding: '0 16px 10px', fontSize: 10, color: 'var(--yz-mut)' }}>
        ＊預測方向準確率約 51%，僅供參考，請勿作為唯一採買依據
      </div>
    </div>
  );
}

function PriceChart({ productName, market }) {
  const [history, setHistory] = useState(null);
  const [tooltip, setTooltip] = useState(null); // {x, y, date, price}

  useEffect(() => {
    if (!productName) return;
    setHistory(null);
    const params = market ? `?market=${encodeURIComponent(market)}` : '';
    get(`/api/products/${encodeURIComponent(productName)}/history${params}`)
      .then(d => setHistory(d.history || []))
      .catch(() => setHistory([]));
  }, [productName, market]);

  if (history === null) return <div style={{ height: 148, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--yz-dim)', fontSize: 12 }}>載入中…</div>;
  if (history.length < 2) return <div style={{ height: 60, display: 'flex', alignItems: 'center', color: 'var(--yz-dim)', fontSize: 12 }}>歷史資料不足，無法繪製走勢圖</div>;

  // layout
  const W = 650, H = 148, PAD_L = 44, PAD_R = 16, PAD_T = 14, PAD_B = 28;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const prices = history.map(r => r.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;

  const toX = i => PAD_L + (i / (history.length - 1)) * chartW;
  const toY = p => PAD_T + chartH - ((p - minP) / range) * chartH;

  const points = history.map((r, i) => [toX(i), toY(r.price)]);
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = linePath + ` L${points[points.length - 1][0].toFixed(1)},${(PAD_T + chartH).toFixed(1)} L${PAD_L},${(PAD_T + chartH).toFixed(1)} Z`;

  // y-axis ticks (3 lines)
  const ticks = [0, 0.5, 1].map(t => ({
    y: PAD_T + chartH * (1 - t),
    label: (minP + range * t).toFixed(1),
  }));

  // x-axis labels: first, mid, last
  const xLabels = [0, Math.floor((history.length - 1) / 2), history.length - 1].map(i => ({
    x: toX(i),
    label: history[i].date.slice(5), // MM-DD
  }));

  const lastPt = points[points.length - 1];

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
        style={{ overflow: 'visible', display: 'block' }}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="yz-cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1D9E75" stopOpacity="0.13" />
            <stop offset="100%" stopColor="#1D9E75" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* grid lines */}
        {ticks.map(t => (
          <g key={t.label}>
            <line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} stroke="#E2DDD2" strokeWidth="1" />
            <text x={PAD_L - 4} y={t.y + 3.5} fontSize="9" fill="#9B9A90" textAnchor="end">{t.label}</text>
          </g>
        ))}

        {/* area + line */}
        <path d={areaPath} fill="url(#yz-cg)" />
        <path d={linePath} stroke="#1D9E75" strokeWidth="2.2" fill="none" strokeLinejoin="round" strokeLinecap="round" />

        {/* latest dot */}
        <circle cx={lastPt[0]} cy={lastPt[1]} r="4.5" fill="white" stroke="#1D9E75" strokeWidth="2.2" />

        {/* x labels */}
        {xLabels.map(l => (
          <text key={l.label} x={l.x} y={H - 4} fontSize="9" fill="#9B9A90" textAnchor="middle">{l.label}</text>
        ))}

        {/* hover detection strips */}
        {history.map((r, i) => {
          const x = toX(i);
          const y = toY(r.price);
          const stripW = chartW / history.length;
          return (
            <rect
              key={i}
              x={x - stripW / 2} y={PAD_T} width={stripW} height={chartH}
              fill="transparent"
              onMouseEnter={() => setTooltip({ x, y, date: r.date, price: r.price })}
            />
          );
        })}

        {/* tooltip crosshair */}
        {tooltip && (
          <>
            <line x1={tooltip.x} y1={PAD_T} x2={tooltip.x} y2={PAD_T + chartH} stroke="#1D9E75" strokeWidth="1" strokeDasharray="3,2" />
            <circle cx={tooltip.x} cy={tooltip.y} r="3.5" fill="#1D9E75" />
          </>
        )}
      </svg>

      {/* tooltip box */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: `calc(${(tooltip.x / W) * 100}% + 8px)`,
          top: tooltip.y - 10,
          background: '#1A1A18',
          color: '#fff',
          borderRadius: 6,
          padding: '4px 8px',
          fontSize: 11,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 10,
          transform: tooltip.x > W * 0.7 ? 'translateX(-110%)' : 'none',
        }}>
          <span style={{ color: '#86EFAC' }}>{tooltip.date}</span>
          <span style={{ marginLeft: 6, fontWeight: 700 }}>{tooltip.price} 元</span>
        </div>
      )}
    </div>
  );
}

function AuctionDetailModal({ detail, onClose }) {
  const d = detail.price_detail || {};
  const rows = [
    ['交易日期', d.trans_date || '—'],
    ['批發市場', d.market_name || '—'],
    ['上價', d.upper_price != null ? `${d.upper_price} 元/kg` : '—'],
    ['中價（今日均價）', d.middle_price != null ? `${d.middle_price} 元/kg` : '—'],
    ['下價', d.lower_price != null ? `${d.lower_price} 元/kg` : '—'],
    ['交易量', d.volume != null ? `${d.volume} 公斤` : '—'],
  ];
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,24,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
    >
      <div onClick={e => e.stopPropagation()} className="yz-card" style={{ width: 360, padding: '24px 26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{detail.product_name} · 拍賣行情明細</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--yz-dim)' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingBottom: 8, borderBottom: '1px solid #F0ECE5' }}>
              <span style={{ color: 'var(--yz-mut)' }}>{label}</span>
              <span style={{ fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PriceListPanel() {
  const [query, setQuery] = useState('');
  const [markets, setMarkets] = useState([]);
  const [market, setMarket] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [selectedName, setSelectedName] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [auctionModalOpen, setAuctionModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sortBy, setSortBy] = useState('default');

  useEffect(() => {
    get('/api/markets').then(d => {
      const list = d.markets || [];
      setMarkets(list);
      setMarket(prev => prev || list[0] || '');
    }).catch(() => setMarkets([]));
  }, []);

  async function doSearch(q, m, autoSelect = true) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (m) params.set('market', m);
      const data = await get(`/api/products?${params.toString()}`);
      setItems(data);
      if (data.length && autoSelect) openDetail(data[0].product_name, m);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { doSearch('', '', true); }, []); // eslint-disable-line

  async function openDetail(name, m = market) {
    setSelectedName(name);
    setDetailLoading(true);
    setAuctionModalOpen(false);
    try {
      const params = m ? `?market=${encodeURIComponent(m)}` : '';
      const d = await get(`/api/products/${encodeURIComponent(name)}${params}`);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function resolveAndJump(name) {
    // 24節氣的推薦食材名稱可能跟真實品項用詞不同，改用搜尋＋別名比對找出最接近的真實品項
    const term = PRODUCT_ALIASES[name] || name;
    try {
      const matches = await get(`/api/products?q=${encodeURIComponent(term)}`);
      if (matches.length) {
        openDetail(matches[0].product_name);
        return;
      }
    } catch { /* fall through to not-found state below */ }
    setSelectedName(name);
    setDetail(null);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    setShowAll(false);
    doSearch(query, market);
  }

  function handleMarketChange(e) {
    const m = e.target.value;
    setMarket(m);
    setShowAll(false);
    doSearch(query, m);
  }

  const isFiltering = query.trim() !== '';

  function diffPct(item) {
    if (item.today_price == null || !item.recent_average) return null;
    return Math.round((item.today_price - item.recent_average) / item.recent_average * 100);
  }

  const processedItems = (() => {
    let list = filterStatus ? items.filter(i => i.status === filterStatus) : items;
    if (sortBy === 'diff_desc') {
      list = [...list].sort((a, b) => (diffPct(b) ?? -999) - (diffPct(a) ?? -999));
    } else if (sortBy === 'diff_asc') {
      list = [...list].sort((a, b) => (diffPct(a) ?? 999) - (diffPct(b) ?? 999));
    } else {
      list = [...list].sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9));
    }
    return list;
  })();

  const visibleItems = isFiltering || showAll || filterStatus
    ? processedItems
    : processedItems.slice(0, FEATURED_COUNT);

  return (
    <div>
      <SolarTermStrip onJumpToProduct={resolveAndJump} />
    <div className="yz-price-layout" style={{ display: 'flex', minHeight: 600, border: '1px solid var(--yz-bdr)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      {/* Left sidebar */}
      <div className="yz-price-sidebar" style={{ width: 256, flexShrink: 0, borderRight: '1px solid var(--yz-bdr)', display: 'flex', flexDirection: 'column' }}>
        <form onSubmit={handleSearchSubmit} style={{ padding: '14px 14px 10px' }}>
          <input className="yz-input" placeholder="搜尋品項..." value={query} onChange={e => setQuery(e.target.value)} />
        </form>
        <div style={{ padding: '0 14px 10px' }}>
          <p style={labelStyle}>批發市場</p>
          <select className="yz-input" value={market} onChange={handleMarketChange} style={{ fontSize: 13 }}>
            {markets.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {/* 篩選 + 排序 */}
        <div style={{ padding: '8px 14px 10px', borderBottom: '1px solid var(--yz-bdr)' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 7 }}>
            {[['', '全部'], ['便宜', '↓ 便宜'], ['正常', '→ 正常'], ['偏貴', '↑ 偏貴']].map(([val, label]) => (
              <button key={val} onClick={() => { setFilterStatus(val); setShowAll(false); }}
                style={{
                  flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                  background: filterStatus === val ? 'var(--yz-g)' : '#F7F4EF',
                  color: filterStatus === val ? '#fff' : 'var(--yz-mut)',
                  borderColor: filterStatus === val ? 'var(--yz-g)' : 'var(--yz-bdr)',
                }}
              >{label}</button>
            ))}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 11, border: '1px solid var(--yz-bdr)', color: 'var(--yz-mut)', background: '#F7F4EF', cursor: 'pointer', fontFamily: 'inherit' }}>
            <option value="default">排序：預設（依狀態）</option>
            <option value="diff_desc">排序：漲幅最高優先</option>
            <option value="diff_asc">排序：跌幅最大優先</option>
          </select>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!isFiltering && !filterStatus && (
            <p style={{ padding: '10px 14px 2px', fontSize: 10, fontWeight: 700, color: 'var(--yz-dim)', letterSpacing: '.07em', textTransform: 'uppercase' }}>
              {showAll ? `全部品項（${items.length}）` : '精選品項'}
            </p>
          )}
          {filterStatus && !loading && (
            <p style={{ padding: '10px 14px 2px', fontSize: 10, fontWeight: 700, color: 'var(--yz-dim)', letterSpacing: '.07em', textTransform: 'uppercase' }}>
              {filterStatus}（{processedItems.length} 項）
            </p>
          )}
          {loading && <p style={{ padding: 14, fontSize: 12, color: 'var(--yz-dim)' }}>載入中...</p>}
          {!loading && items.length === 0 && <p style={{ padding: 14, fontSize: 12, color: 'var(--yz-dim)' }}>查無品項，請先啟動 API 伺服器或換個關鍵字</p>}
          {visibleItems.map(item => {
            const active = item.product_name === selectedName;
            const { arrow, color } = STATUS_ARROW[item.status] || STATUS_ARROW['資料不足'];
            const wev = item.weather_risk ? (EVENT_LABELS[item.weather_risk] || {}) : null;
            return (
              <div
                key={item.product_name}
                onClick={() => openDetail(item.product_name)}
                style={{
                  padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F0ECE5',
                  background: active ? 'var(--yz-gl)' : 'transparent',
                  borderLeft: active ? '3px solid var(--yz-g)' : '3px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: active ? 700 : 400, color: active ? 'var(--yz-gd)' : 'var(--yz-txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</span>
                    {wev && <span title={`產地${wev.text}`} style={{ fontSize: 11, flexShrink: 0 }}>{wev.icon}</span>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color, flexShrink: 0, marginLeft: 4 }}>{arrow} {item.status}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--yz-g)' : 'var(--yz-dim)' }}>
                    {item.today_price != null ? `${item.today_price} 元/kg` : '暫無報價'}
                  </span>
                  {(() => {
                    const d = diffPct(item);
                    if (d == null) return null;
                    const dc = d > 0 ? '#DC2626' : d < 0 ? '#16A34A' : '#9CA3AF';
                    return <span style={{ fontSize: 11, fontWeight: 600, color: dc }}>{d > 0 ? `+${d}` : d}%</span>;
                  })()}
                </div>
              </div>
            );
          })}
          {!isFiltering && !loading && items.length > FEATURED_COUNT && (
            <button
              onClick={() => setShowAll(v => !v)}
              style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderTop: '1px solid var(--yz-bdr)', color: 'var(--yz-g)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              {showAll ? '▴ 收合' : `顯示全部 ${items.length} 項 ▾`}
            </button>
          )}
        </div>
      </div>

      {/* Right detail panel */}
      <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
        {!selectedName && <p style={{ color: 'var(--yz-dim)', fontSize: 14 }}>請從左側選擇品項查看詳情</p>}
        {selectedName && detailLoading && <p style={{ color: 'var(--yz-dim)', fontSize: 14 }}>載入中...</p>}
        {selectedName && !detailLoading && !detail && <p style={{ color: 'var(--yz-dim)', fontSize: 14 }}>無法取得詳細資料</p>}
        {selectedName && !detailLoading && detail && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                <h2 style={{ fontSize: 24, fontWeight: 900 }}>{detail.product_name}</h2>
                <span className={`yz-bdg ${STATUS_BADGE[detail.price_status] || 'yz-bdg-gr'}`}>{detail.price_status}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--yz-mut)' }}>
                {detail.price_detail?.market_name ? `${detail.price_detail.market_name} · ` : ''}近 30 天資料
              </p>
            </div>

            {(() => {
              const diffPct = detail.today_price && detail.price_detail?.recent_average
                ? Math.round((detail.today_price - detail.price_detail.recent_average) / detail.price_detail.recent_average * 100)
                : null;
              const diffColor = diffPct == null ? 'var(--yz-dim)' : diffPct > 0 ? '#DC2626' : diffPct < 0 ? '#16A34A' : '#888';
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}>
                  <div
                    className="yz-card yz-metric-clickable"
                    style={{ padding: '16px 20px', cursor: 'pointer', transition: 'box-shadow .15s' }}
                    onClick={() => setAuctionModalOpen(true)}
                    title="點擊查看完整拍賣行情明細"
                  >
                    <p style={metricLabel}>今日均價</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                      <span style={{ fontSize: 30, fontWeight: 900 }}>{detail.today_price ?? '—'}</span>
                      <span style={{ fontSize: 13, color: 'var(--yz-mut)' }}>元/kg</span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--yz-g)', fontWeight: 600, marginTop: 6 }}>拍賣明細 →</p>
                  </div>
                  <div className="yz-card" style={{ padding: '16px 20px' }}>
                    <p style={metricLabel}>30 天均價</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                      <span style={{ fontSize: 30, fontWeight: 900 }}>{detail.price_detail?.recent_average ?? '—'}</span>
                      <span style={{ fontSize: 13, color: 'var(--yz-mut)' }}>元/kg</span>
                    </div>
                  </div>
                  <div className="yz-card" style={{ padding: '16px 20px' }}>
                    <p style={metricLabel}>漲跌幅（30 天）</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 30, fontWeight: 900, color: diffColor }}>
                        {diffPct == null ? '—' : diffPct > 0 ? `+${diffPct}` : diffPct}
                      </span>
                      {diffPct != null && <span style={{ fontSize: 13, color: diffColor }}>%</span>}
                    </div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--yz-g)', marginTop: 6 }}>{detail.recommendation}</p>
                  </div>
                </div>
              );
            })()}

            <div className="yz-card" style={{ padding: '20px 24px', marginBottom: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{detail.product_name} · 30 天走勢</h4>
              <PriceChart productName={detail.product_name} market={market} />
            </div>

            <PriceInsightCard detail={detail} />

            <DirectionCard productName={detail.product_name} market={market} />
          </>
        )}
      </div>

      {auctionModalOpen && detail && (
        <AuctionDetailModal detail={detail} onClose={() => setAuctionModalOpen(false)} />
      )}
    </div>
    </div>
  );
}

const SEASON_EMOJI = { 春: '🌸', 夏: '☀️', 秋: '🍂', 冬: '❄️' };

function getNextTermCountdown(terms) {
  if (!terms?.length) return null;
  const today = new Date();
  const todayKey = (today.getMonth() + 1) * 100 + today.getDate();
  const sorted = [...terms].sort((a, b) => (a.start_month * 100 + a.start_day) - (b.start_month * 100 + b.start_day));
  let next = sorted.find(t => (t.start_month * 100 + t.start_day) > todayKey);
  let year = today.getFullYear();
  if (!next) { next = sorted[0]; year += 1; }
  const nextDate = new Date(year, next.start_month - 1, next.start_day);
  const days = Math.round((nextDate - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  return { name: next.term_name, days };
}

function SolarTermStrip({ onJumpToProduct }) {
  const { data: term } = useApi('/api/solar-term');
  const { data: all } = useApi('/api/solar-term/all');
  const countdown = getNextTermCountdown(all);
  if (!term) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--yz-gl)', border: '1px solid var(--yz-bdr)', borderRadius: 10, padding: '10px 16px', marginBottom: 14, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 20 }}>{SEASON_EMOJI[term.season] || '🌿'}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--yz-gd)' }}>{term.term_name}</span>
        <span className="yz-bdg yz-bdg-g">{term.season}季</span>
        {countdown && (
          <span style={{ fontSize: 11, color: 'var(--yz-mut)' }}>· 距「{countdown.name}」還有 {countdown.days} 天</span>
        )}
      </div>
      {term.recommended_products?.length > 0 && (
        <>
          <div style={{ width: 1, height: 18, background: 'var(--yz-bdr)', flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10.5, color: 'var(--yz-mut)', flexShrink: 0 }}>本節氣推薦：</span>
            {term.recommended_products.map(p => (
              <button key={p} onClick={() => onJumpToProduct(p)} className="yz-bdg yz-bdg-g" style={{ border: 'none', cursor: 'pointer' }} title={`查看「${p}」行情`}>{p}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function PriceSearch() {
  return (
    <div className="yz-page yz-price-page" style={{ padding: '28px 40px 56px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <PriceListPanel />
      </div>
    </div>
  );
}
