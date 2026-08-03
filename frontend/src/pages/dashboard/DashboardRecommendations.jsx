import { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Clock3, Database, Lightbulb, MapPin, Newspaper, Sparkles, Target } from 'lucide-react';

import Card from '../../components/shared/Card';
import LoadingState from '../../components/shared/LoadingState';
import {
  DAILY_RECOMMENDATION_REGIONS,
  decisionFromRecommendation,
  isRecommendationStale,
  loadDailyRecommendation,
  presentRecommendationText,
  sourceSummaryFrom,
  taipeiDateString,
  tradeDataWarning,
} from '../../lib/dailyRecommendationsApi';
import '../../styles/dashboard-overview.css';
import '../../styles/dashboard-recommendations.css';

const ROLES = {
  consumer: { label: '消費者', description: '採買時機、優先品項、替代選擇與價格風險' },
  farmer: { label: '農民', description: '生產、採收、出貨時機、供需與價格風險' },
  merchant: { label: '商家', description: '進貨量、庫存、促銷、售價與替代品策略' },
};

function displayDate(value) {
  if (!value) return '來源未提供';
  const [year, month, day] = value.split('-');
  return `${year}/${month}/${day}`;
}

function displayDateTime(value) {
  if (!value) return '來源未提供';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
}

function sourcePeriod(source) {
  if (!source?.news_start_date || !source?.news_end_date) return '本次沒有可用新知資料';
  return `${displayDate(source.news_start_date)} ～ ${displayDate(source.news_end_date)}`;
}

function DecisionList({ items, icon: Icon = CheckCircle2, className = '' }) {
  return <ul className={`daily-decision-list${className ? ` ${className}` : ''}`}>{items.map((item) => <li key={item}><Icon size={17} /><span>{presentRecommendationText(item)}</span></li>)}</ul>;
}

function DailySourceCard({ document, sourceSummary }) {
  return (
    <Card className="daily-source-card">
      <h3><CalendarDays size={19} /> 日期與資料來源</h3>
      <dl>
        <div><dt>推薦適用日期</dt><dd>{displayDate(document.recommendation_date)}</dd></div>
        <div><dt>最新行情交易日</dt><dd>{displayDate(sourceSummary.latest_trade_date)}</dd></div>
        <div><dt>行情資料年齡</dt><dd>{sourceSummary.trade_data_age_days == null ? '未提供' : `${sourceSummary.trade_data_age_days} 天`}</dd></div>
        <div><dt>價格預測目標日期</dt><dd>{displayDate(sourceSummary.prediction_target_date)}</dd></div>
        <div><dt>新知資料期間</dt><dd>{sourcePeriod(sourceSummary)}</dd></div>
        <div><dt>建議產生時間</dt><dd>{displayDateTime(document.generated_at)}</dd></div>
        <div><dt>資料產生方式</dt><dd>人工觸發 ChatGPT，固定 JSON Schema 驗證後發布；未呼叫 LLM API</dd></div>
      </dl>
      <p className="daily-source-note"><Clock3 size={16} /> 共參考 {sourceSummary.product_count ?? '未提供'} 個行情品項；價格方向預測：{sourceSummary.includes_price_prediction ? '有納入' : '本次未取得'}；最近農業新知：{sourceSummary.includes_recent_news ? '有納入' : '本次未取得'}。</p>
    </Card>
  );
}

