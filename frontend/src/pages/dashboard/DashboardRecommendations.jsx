import { useEffect, useMemo, useState } from 'react';
import { Clock3, Database, ListFilter, RefreshCw, Sparkles } from 'lucide-react';

import DashboardMetricCard from '../../components/dashboard/DashboardMetricCard';
import Badge from '../../components/shared/Badge';
import Card from '../../components/shared/Card';
import EmptyState from '../../components/shared/EmptyState';
import LoadingState from '../../components/shared/LoadingState';
import { loadRecommendation, loadRecommendationCategories } from '../../lib/recommendationsApi';
import '../../styles/dashboard-overview.css';
import '../../styles/dashboard-recommendations.css';

function sourceLabel(source) {
  return source === 'rules-fallback' ? '規則備援' : 'LLM 生成';
}

function sourceTone(source) {
  return source === 'rules-fallback' ? 'warning' : 'success';
}

function cacheLabel(cacheHit) {
  return cacheHit ? 'JSON 快取命中' : '本次建立快取';
}

function formatPrice(value) {
  return value == null ? '—' : `${Number(value).toLocaleString('zh-TW')} 元`;
}

export default function DashboardRecommendations() {
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [recommendation, setRecommendation] = useState(null);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categoriesError, setCategoriesError] = useState(null);

  async function loadCategories() {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const nextCategories = await loadRecommendationCategories();
      setCategories(nextCategories);
      setCategory((current) => current || nextCategories[0]?.key || '');
    } catch (loadError) {
      setCategoriesError(loadError?.message || '推薦分類載入失敗。');
    } finally {
      setCategoriesLoading(false);
    }
  }

  async function loadSelectedRecommendation(selectedCategory = category) {
    if (!selectedCategory) return;
    setLoading(true);
    setError(null);
    try {
      setRecommendation(await loadRecommendation(selectedCategory));
    } catch (loadError) {
      setError(loadError?.message || '推薦資料載入失敗。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (category) loadSelectedRecommendation(category);
  }, [category]);

  const data = recommendation?.data;
  const summary = data?.source_summary;
  const content = data?.recommendation;
  const items = content?.items || [];
  const source = data?.generator;
  const selectedCategory = useMemo(
    () => categories.find((item) => item.key === category),
    [categories, category],
  );

  if (categoriesLoading && !categories.length) return <LoadingState label="正在載入推薦分類…" />;

  if (categoriesError && !categories.length) {
    return (
      <EmptyState
        title="推薦分類暫時無法載入"
        description={categoriesError}
        action={<button type="button" onClick={loadCategories}>重新載入</button>}
      />
    );
  }

  return (
    <div className="dashboard-overview dashboard-recommendations-page">
      <header className="dashboard-overview-heading">
        <div>
          <p className="eyebrow">AI Recommendation · Cache First</p>
          <h1>AI 採買推薦</h1>
          <p>依同類正式行情整理採買策略；已有 JSON 時不再呼叫 LLM。</p>
        </div>
        <button
          type="button"
          className="recommendation-refresh-button"
          onClick={() => loadSelectedRecommendation()}
          disabled={loading || !category}
        >
          <RefreshCw size={17} className={loading ? 'spin' : ''} />
          {loading ? '重新讀取中…' : '重新讀取快取'}
        </button>
      </header>

      <section className="recommendation-category-bar" aria-label="推薦分類">
        <span className="recommendation-category-label"><ListFilter size={18} />選擇分類</span>
        <div className="recommendation-category-chips">
          {categories.map((item) => (
            <button
              type="button"
              key={item.key}
              className={item.key === category ? 'is-active' : ''}
              onClick={() => setCategory(item.key)}
              aria-pressed={item.key === category}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="recommendation-error" role="alert">
          <strong>推薦資料無法載入</strong>
          <span>{error}</span>
          <button type="button" onClick={() => loadSelectedRecommendation()}>重新讀取快取</button>
        </div>
      )}

      {loading && !recommendation && <LoadingState label="正在讀取推薦快取…" />}

      {recommendation && (
        <>
          <section className="dashboard-metric-grid recommendation-metrics">
            <DashboardMetricCard
              label="推薦分類"
              value={selectedCategory?.label || category}
              icon={Sparkles}
              source="/api/recommendations/categories"
              updatedAt={data.generated_at}
              description={selectedCategory?.description}
            />
            <DashboardMetricCard
              label="生成來源"
              value={sourceLabel(source)}
              tone={sourceTone(source)}
              icon={Sparkles}
              source="推薦 JSON"
              updatedAt={data.generated_at}
              description={recommendation.llm_called ? '本次曾呼叫 LLM' : '本次 LLM 未呼叫'}
            />
            <DashboardMetricCard
              label="JSON 快取狀態"
              value={cacheLabel(recommendation.cache_hit)}
              tone={recommendation.cache_hit ? 'success' : 'info'}
              icon={Database}
              source={recommendation.cache_backend}
              updatedAt={data.generated_at}
              description="重新整理只重新讀取，不會強制生成"
            />
            <DashboardMetricCard
              label="候選品項"
              value={summary?.candidate_count ?? '—'}
              icon={ListFilter}
              source={summary?.source_name}
              updatedAt={summary?.latest_trade_date}
              description={`資料狀態：${summary?.data_status || '未提供'}`}
            />
          </section>

          <section className="recommendation-meta-row" aria-label="推薦狀態">
            <Badge tone={recommendation.cache_hit ? 'success' : 'info'}>{cacheLabel(recommendation.cache_hit)}</Badge>
            <Badge tone={sourceTone(source)}>{sourceLabel(source)}</Badge>
            <Badge tone="neutral">LLM {recommendation.llm_called ? '已呼叫' : '未呼叫'}</Badge>
            <span><Clock3 size={15} />生成時間：{data.generated_at || '—'}</span>
            <span>快取來源：{recommendation.cache_backend || '—'}</span>
          </section>

          <div className="recommendation-summary-grid">
            <Card>
              <div className="recommendation-section-heading">
                <div>
                  <p className="eyebrow">Recommendation Summary</p>
                  <h2>採買摘要</h2>
                </div>
                <Badge tone={sourceTone(source)}>{sourceLabel(source)}</Badge>
              </div>
              <p className="recommendation-summary-text">{content?.summary || '目前沒有摘要。'}</p>
              <dl className="recommendation-detail-list">
                <dt>市場展望</dt><dd>{content?.market_outlook || '—'}</dd>
                <dt>採買策略</dt><dd>{content?.shopping_strategy || '—'}</dd>
                <dt>資料日期</dt><dd>{summary?.latest_trade_date || '—'}</dd>
                <dt>來源狀態</dt><dd>{summary?.source_name || '—'} · {summary?.data_status || '—'}</dd>
              </dl>
            </Card>
            <Card className="recommendation-cache-card">
              <div className="recommendation-section-heading">
                <div>
                  <p className="eyebrow">Cost Protection</p>
                  <h2>JSON 成本保護</h2>
                </div>
                <Database size={22} aria-hidden="true" />
              </div>
              <p>同一分類成功寫入 JSON 後，後續請求直接讀取持久快取，LLM 呼叫次數維持為 0。</p>
              <strong>{recommendation.cache_hit ? '本次直接使用既有 JSON' : '本次完成 JSON 建立'}</strong>
              <small>Cache key：{data.cache_key || '—'} · Digest：{data.input_digest || '—'}</small>
            </Card>
          </div>

          <section className="recommendation-items-section">
            <div className="recommendation-section-heading">
              <div>
                <p className="eyebrow">Category Items</p>
                <h2>分類推薦品項</h2>
              </div>
              <span>{items.length} / 6 項</span>
            </div>
            {items.length ? (
              <div className="recommendation-items-grid">
                {items.map((item) => (
                  <Card key={`${item.product_name}-${item.market_name || 'all'}`} className="recommendation-item-card">
                    <div className="recommendation-item-head">
                      <div>
                        <h3>{item.product_name}</h3>
                        <span>{item.market_name || '市場未提供'}</span>
                      </div>
                      <Badge tone={item.price_status === '偏貴' ? 'warning' : item.price_status === '便宜' ? 'success' : 'neutral'}>
                        {item.price_status}
                      </Badge>
                    </div>
                    <div className="recommendation-item-price">
                      <strong>{formatPrice(item.today_price)}</strong>
                      <span>近期平均 {formatPrice(item.recent_average)}</span>
                    </div>
                    <p><strong>{item.action}</strong>：{item.reason}</p>
                    <small>優先級：{item.priority} · 替代品：{item.substitute || '暫無必要'}</small>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState title="目前沒有分類推薦品項" description="正式行情資料不足，請稍後再讀取。" />
            )}
          </section>
        </>
      )}
    </div>
  );
}
