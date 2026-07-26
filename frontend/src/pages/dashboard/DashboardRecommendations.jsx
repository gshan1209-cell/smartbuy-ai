import { useEffect, useMemo, useState } from 'react';
import {
  Clock3,
  Database,
  ListFilter,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Store,
  Tractor,
  Users,
} from 'lucide-react';

import DashboardMetricCard from '../../components/dashboard/DashboardMetricCard';
import Badge from '../../components/shared/Badge';
import Card from '../../components/shared/Card';
import EmptyState from '../../components/shared/EmptyState';
import LoadingState from '../../components/shared/LoadingState';
import { loadRecommendation, loadRecommendationCategories } from '../../lib/recommendationsApi';
import '../../styles/dashboard-overview.css';
import '../../styles/dashboard-recommendations.css';
import '../../styles/dashboard-recommendation-roles.css';

const ROLE_PRESENTATIONS = [
  {
    key: 'consumer',
    label: '消費者',
    perspective: '家庭採買端',
    icon: ShoppingCart,
    strategyLabel: '採買策略',
  },
  {
    key: 'farmer',
    label: '農民',
    perspective: '農業生產端',
    icon: Tractor,
    strategyLabel: '生產與出貨策略',
  },
  {
    key: 'merchant',
    label: '商家',
    perspective: '通路銷售端',
    icon: Store,
    strategyLabel: '採購與銷售策略',
  },
];

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

function roleRecommendationsFrom(data) {
  if (data?.role_recommendations) return data.role_recommendations;
  if (data?.recommendation) return { consumer: data.recommendation };
  return {};
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
  const source = data?.generator;
  const roleRecommendations = roleRecommendationsFrom(data);
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
          <p className="eyebrow">AI Recommendation · Three Roles · Cache First</p>
          <h1>AI 三角色推薦</h1>
          <p>同一份行情，以消費者、農民與商家三套提示語同步分析；已有 JSON 時不再呼叫 LLM。</p>
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
              label="角色提示語"
              value="3 套"
              tone="info"
              icon={Users}
              source={data.prompt_set_version || recommendation.prompt_set_version}
              updatedAt={data.generated_at}
              description="消費者、農民、商家一次生成"
            />
            <DashboardMetricCard
              label="生成來源"
              value={sourceLabel(source)}
              tone={sourceTone(source)}
              icon={Sparkles}
              source="推薦 JSON"
              updatedAt={data.generated_at}
              description={recommendation.llm_called ? '本次單次呼叫產生三角色結果' : '本次 LLM 未呼叫'}
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
            <Badge tone="info">三套角色提示語</Badge>
            <Badge tone="neutral">LLM {recommendation.llm_called ? '已呼叫 1 次' : '未呼叫'}</Badge>
            <span><Clock3 size={15} />生成時間：{data.generated_at || '—'}</span>
            <span>快取來源：{recommendation.cache_backend || '—'}</span>
          </section>

          <section className="recommendation-roles-section" aria-labelledby="role-recommendations-title">
            <div className="recommendation-section-heading">
              <div>
                <p className="eyebrow">One Market · Three Perspectives</p>
                <h2 id="role-recommendations-title">同一畫面，三個角色</h2>
              </div>
              <span>Prompt set：{data.prompt_set_version || recommendation.prompt_set_version || '—'}</span>
            </div>

            <div className="recommendation-role-grid">
              {ROLE_PRESENTATIONS.map((role) => {
                const roleContent = roleRecommendations[role.key];
                const Icon = role.icon;
                const items = roleContent?.items || [];

                return (
                  <Card
                    key={role.key}
                    className={`recommendation-role-card recommendation-role-${role.key}`}
                  >
                    <div className="recommendation-role-heading">
                      <span className="recommendation-role-icon" aria-hidden="true">
                        <Icon size={24} />
                      </span>
                      <div>
                        <p className="eyebrow">{roleContent?.perspective || role.perspective}</p>
                        <h3>{roleContent?.role_label || role.label}</h3>
                      </div>
                      <Badge tone={sourceTone(source)}>{sourceLabel(source)}</Badge>
                    </div>

                    <p className="recommendation-role-summary">
                      {roleContent?.summary || '目前沒有這個角色的推薦摘要。'}
                    </p>

                    <dl className="recommendation-role-details">
                      <dt>行情觀察</dt>
                      <dd>{roleContent?.market_outlook || '—'}</dd>
                      <dt>{role.strategyLabel}</dt>
                      <dd>{roleContent?.shopping_strategy || '—'}</dd>
                    </dl>

                    <div className="recommendation-role-items">
                      <div className="recommendation-role-items-heading">
                        <strong>角色行動建議</strong>
                        <span>{items.length} / 6 項</span>
                      </div>
                      {items.length ? items.map((item) => (
                        <article
                          key={`${role.key}-${item.product_name}-${item.market_name || 'all'}`}
                          className="recommendation-role-item"
                        >
                          <div className="recommendation-role-item-title">
                            <div>
                              <h4>{item.product_name}</h4>
                              <span>{item.market_name || '市場未提供'}</span>
                            </div>
                            <Badge tone={item.price_status === '偏貴' ? 'warning' : item.price_status === '便宜' ? 'success' : 'neutral'}>
                              {item.price_status}
                            </Badge>
                          </div>
                          <div className="recommendation-role-price">
                            <strong>{formatPrice(item.today_price)}</strong>
                            <span>近期平均 {formatPrice(item.recent_average)}</span>
                          </div>
                          <p><strong>{item.action}</strong>：{item.reason}</p>
                          <small>優先級：{item.priority} · 替代品：{item.substitute || '暫無必要'}</small>
                        </article>
                      )) : (
                        <p className="recommendation-role-empty">正式行情資料不足，暫無角色行動建議。</p>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>

          <Card className="recommendation-cache-card recommendation-cache-banner">
            <div className="recommendation-section-heading">
              <div>
                <p className="eyebrow">Cost Protection</p>
                <h2>三角色共用一次生成與一份 JSON</h2>
              </div>
              <Database size={22} aria-hidden="true" />
            </div>
            <p>同一分類首次建立時，以單次 LLM 請求提交三套角色提示語；成功寫入 v2 JSON 後，後續請求只讀取持久快取。</p>
            <strong>{recommendation.cache_hit ? '本次直接使用既有三角色 JSON' : '本次完成三角色 JSON 建立'}</strong>
            <small>
              Cache key：{data.cache_key || '—'} · Digest：{data.input_digest || '—'} · 資料日期：{summary?.latest_trade_date || '—'}
            </small>
          </Card>
        </>
      )}
    </div>
  );
}