export default function DashboardRecommendations({ publicMode = false }) {
  const [role, setRole] = useState('consumer');
  const [region, setRegion] = useState('north');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const market = DAILY_RECOMMENDATION_REGIONS[region];
  const recommendation = result?.document?.recommendations?.[role];
  const decision = decisionFromRecommendation(recommendation, role);
  const marketSummary = result?.document?.market_summary || {};
  const actions = Array.isArray(recommendation?.actions) ? recommendation.actions : [];
  const risks = Array.isArray(recommendation?.risks) ? recommendation.risks : [];
  const keySignals = Array.isArray(marketSummary.key_signals) ? marketSummary.key_signals : [];
  const sourceSummary = useMemo(() => sourceSummaryFrom(result?.document), [result]);
  const stale = useMemo(
    () => isRecommendationStale(result?.document?.recommendation_date, taipeiDateString()),
    [result],
  );
  const tradeWarning = tradeDataWarning(sourceSummary.trade_data_age_days);
  const tradeAgeLabel = sourceSummary.trade_data_age_days == null
    ? '未提供'
    : `${sourceSummary.trade_data_age_days} 天`;
  const freshnessClass = sourceSummary.trade_data_age_days > 7
    ? 'critical'
    : sourceSummary.trade_data_age_days >= 4
      ? 'old'
      : 'fresh';
  const sourceLimitations = [
    ...sourceSummary.missing_sources.map((source) => `缺漏：${source}`),
    ...sourceSummary.source_warnings,
  ];

  async function handleLoad() {
    setLoading(true);
    setError('');
    try {
      setResult(await loadDailyRecommendation(region));
    } catch (loadError) {
      setResult(null);
      setError(loadError?.message || '每日推薦載入失敗。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`dashboard-overview dashboard-recommendations-page${publicMode ? ' public-recommendations-page' : ''}`}>
      <header className="dashboard-overview-heading recommendation-page-heading">
        <div>
          <p className="eyebrow">DAILY AI RECOMMENDATION</p>
          <h1>每日 AI 推薦快照</h1>
          <p>選擇身分與區域後，讀取已驗證發布的角色化決策；目前不會呼叫付費 LLM API。</p>
        </div>
        <span className="recommendation-manual-badge"><Database size={16} /> 人工 ChatGPT 批次</span>
      </header>

      <Card className="daily-recommendation-controls">
        <div className="daily-control-group">
          <span className="daily-control-label">身分</span>
          <div className="daily-choice-grid" role="radiogroup" aria-label="選擇推薦身分">
            {Object.entries(ROLES).map(([key, item]) => (
              <button key={key} type="button" role="radio" aria-checked={role === key} className={role === key ? 'is-active' : ''} onClick={() => setRole(key)}>
                <strong>{item.label}</strong><span>{item.description}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="daily-control-group">
          <span className="daily-control-label">區域</span>
          <div className="daily-region-row" role="radiogroup" aria-label="選擇推薦區域">
            {Object.entries(DAILY_RECOMMENDATION_REGIONS).map(([key, item]) => (
              <button key={key} type="button" role="radio" aria-checked={region === key} className={region === key ? 'is-active' : ''} onClick={() => { setRegion(key); setResult(null); }}>
                {item.label}
              </button>
            ))}
          </div>
          <p className="daily-selected-market"><MapPin size={16} /> 已對應市場：<strong>{market.marketName}</strong></p>
        </div>
        <button className="recommendation-generate-button" type="button" onClick={handleLoad} disabled={loading}>
          <Sparkles size={18} /> {loading ? '載入中…' : 'AI 推薦'}
        </button>
      </Card>

      {loading && <LoadingState label="正在讀取最新每日推薦快照…" />}
      {error && <div className="daily-recommendation-error" role="alert"><AlertTriangle size={20} /><span>{error}</span><button type="button" onClick={handleLoad}>重新載入</button></div>}

      {result && recommendation && (
        <article className="daily-recommendation-result">
          {stale && <div className="daily-stale-notice" role="status"><AlertTriangle size={18} />今日推薦尚未更新，目前顯示 {result.document.recommendation_date} 的最新建議。</div>}
          {tradeWarning && <div className={`daily-stale-notice daily-trade-warning-${sourceSummary.trade_data_age_days > 7 ? 'critical' : 'old'}`} role="alert"><AlertTriangle size={18} /><strong>{tradeWarning}</strong>{sourceSummary.latest_trade_date && <span>（最新交易日：{displayDate(sourceSummary.latest_trade_date)}，相隔 {sourceSummary.trade_data_age_days} 天）</span>}</div>}
          {sourceLimitations.length > 0 && <div className="daily-source-warnings" role="alert"><AlertTriangle size={18} /><div><strong>資料限制</strong>{sourceLimitations.map((warning) => <span key={warning}>{presentRecommendationText(warning)}</span>)}</div></div>}
          <Card className="daily-recommendation-hero">
            <div className="daily-hero-meta">
              <p className="eyebrow">{ROLES[role].label}・{result.document.market.region}・{result.document.market.name}</p>
              <span className="daily-focus-badge"><Target size={15} /> 先看重點</span>
            </div>
            <h2>{presentRecommendationText(recommendation.headline)}</h2>
            <p className="daily-core-conclusion">{presentRecommendationText(marketSummary.headline)}</p>
            <p>{presentRecommendationText(decision.mode === 'structured' ? decision.primaryReason : recommendation.summary)}</p>
            <div className="daily-highlight-grid" aria-label="每日推薦重點摘要">
              <div className="daily-highlight-card daily-highlight-action">
                <span>{decision.primaryLabel}</span>
                <strong>{presentRecommendationText(decision.primaryItems[0] || actions[0] || '請查看下方完整行動建議')}</strong>
              </div>
              <div className={`daily-highlight-card daily-highlight-freshness-${freshnessClass}`}>
                <span>行情資料新鮮度</span>
                <strong>{tradeAgeLabel}</strong>
                <small>最新交易日：{displayDate(sourceSummary.latest_trade_date)}</small>
              </div>
              <div className="daily-highlight-card daily-highlight-sources">
                <span>本次參考範圍</span>
                <strong>{sourceSummary.product_count ?? '—'} 個行情品項</strong>
                <small><BarChart3 size={14} /> 預測{sourceSummary.includes_price_prediction ? '已納入' : '未取得'} ・ <Newspaper size={14} /> 新知{sourceSummary.includes_recent_news ? '已納入' : '未取得'}</small>
              </div>
            </div>
          </Card>

          {decision.mode === 'structured' ? (
            <>
              <div className="daily-decision-grid" aria-label="角色化決策重點">
                <Card className="daily-decision-card daily-decision-primary">
                  <h3><Target size={19} /> {decision.primaryLabel}</h3>
                  <DecisionList items={decision.primaryItems} />
                  <p className="daily-decision-reason">{presentRecommendationText(decision.primaryReason)}</p>
                </Card>
                <Card className="daily-decision-card daily-decision-watch">
                  <h3><AlertTriangle size={19} /> 要注意什麼</h3>
                  <DecisionList items={decision.watch} icon={AlertTriangle} />
                </Card>
                <Card className="daily-decision-card daily-decision-know">
                  <h3><Lightbulb size={19} /> 必須知道什麼</h3>
                  <DecisionList items={decision.know} icon={Lightbulb} />
                </Card>
                <Card className="daily-decision-card daily-decision-do">
                  <h3><CheckCircle2 size={19} /> 現在怎麼做</h3>
                  <DecisionList items={decision.do} />
                </Card>
              </div>

              <details className="daily-details-card">
                <summary><Database size={18} /> 查看完整判斷依據與資料來源</summary>
                <div className="daily-details-content">
                  <section>
                    <h3><Lightbulb size={19} /> 市場整體判斷</h3>
                    <p className="daily-market-overview">{presentRecommendationText(marketSummary.overview)}</p>
                  </section>
                  <section>
                    <h3><Newspaper size={19} /> 主要訊號</h3>
                    <DecisionList items={keySignals} className="daily-signal-list" icon={Newspaper} />
                  </section>
                  {decision.evidence.length > 0 && <section>
                    <h3><Target size={19} /> 決策依據</h3>
                    <DecisionList items={decision.evidence} className="daily-evidence-list" />
                  </section>}
                  <DailySourceCard document={result.document} sourceSummary={sourceSummary} />
                </div>
              </details>
            </>
          ) : (
            <>
              <div className="daily-recommendation-columns">
                <Card>
                  <h3><Lightbulb size={19} /> 市場整體判斷</h3>
                  <p className="daily-market-overview">{presentRecommendationText(marketSummary.overview)}</p>
                  <h3><Target size={19} /> 具體行動建議</h3>
                  <ol className="daily-action-list">{actions.map((action, index) => <li key={action}><span className="daily-action-number">{index + 1}</span><span>{presentRecommendationText(action)}</span></li>)}</ol>
                </Card>
                <Card>
                  <h3><AlertTriangle size={19} /> 需要留意的風險</h3>
                  <ul className="daily-risk-list">{risks.map((risk) => <li key={risk}><AlertTriangle size={16} /><span>{presentRecommendationText(risk)}</span></li>)}</ul>
                  <h3><Newspaper size={19} /> 本次建議參考的主要訊號</h3>
                  <ul className="daily-signal-list">{keySignals.map((signal) => <li key={signal}>{presentRecommendationText(signal)}</li>)}</ul>
                </Card>
              </div>
              <DailySourceCard document={result.document} sourceSummary={sourceSummary} />
            </>
          )}
        </article>
      )}
    </div>
  );
}
