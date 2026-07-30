import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CalendarDays,
  Clock3,
  Grid2X2,
  ListChecks,
  ShoppingCart,
  Sparkles,
  Store,
  Target,
  Tractor,
  Users,
} from 'lucide-react';

import Badge from '../../components/shared/Badge';
import Card from '../../components/shared/Card';
import EmptyState from '../../components/shared/EmptyState';
import LoadingState from '../../components/shared/LoadingState';
import { TAIWAN_REGIONS } from '../../components/public/CountySelector';
import {
  loadRecommendation,
  loadRecommendationCategories,
  loadRecommendationMarkets,
} from '../../lib/recommendationsApi';
import { IS_TEST_MODE } from '../../config/testMode';
import { useAuth } from '../../context/AuthContext';
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

const REGION_MARKET_KEYWORDS = {
  north: ['台北', '三重', '板橋', '桃園', '桃農', '新竹', '宜蘭'],
  central: ['台中', '南投', '彰化', '苗栗', '東勢', '永靖', '溪湖', '豐原', '西螺'],
  south: ['台南', '嘉義', '高雄', '鳳山', '屏東'],
  east_island: ['花蓮', '台東', '澎湖', '金門', '連江'],
};

const DATA_STATUS_LABELS = {
  official: '官方行情',
  cached: '快取資料',
  stale: '資料較舊',
  static_seed: '維護資料',
  demo: '示範資料',
  unavailable: '暫無資料',
};

const PRICE_STATUS_PRESENTATIONS = [
  { key: '便宜', label: '可優先採買', tone: 'positive' },
  { key: '正常', label: '維持比較', tone: 'neutral' },
  { key: '偏貴', label: '需要留意', tone: 'warning' },
  { key: '資料不足', label: '資料不足', tone: 'muted' },
];

const DEMO_TREND_SERIES = [
  { label: '07/16', value: 42 }, { label: '07/17', value: 37 }, { label: '07/18', value: 45 },
  { label: '07/19', value: 34 }, { label: '07/20', value: 39 }, { label: '07/21', value: 31 },
  { label: '07/22', value: 47 }, { label: '07/23', value: 43 }, { label: '07/24', value: 54 },
  { label: '07/25', value: 49 }, { label: '07/26', value: 62 }, { label: '07/27', value: 56 },
  { label: '07/28', value: 68 }, { label: '07/29', value: 61 },
];

function marketMatchesRegion(marketName, regionId) {
  if (!regionId) return true;
  const keywords = REGION_MARKET_KEYWORDS[regionId] || [];
  return keywords.some((keyword) => marketName.includes(keyword));
}

function sourceLabel(source) {
  if (source === 'demo') return '範例資料';
  return source === 'rules-fallback' ? '規則備援' : 'LLM 生成';
}

