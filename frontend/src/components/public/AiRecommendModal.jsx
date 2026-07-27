import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  RefreshCw,
  ShoppingBasket,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { post } from '../../hooks/useApi';
import './AiRecommendModal.css';

const STATUS_CONFIG = {
  便宜: { label: '便宜', className: 'ai-result-item--cheap ai-dashboard-status--cheap', icon: TrendingDown },
  正常: { label: '正常', className: 'ai-result-item--normal ai-dashboard-status--normal', icon: ShoppingBasket },
  偏貴: { label: '偏貴', className: 'ai-result-item--expensive ai-dashboard-status--expensive', icon: TrendingUp },
  資料不足: { label: '資料不足', className: 'ai-result-item--unknown ai-dashboard-status--unknown', icon: CircleDollarSign },
};

const PREFERENCE_OPTIONS = [
  { value: 3, label: '精選 3 項', description: '快速決定今天買什麼' },
  { value: 6, label: '均衡 6 項', description: '兼顧選擇與閱讀速度' },
  { value: 10, label: '完整 10 項', description: '一次比較更多行情' },
];

function formatGeneratedAt(value) {
  if (!value) return '時間未提供';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '時間未提供'
    : date.toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getErrorMessage(error) {
  try {
    const parsed = JSON.parse(error?.message || '');
    return parsed.detail || 'AI 推薦服務暫時無法使用，請稍後再試。';
  } catch {
    return error?.message || 'AI 推薦服務暫時無法使用，請稍後再試。';
  }
}

function PreferenceField({ label, htmlFor, children }) {
  return (
    <label className="ai-preference-field" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function StatusIcon({ status }) {
  const Icon = STATUS_CONFIG[status]?.icon || CircleDollarSign;
  return <Icon size={16} aria-hidden="true" />;
}

function ResultItem({ item }) {
  const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.資料不足;
  const statusClass = config.className.split(' ')[0];
  const advice = item.status === '便宜'
    ? '可以優先列入今天的菜籃'
    : item.status === '偏貴'
      ? '可先比較其他市場或替代品'
      : item.status === '正常'
        ? '價格平穩，依需求採買即可'
        : '行情資料不足，建議先查詢確認';

  return (
    <article className={`ai-result-item ${config.className}`}>
      <div className="ai-result-item-heading">
        <div className="ai-result-item-title">
          <span className={`ai-result-status-icon ${statusClass}`}><StatusIcon status={item.status} /></span>
          <div>
            <strong>{item.product_name || '未命名品項'}</strong>
            <small>今日行情</small>
          </div>
        </div>
        <span className="ai-result-status"><StatusIcon status={item.status} />{config.label}</span>
      </div>
      <div className="ai-result-price">
        <CircleDollarSign size={17} aria-hidden="true" />
        <span>{item.today_price == null ? '—' : item.today_price}</span>
        <small>元／公斤</small>
      </div>
      <p>{advice}</p>
    </article>
  );
}

function ResultDashboard({ data }) {
  const items = data?.items || [];
  const counts = Object.keys(STATUS_CONFIG).map((status) => ({
    status,
    count: items.filter((item) => item.status === status).length,
  }));
  const availableCount = items.filter((item) => item.today_price != null).length;
  const isFallback = data?.generator === 'rules-fallback' || data?.source === 'rules-fallback';
  const isSeed = data?.data_status === 'static_seed';

  return (
    <section className="ai-result-dashboard" aria-labelledby="ai-result-title">
      <div className="ai-dashboard-heading">
        <div>
        <p className="ai-section-kicker">Recommendation dashboard</p>
          <h2 id="ai-result-title">推薦結果</h2>
          <p>依照你選的條件整理今日行情，先看摘要，再比較各品項價格狀態。</p>
          {isSeed && <p className="ai-data-notice">目前顯示 Static Seed 樣板資料，非指定市場的即時行情。</p>}
        </div>
        <span className={`ai-source-badge${data?.cached ? ' ai-source-badge--cached' : ''}${isFallback ? ' ai-source-badge--fallback' : ''}`}>
          {isSeed ? '樣板資料' : data?.cached ? '快取結果' : isFallback ? '規則備援' : '即時生成'}
        </span>
      </div>

      <div className="ai-kpi-grid" aria-label="推薦結果摘要">
        <div className="ai-kpi-card ai-kpi-card--primary">
          <span>可參考品項</span>
          <strong>{availableCount}</strong>
          <small>共 {items.length} 項推薦</small>
        </div>
        {counts.slice(0, 3).map(({ status, count }) => (
          <div className="ai-kpi-card" key={status}>
            <span><StatusIcon status={status} />{status}</span>
            <strong>{count}</strong>
            <small>項</small>
          </div>
        ))}
      </div>

      <div className="ai-summary-panel">
        <div className="ai-summary-icon"><Bot size={20} aria-hidden="true" /></div>
        <div>
          <h3>AI 採買觀察</h3>
          <div className="ai-summary-text">
            {(data?.summary || '目前沒有摘要內容。').split('\n').map((line, index) => (
              line.trim() ? <p key={`${line}-${index}`}>{line}</p> : null
            ))}
          </div>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="ai-results-list">
          <div className="ai-results-list-heading">
            <h3><BarChart3 size={18} aria-hidden="true" />品項行情比較</h3>
            <span>{items.length} 項</span>
          </div>
          <div className="ai-result-items-grid">
            {items.map((item, index) => <ResultItem key={`${item.product_name}-${index}`} item={item} />)}
          </div>
        </div>
      ) : (
        <div className="ai-empty-results">
          <AlertCircle size={20} aria-hidden="true" />
          <p>目前沒有可用的行情品項，請換一個市場或稍後再試。</p>
        </div>
      )}

      <footer className="ai-dashboard-meta">
        <span><Clock3 size={14} aria-hidden="true" />資料時間：{formatGeneratedAt(data?.generated_at)}</span>
        <span>行情來源：{data?.source_name || (isSeed ? 'Static Seed' : '正式行情資料')}</span>
        <span>生成方式：{isFallback ? '規則備援' : (data?.source || 'AI 推薦 API')}</span>
        <span className="ai-disclaimer">AI 建議僅供參考，實際行情以市場為準</span>
      </footer>
    </section>
  );
}

export default function AiRecommendModal({ open, onClose, markets = [] }) {
  const dialogRef = useRef(null);
  const [region, setRegion] = useState('');
  const [market, setMarket] = useState('');
  const [topN, setTopN] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const selectedPreference = useMemo(
    () => PREFERENCE_OPTIONS.find((option) => option.value === topN) || PREFERENCE_OPTIONS[1],
    [topN],
  );

  useEffect(() => {
    if (!open) return undefined;
    const previousActiveElement = document.activeElement;
    dialogRef.current?.focus();
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previousActiveElement?.focus?.();
    };
  }, [open, onClose]);

  async function fetchRecommendation() {
    setLoading(true);
    setError(null);
    try {
      const result = await post('/api/ai-recommend', {
          market: market || null,
          region: region || null,
          top_n: topN,
        }, { timeoutMs: 30000 });
      setData(result);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    fetchRecommendation();
  }

  if (!open) return null;

  return (
    <div className="ai-modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="ai-modal" role="dialog" aria-modal="true" aria-labelledby="ai-modal-title" ref={dialogRef} tabIndex={-1}>
        <header className="ai-modal-header">
          <div className="ai-modal-title-group">
            <span className="ai-modal-title-icon"><Sparkles size={18} aria-hidden="true" /></span>
            <div>
              <p className="ai-modal-kicker">SmartBuy AI</p>
              <h1 id="ai-modal-title">AI 採買推薦</h1>
            </div>
          </div>
          <button type="button" className="ai-modal-close" aria-label="關閉 AI 採買推薦" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="ai-modal-body">
          <section className="ai-preference-panel" aria-labelledby="ai-preference-title">
            <div className="ai-panel-heading">
              <div>
                <p className="ai-section-kicker">Step 1 · Preferences</p>
                <h2 id="ai-preference-title">先選你的採買條件</h2>
              </div>
              <span className="ai-panel-hint">可隨時重新整理</span>
            </div>
            <form className="ai-preference-form" onSubmit={handleSubmit}>
              <PreferenceField label="地區" htmlFor="ai-region">
                <select id="ai-region" value={region} onChange={(event) => setRegion(event.target.value)}>
                  <option value="">全台市場</option>
                  <option value="北部">北部</option>
                  <option value="中部">中部</option>
                  <option value="南部">南部</option>
                  <option value="東部">東部</option>
                </select>
              </PreferenceField>
              <PreferenceField label="指定市場（必選）" htmlFor="ai-market">
                <select
                  id="ai-market"
                  value={market}
                  onChange={(event) => setMarket(event.target.value)}
                  required
                  aria-required="true"
                >
                  <option value="" disabled>請選擇市場</option>
                  {markets.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </PreferenceField>
              <PreferenceField label="推薦範圍" htmlFor="ai-top-n">
                <select id="ai-top-n" value={topN} onChange={(event) => setTopN(Number(event.target.value))}>
                  {PREFERENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </PreferenceField>
              <div className="ai-preference-submit">
                <span>{selectedPreference.description}</span>
                <button type="submit" className="ai-generate-button" disabled={loading}>
                  {loading ? <RefreshCw size={16} className="ai-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
                  {loading ? '分析中…' : '產生推薦'}
                </button>
              </div>
            </form>
          </section>

          <section className="ai-result-panel" aria-live="polite">
            <div className="ai-result-panel-heading">
              <div>
                <p className="ai-section-kicker">Step 2 · Results</p>
                <h2>今天值得怎麼買？</h2>
              </div>
              {data && <span className="ai-query-badge">{market || region || '全台'} · {topN} 項</span>}
            </div>
            {loading && (
              <div className="ai-loading-state">
                <div className="ai-loading-orb"><Sparkles size={24} aria-hidden="true" /></div>
                <strong>正在整理今日行情與採買方向</strong>
                <p>AI 會先比較價格狀態，再整理成容易閱讀的推薦儀表板。</p>
                <div className="ai-loading-bars" aria-hidden="true"><span /><span /><span /></div>
              </div>
            )}
            {!loading && error && (
              <div className="ai-error-state">
                <AlertCircle size={28} aria-hidden="true" />
                <div><strong>推薦暫時無法產生</strong><p>{getErrorMessage(error)}</p></div>
                <button type="button" className="ai-retry-button" onClick={fetchRecommendation}><RefreshCw size={15} />再試一次</button>
              </div>
            )}
            {!loading && !error && !data && (
              <div className="ai-empty-state">
                <div className="ai-empty-state-icon"><CheckCircle2 size={24} aria-hidden="true" /></div>
                <strong>選好條件後，開始取得推薦</strong>
                <p>推薦結果會顯示便宜、正常與偏貴品項，幫你快速組出今天的菜籃。</p>
              </div>
            )}
            {!loading && !error && data && <ResultDashboard data={data} />}
          </section>
        </div>
      </div>
    </div>
  );
}