function sourceTone(source) {
  if (source === 'demo') return 'info';
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

function dataStatusLabel(status) {
  return DATA_STATUS_LABELS[status] || status || '資料狀態未提供';
}

function formatGeneratedAt(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function recommendationErrorMessage(error) {
  const message = error?.message || '推薦資料載入失敗。';
  if (IS_TEST_MODE && /登入|授權|401/i.test(message)) {
    return '測試模式目前未連接推薦 API；畫面可瀏覽，但即時推薦資料尚未提供。';
  }
  return message;
}

function itemScore(item) {
  const statusScore = { 便宜: 40, 正常: 20, 偏貴: 0, 資料不足: -20 }[item?.price_status] ?? -30;
  const priorityScore = { high: 12, medium: 6, low: 2 }[item?.priority] ?? 0;
  return statusScore + priorityScore;
}

function pickBestItem(items, excludedProductName = '') {
  return [...items]
    .filter((item) => item?.price_status !== '資料不足' && item?.product_name !== excludedProductName)
    .sort((left, right) => itemScore(right) - itemScore(left))[0] || null;
}

function buildRecommendationConclusion({ market, categoryLabel, item }) {
  if (!item) return `目前無法判定${market || '此市場'}的${categoryLabel}最推薦，請先補充可用行情。`;
  const action = item.action || '先比較後採買';
  return `${market || item.market_name || '目前選定市場'}的${categoryLabel}，最推薦先買${item.product_name}（${item.price_status}），${action}。`;
}

function buildExpertCommentary({ item, activeRecommendation, sourceSummary }) {
  if (!item) return '目前候選品項不足，先不要用單一價格做決策，等行情補齊後再比較。';
  return `${item.product_name}目前${item.price_status}；${item.reason || activeRecommendation?.shopping_strategy || '建議搭配替代品與實際需求分批採買'}。`;
}

function productGlyph(productName) {
  if (/高麗菜|青江菜|小白菜/.test(productName)) return '🥬';
  if (/菠菜|空心菜|芥藍|地瓜葉|A菜/.test(productName)) return '🌿';
  if (/番茄|牛番茄/.test(productName)) return '🍅';
  if (/小黃瓜|絲瓜|苦瓜/.test(productName)) return '🥒';
  if (/甜椒|彩椒/.test(productName)) return '🫑';
  if (/茄子/.test(productName)) return '🍆';
  if (/蘿蔔|紅蘿蔔/.test(productName)) return '🥕';
  if (/馬鈴薯/.test(productName)) return '🥔';
  if (/地瓜/.test(productName)) return '🍠';
  if (/洋蔥/.test(productName)) return '🧅';
  if (/山藥/.test(productName)) return '🌱';
  if (/香蕉/.test(productName)) return '🍌';
  if (/芭樂/.test(productName)) return '🍐';
  if (/鳳梨/.test(productName)) return '🍍';
  if (/西瓜/.test(productName)) return '🍉';
  if (/水梨/.test(productName)) return '🍐';
  if (/木瓜/.test(productName)) return '🥭';
  if (/菇|香菇|杏鮑菇|金針菇|鴻喜菇|秀珍菇|舞菇/.test(productName)) return '🍄';
  return '🌱';
}

export default function DashboardRecommendations({ publicMode = false }) {
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [selectedRole, setSelectedRole] = useState('consumer');
  const [demoMode, setDemoMode] = useState(() => Boolean(import.meta.env.DEV));
  const [hoveredTrendPoint, setHoveredTrendPoint] = useState(null);
  const [region, setRegion] = useState('');
  const [market, setMarket] = useState('');
  const [markets, setMarkets] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categoriesError, setCategoriesError] = useState(null);
  const { user, dashboardAccess } = useAuth();
  const currentRole = dashboardAccess?.role || user?.role;
  const isSystemAdmin = currentRole === 'admin';

  async function loadCategories() {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const nextCategories = await loadRecommendationCategories({ demo: demoMode });
      setCategories(nextCategories);
      setCategory((current) => current || (demoMode ? nextCategories[0]?.key || '' : ''));
    } catch (loadError) {
      setCategoriesError(recommendationErrorMessage(loadError));
    } finally {
      setCategoriesLoading(false);
    }
  }

  async function loadSelectedRecommendation(
    selectedCategory = category,
    selectedIdentity = selectedRole,
  ) {
    if (!selectedCategory || !market) return;
    setLoading(true);
    setError(null);
    try {
      setRecommendation(await loadRecommendation(
        selectedCategory,
        publicMode ? selectedIdentity : undefined,
        { region, market, demo: demoMode },
      ));
    } catch (loadError) {
      setError(recommendationErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  function toggleDemoMode(nextMode) {
    setDemoMode(nextMode);
    setRecommendation(null);
    setError(null);
    setCategory('');
    setMarket('');
  }

  function chooseCategory(nextCategory) {
    setCategory(nextCategory);
    setRecommendation(null);
    setError(null);
  }

  function chooseRole(nextRole) {
    setSelectedRole(nextRole);
    setRecommendation(null);
    setError(null);
  }

  function chooseRegion(nextRegion) {
    setRegion(nextRegion);
    if (market && !marketMatchesRegion(market, nextRegion)) setMarket('');
    setRecommendation(null);
    setError(null);
  }

  function chooseMarket(nextMarket) {
    setMarket(nextMarket);
    setRecommendation(null);
    setError(null);
  }

  useEffect(() => {
    loadCategories();
  }, [demoMode]);

  useEffect(() => {
    loadRecommendationMarkets({ region, demo: demoMode })
      .then((nextMarkets) => {
        setMarkets(nextMarkets);
        setMarket((current) => (
          current && nextMarkets.includes(current)
            ? current
            : (demoMode ? nextMarkets[0] || '' : '')
        ));
      })
      .catch(() => setMarkets([]));
  }, [region, demoMode]);

  useEffect(() => {
    if (!demoMode || !category || !market || recommendation || loading) return;
    loadSelectedRecommendation(category, selectedRole);
  }, [demoMode, category, market]);

  const data = recommendation?.data;
  const source = recommendation?.generation_source === 'demo' ? 'demo' : data?.generator;
  const roleRecommendations = roleRecommendationsFrom(data);
  const activeRolePresentation = ROLE_PRESENTATIONS.find((item) => item.key === selectedRole) || ROLE_PRESENTATIONS[0];
  const activeRecommendation = publicMode
    ? (recommendation?.selected_recommendation || roleRecommendations[selectedRole])
    : roleRecommendations.consumer;
  const dashboardItems = activeRecommendation?.items || [];
  const statusCounts = PRICE_STATUS_PRESENTATIONS.reduce((counts, status) => ({
    ...counts,
    [status.key]: dashboardItems.filter((item) => item.price_status === status.key).length,
  }), {});
  const statusMax = Math.max(...Object.values(statusCounts), 1);
  const sourceSummary = data?.source_summary || {};
  const categoryLabel = data?.category?.label
    || categories.find((item) => item.key === category)?.label
    || '推薦分類';

  const attentionCount = statusCounts['偏貴'] + statusCounts['資料不足'];
  const aiRecommendedItem = pickBestItem(roleRecommendations.consumer?.items || dashboardItems);
  const expertRecommendation = roleRecommendations.farmer || roleRecommendations.merchant || activeRecommendation;
  const expertRecommendedItem = pickBestItem(expertRecommendation?.items || [], aiRecommendedItem?.product_name)
    || pickBestItem(expertRecommendation?.items || []);
  const expertCommentary = buildExpertCommentary({ item: expertRecommendedItem, activeRecommendation: expertRecommendation, sourceSummary });
  const trendMin = Math.min(...DEMO_TREND_SERIES.map((point) => point.value));
  const trendMax = Math.max(...DEMO_TREND_SERIES.map((point) => point.value));
  const trendPoints = DEMO_TREND_SERIES.map((point, index) => {
    const x = (index / (DEMO_TREND_SERIES.length - 1)) * 320;
    const y = 100 - ((point.value - trendMin) / Math.max(trendMax - trendMin, 1)) * 72;
    return { ...point, x, y };
  });
  const filteredMarkets = useMemo(
    () => markets.filter((item) => marketMatchesRegion(item, region)),
    [markets, region],
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
    <div className={`dashboard-overview dashboard-recommendations-page${publicMode ? ' public-recommendations-page' : ''}`}>
      <header className="dashboard-overview-heading">
        <div>
          <p className="eyebrow">AI Recommendation Console</p>
          <h1>推薦控制台</h1>
          {recommendation && (
            <p className="recommendation-dashboard-heading-note">
              {categoryLabel} · {activeRolePresentation.label} · 生成於 {formatGeneratedAt(recommendation.generated_at || data?.generated_at)}
            </p>
          )}
        </div>
      </header>

      <Card className="recommendation-control-card">
        <div className="recommendation-control-heading">
          <div>
            <p className="eyebrow">Recommendation Controls</p>
            <h2>設定推薦條件</h2>
            <p>市場與分類為必選條件；快取不存在時才會呼叫一次 LLM，已有結果會直接讀取。</p>
          </div>
          <button
            type="button"
            className="recommendation-generate-button"
            onClick={() => loadSelectedRecommendation(category, selectedRole)}
            disabled={loading || !category || !market}
          >
            <Sparkles size={18} className={loading ? 'spin' : ''} />
            {loading ? 'AI 產生中…' : 'AI推薦'}
          </button>
        </div>

        <div className="recommendation-display-setting">
          <label className="recommendation-display-toggle">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(event) => toggleDemoMode(event.target.checked)}
            />
            <span className="recommendation-toggle-track" aria-hidden="true" />
            <span>
              <strong>資料模式</strong>
              <small>{demoMode ? '使用完整範例內容' : '使用正式 API／快取資料'}</small>
            </span>
          </label>
        </div>

        {publicMode && (
          <section className="recommendation-category-bar recommendation-role-selector" aria-label="推薦身分">
            <span className="recommendation-category-label"><Users size={18} />選擇身分</span>
            <div className="recommendation-category-chips">
              {ROLE_PRESENTATIONS.map((role) => {
                const Icon = role.icon;
                return (
                  <button
                    type="button"
                    key={role.key}
                    className={role.key === selectedRole ? 'is-active' : ''}
                    onClick={() => chooseRole(role.key)}
                    aria-pressed={role.key === selectedRole}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {role.label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <div className="recommendation-condition-row" aria-label="區域、市場與分類條件">
          <label className="recommendation-condition-field">
            <span>區域</span>
            <select
              id="recommendation-region"
              aria-label="推薦區域"
              value={region}
              onChange={(event) => chooseRegion(event.target.value)}
            >
              <option value="">全部區域</option>
              {TAIWAN_REGIONS.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="recommendation-condition-field">
            <span>市場</span>
            <select
              id="recommendation-market"
              aria-label="推薦市場"
              value={market}
              onChange={(event) => chooseMarket(event.target.value)}
            >
              <option value="">全部市場</option>
              {filteredMarkets.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="recommendation-condition-field">
            <span>分類</span>
            <select
              id="recommendation-category"
              aria-label="推薦分類"
              value={category}
              onChange={(event) => chooseCategory(event.target.value)}
            >
              <option value="">請選擇分類</option>
              {categories.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
        </div>
      </Card>

      {recommendation && (
        <section className="recommendation-dashboard-shell" aria-label="推薦儀表板">
          <header className="recommendation-dashboard-hero">
            <div>
              <p className="eyebrow">SmartBuy AI · Market Brief</p>
              <h2>{recommendation ? `${categoryLabel}採買與行動總覽` : 'AI 採買推薦儀表板'}</h2>
              <p>{recommendation
                ? '依照目前可取得的行情資料，整理成可直接執行的採買決策。'
                : '完成市場與分類條件後，這裡會顯示可追溯的行情摘要與行動建議。'}</p>
            </div>
            <div className="recommendation-dashboard-hero-meta">
              <span><CalendarDays size={16} />最新交易日：{recommendation ? (sourceSummary.latest_trade_date || '—') : '尚未生成'}</span>
              <span><Clock3 size={16} />更新時間：{recommendation ? formatGeneratedAt(recommendation.generated_at || data?.generated_at) : '等待條件'}</span>
            </div>
          </header>

          <section className="recommendation-decision-grid" aria-label="推薦決策摘要">
            <Card className="recommendation-conclusion-card" aria-label="採買結論">
              <div className="recommendation-context-heading">
                <span className="recommendation-context-icon" role="img" aria-label="採買結論"><Target size={20} aria-hidden="true" /></span>
                <h3>AI推薦：<span className="recommendation-heading-product"><span className="recommendation-product-icon" role="img" aria-label={`${aiRecommendedItem?.product_name || '尚未選定品項'}圖示`}>{productGlyph(aiRecommendedItem?.product_name || '')}</span>{aiRecommendedItem?.product_name || '尚未選定品項'}</span></h3>
              </div>
              <p className="recommendation-conclusion-text">{buildRecommendationConclusion({ market, categoryLabel, item: aiRecommendedItem })}</p>
            </Card>

            <Card className="recommendation-expert-card" aria-label="專家評語">
              <div className="recommendation-context-heading">
                <span className="recommendation-context-icon recommendation-context-icon-warm" role="img" aria-label="專家評語"><Sparkles size={20} aria-hidden="true" /></span>
                <h3>專家推薦：<span className="recommendation-heading-product"><span className="recommendation-product-icon" role="img" aria-label={`${expertRecommendedItem?.product_name || '尚未選定品項'}圖示`}>{productGlyph(expertRecommendedItem?.product_name || '')}</span>{expertRecommendedItem?.product_name || '尚未選定品項'}</span></h3>
              </div>
              <p className="recommendation-expert-text">{expertCommentary}</p>
            </Card>
          </section>

          <div className="recommendation-dashboard-kpis" aria-label="推薦摘要指標">
            <Card className="recommendation-dashboard-kpi recommendation-dashboard-kpi-blue">
              <span className="recommendation-dashboard-kpi-icon"><Grid2X2 size={22} /></span>
              <div>
                <span>監測品項</span>
                <strong>{recommendation ? (sourceSummary.candidate_count ?? '—') : '—'}</strong>
                <small>{recommendation ? `${categoryLabel}候選資料` : '完成條件後顯示'}</small>
              </div>
            </Card>
            <Card className="recommendation-dashboard-kpi recommendation-dashboard-kpi-amber">
              <span className="recommendation-dashboard-kpi-icon"><Activity size={22} /></span>
              <div>
                <span>需要留意</span>
                <strong>{recommendation ? attentionCount : '—'}</strong>
                <small>{recommendation ? '偏貴或資料不足' : '等待推薦結果'}</small>
              </div>
            </Card>
            <Card className="recommendation-dashboard-kpi recommendation-dashboard-kpi-green">
              <span className="recommendation-dashboard-kpi-icon"><ListChecks size={22} /></span>
              <div>
                <span>行動建議</span>
                <strong>{recommendation ? dashboardItems.length : '—'}</strong>
                <small>{recommendation ? `${activeRolePresentation.label}可執行項目` : '等待推薦結果'}</small>
              </div>
            </Card>
            <Card className="recommendation-dashboard-kpi recommendation-dashboard-kpi-purple">
              <span className="recommendation-dashboard-kpi-icon"><Sparkles size={22} /></span>
              <div>
                <span>資料狀態</span>
                <strong>{recommendation ? dataStatusLabel(data?.data_status || sourceSummary.data_status) : '待生成'}</strong>
                <small>{recommendation ? (sourceSummary.source_name || '推薦資料來源未提供') : '尚未呼叫 AI推薦'}</small>
              </div>
            </Card>
          </div>

          <div className="recommendation-dashboard-analysis-grid">
            <Card className="recommendation-dashboard-chart-card">
              <div className="recommendation-dashboard-card-heading">
                <div>
                  <p className="eyebrow">Price Signals</p>
                  <h3>價格狀態分布</h3>
                </div>
                  <span>{recommendation ? `${activeRolePresentation.label} · ${dashboardItems.length} 項` : '完成條件後顯示'}</span>
              </div>
              <div className="recommendation-status-bars" role="list" aria-label="價格狀態分布">
                {PRICE_STATUS_PRESENTATIONS.map((status) => (
                  <div className={`recommendation-status-row recommendation-status-${status.tone}`} key={status.key} role="listitem">
                    <div className="recommendation-status-label">
                      <span>{status.label}</span>
                      <strong>{statusCounts[status.key]}</strong>
                    </div>
                    <div className="recommendation-status-track" aria-hidden="true">
                      <span style={{ width: recommendation ? `${(statusCounts[status.key] / statusMax) * 100}%` : '0%' }} />
                    </div>
                  </div>
                ))}
              </div>
              <small className="recommendation-dashboard-source-note">
                {recommendation
                  ? '狀態依推薦回應中的品項價格判定，並非額外推算的即時行情。'
                  : '完成市場、分類與身分條件後，這裡會顯示真實推薦回應中的價格狀態。'}
              </small>
            </Card>

            <Card className="recommendation-dashboard-trend-card">
              <div className="recommendation-dashboard-card-heading">
                <div>
                  <p className="eyebrow">Trend Context</p>
                  <h3>市場趨勢</h3>
                </div>
                <span className="recommendation-dashboard-unavailable-badge">{demoMode ? '趨勢示意' : recommendation ? '待補充' : '尚未生成'}</span>
              </div>
              {demoMode ? (
                <div className="recommendation-demo-trend" role="img" aria-label="近七日價格曲線與價格狀態條狀圖">
                  <div className="recommendation-demo-chart-labels"><span>近 7 日價格方向</span><small>示意曲線</small></div>
                  <svg className="recommendation-trend-line" viewBox="0 0 320 120" preserveAspectRatio="none" aria-label="近七日價格方向曲線" onMouseLeave={() => setHoveredTrendPoint(null)}>
                    <path className="recommendation-trend-grid" d="M0 24H320M0 60H320M0 96H320" />
                    <polyline points={trendPoints.map((point) => `${point.x},${point.y}`).join(' ')} />
                    {trendPoints.map((point, index) => (
                      <circle
                        key={point.label}
                        cx={point.x}
                        cy={point.y}
                        r={hoveredTrendPoint === index ? 6 : 4}
                        tabIndex="0"
                        role="button"
                        aria-label={`${point.label}價格指數 ${point.value}`}
                        onMouseEnter={() => setHoveredTrendPoint(index)}
                        onFocus={() => setHoveredTrendPoint(index)}
                        onBlur={() => setHoveredTrendPoint(null)}
                      />
                    ))}
                    {hoveredTrendPoint !== null && (
                      <g className="recommendation-trend-tooltip" pointerEvents="none">
                        <rect x={Math.min(Math.max(trendPoints[hoveredTrendPoint].x - 35, 2), 248)} y={Math.max(trendPoints[hoveredTrendPoint].y - 34, 2)} width="70" height="25" rx="6" />
                        <text x={Math.min(Math.max(trendPoints[hoveredTrendPoint].x, 37), 283)} y={Math.max(trendPoints[hoveredTrendPoint].y - 18, 18)} textAnchor="middle">{`${trendPoints[hoveredTrendPoint].label} ${trendPoints[hoveredTrendPoint].value}`}</text>
                      </g>
                    )}
                  </svg>
                  <div className="recommendation-demo-bar-title">價格狀態分布</div>
                  <div className="recommendation-demo-bars" aria-hidden="true">
                    {[
                      ['便宜', statusCounts['便宜'], 'positive'],
                      ['正常', statusCounts['正常'], 'neutral'],
                      ['偏貴', statusCounts['偏貴'], 'warning'],
                      ['資料不足', statusCounts['資料不足'], 'muted'],
                    ].map(([label, count, tone]) => (
                      <div className="recommendation-demo-bar" key={label}>
                        <span>{label}</span><i className={`recommendation-demo-bar-fill recommendation-demo-bar-${tone}`} style={{ height: `${Math.max(12, (count / Math.max(dashboardItems.length, 1)) * 100)}%` }} /><strong>{count}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="recommendation-dashboard-unavailable-chart" role="status">
                  <Activity size={30} aria-hidden="true" />
                  <strong>{recommendation ? '目前推薦資料沒有歷史序列' : '完成條件後載入推薦資料'}</strong>
                  <p>{recommendation
                    ? '先依照這次 AI 推薦行動；需要 14 日走勢時，可前往查價頁查看官方行情。'
                    : '選擇市場與分類，再按下 AI推薦，儀表板會以正式回應更新。'}</p>
                </div>
              )}
            </Card>
          </div>

          <div className="recommendation-dashboard-insights" aria-label="採買行動建議">
            {PRICE_STATUS_PRESENTATIONS.map((status) => (
              <Card className={`recommendation-dashboard-insight recommendation-dashboard-insight-${status.tone}`} key={status.key}>
                <div className="recommendation-dashboard-insight-heading">
                  <strong>{status.label}</strong>
                  <span>{recommendation ? `${statusCounts[status.key]} 項` : '—'}</span>
                </div>
                <p>
                  {recommendation
                    ? (
                      <>
                        {status.key === '便宜' && '可優先比較市場並安排採買。'}
                        {status.key === '正常' && '維持比價，依實際需求分批採買。'}
                        {status.key === '偏貴' && '先確認替代品或延後採買，避免追價。'}
                        {status.key === '資料不足' && '先補充行情資料，再做價格判斷。'}
                      </>
                    )
                    : '尚未生成推薦，完成上方條件後顯示。'}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {error && (
        <div className="recommendation-error" role="alert">
          <strong>推薦資料無法載入</strong>
          <span>{error}</span>
          <button type="button" onClick={() => loadSelectedRecommendation()}>重新讀取快取</button>
        </div>
      )}

      {loading && !recommendation && <LoadingState label="正在取得 AI 推薦…" />}

      {!loading && !recommendation && !error && (
        <Card className="recommendation-empty-card">
          <Sparkles size={28} aria-hidden="true" />
          <div>
            <h2>準備好取得推薦了嗎？</h2>
            <p>確認上方市場、分類與身分後，按下「AI推薦」查看對應的行動建議。</p>
          </div>
        </Card>
      )}

      {recommendation && (
        <>
          {isSystemAdmin && <section className="recommendation-meta-row" aria-label="推薦狀態">
            <Badge tone={recommendation.cache_hit ? 'success' : 'info'}>{cacheLabel(recommendation.cache_hit)}</Badge>
            <Badge tone={sourceTone(source)}>{sourceLabel(source)}</Badge>
            <Badge tone="info">三套角色提示語</Badge>
            <Badge tone="neutral">LLM {recommendation.llm_called ? '已呼叫 1 次' : '未呼叫'}</Badge>
            <span><Clock3 size={15} />生成時間：{data.generated_at || '—'}</span>
            <span>快取來源：{recommendation.cache_backend || '—'}</span>
          </section>}

          <section className="recommendation-roles-section recommendation-results-dashboard" aria-labelledby="role-recommendations-title">
            <div className="recommendation-section-heading">
              <div>
                <p className="eyebrow">{publicMode ? 'Selected Identity · Actionable Advice' : 'One Market · Three Perspectives'}</p>
                <h2 id="role-recommendations-title">{publicMode ? '你的專屬推薦' : '同一畫面，三個角色'}</h2>
              </div>
              {publicMode ? (
                <span>身分：{ROLE_PRESENTATIONS.find((item) => item.key === selectedRole)?.label || selectedRole}</span>
              ) : isSystemAdmin ? (
                <span>Prompt set：{data.prompt_set_version || recommendation.prompt_set_version || '—'}</span>
              ) : null}
            </div>

            <div className="recommendation-role-grid">
              {ROLE_PRESENTATIONS.filter((role) => !publicMode || role.key === selectedRole).map((role) => {
                const roleContent = publicMode
                  ? (recommendation.selected_role === selectedRole
                    ? (recommendation.selected_recommendation || roleRecommendations[role.key])
                    : roleRecommendations[role.key])
                  : roleRecommendations[role.key];
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
                              <div className="recommendation-product-name">
                                <span className="recommendation-product-icon" role="img" aria-label={`${item.product_name}圖示`}>{productGlyph(item.product_name)}</span>
                                <h4>{item.product_name}</h4>
                              </div>
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

        </>
      )}
    </div>
  );
}
