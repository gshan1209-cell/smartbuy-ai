import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CloudSun,
  MapPinned,
  RefreshCw,
  Sprout,
  TrendingUp,
} from 'lucide-react';

import DashboardChartCard from '../../components/dashboard/DashboardChartCard';
import DashboardFilterBar from '../../components/dashboard/DashboardFilterBar';
import DashboardMetricCard from '../../components/dashboard/DashboardMetricCard';
import ResponsiveDataTable from '../../components/dashboard/ResponsiveDataTable';
import Badge from '../../components/shared/Badge';
import EmptyState from '../../components/shared/EmptyState';
import { loadFarmerDashboard } from '../../lib/farmerDashboardAdapter';
import '../../styles/dashboard-overview.css';
import '../../styles/dashboard-farmer.css';

function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toLocaleString('zh-TW')} 元`;
}

function formatPercent(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const number = Number(value);
  return `${number > 0 ? '+' : ''}${number.toFixed(1)}%`;
}

function changePercent(row) {
  const today = Number(row.today_price);
  const average = Number(row.recent_average);
  if (!Number.isFinite(today) || !Number.isFinite(average) || average === 0) return null;
  return ((today - average) / average) * 100;
}

function statusLabel(status) {
  const value = String(status || '資料狀態未知');
  if (value.includes('資料不足')) return '資料不足';
  if (value.includes('尚無行情')) return '尚無行情';
  if (value.includes('正常')) return '行情正常';
  return value;
}

function sourceStatusText(status) {
  return {
    ready: '資料正常',
    stale: '使用快取資料',
    empty: '目前無資料',
    error: '資料載入失敗',
  }[status] || '資料狀態未知';
}

function sourceTone(status) {
  if (status === 'ready') return 'neutral';
  if (status === 'stale') return 'warning';
  return 'danger';
}

export default function FarmerDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const next = await loadFarmerDashboard(dashboard);
      setDashboard(next);
    } catch (loadError) {
      setError(loadError?.message || '農民工作台資料載入失敗');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dashboard]);

  useEffect(() => {
    load();
    // Initial load only. Refresh uses the latest dashboard state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-TW');
    return (dashboard?.prices?.products || [])
      .filter((row) => {
        if (!normalizedQuery) return true;
        return `${row.product_name} ${row.market_name || ''}`
          .toLocaleLowerCase('zh-TW')
          .includes(normalizedQuery);
      })
      .filter((row) => !market || row.market_name === market)
      .sort((left, right) => (Number(right.today_price) || -Infinity) - (Number(left.today_price) || -Infinity));
  }, [dashboard, market, query]);

  const allRows = dashboard?.prices?.products || [];
  const pricedRows = allRows.filter((row) => Number.isFinite(Number(row.today_price)));
  const averagePrice = pricedRows.length
    ? pricedRows.reduce((sum, row) => sum + Number(row.today_price), 0) / pricedRows.length
    : null;
  const aboveAverageRows = allRows.filter((row) => (changePercent(row) || 0) > 0);
  const latestDate = allRows.map((row) => row.trans_date).filter(Boolean).sort().at(-1);
  const productStatus = dashboard?.sources?.products?.status || 'error';
  const predictionStatus = dashboard?.sources?.predictions?.status || 'error';
  const partial = dashboard && Object.values(dashboard.sources).some((source) => ['error', 'stale', 'empty'].includes(source.status));
  const fetchedAt = dashboard?.fetchedAt ? new Date(dashboard.fetchedAt).toLocaleString('zh-TW') : '尚未檢查';
  const predictionCount = dashboard?.predictions?.length || 0;
  const highRiskCount = dashboard?.predictions?.filter((row) => row.risk_level === 'high').length || 0;
  const topRows = rows.slice(0, 6);
  const priceComparisonRows = rows
    .filter((row) => Number.isFinite(Number(row.today_price)) || Number.isFinite(Number(row.recent_average)))
    .slice(0, 8);
  const maxComparisonPrice = Math.max(
    1,
    ...priceComparisonRows.flatMap((row) => [Number(row.today_price), Number(row.recent_average)]).filter(Number.isFinite),
  );
  const marketSummary = useMemo(() => {
    const grouped = allRows.reduce((result, row) => {
      const value = Number(row.today_price);
      if (!Number.isFinite(value)) return result;
      const name = row.market_name || '市場未提供';
      const current = result[name] || { name, total: 0, count: 0 };
      current.total += value;
      current.count += 1;
      result[name] = current;
      return result;
    }, {});

    return Object.values(grouped)
      .map((item) => ({ ...item, average: item.total / item.count }))
      .sort((left, right) => right.average - left.average)
      .slice(0, 6);
  }, [allRows]);
  const marketMax = Math.max(1, ...marketSummary.map((item) => item.average));
  const statusCounts = useMemo(() => allRows.reduce((result, row) => {
    const label = statusLabel(row.status);
    result[label] = (result[label] || 0) + 1;
    return result;
  }, {}), [allRows]);
  const statusTotal = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
  const statusColors = {
    '行情正常': '#1d9e75',
    '資料不足': '#ba7517',
    '尚無行情': '#a32d2d',
    '資料狀態未知': '#9b9a90',
  };
  let statusCursor = 0;
  const statusGradient = statusTotal
    ? `conic-gradient(${Object.entries(statusCounts).map(([label, count]) => {
      const start = statusCursor;
      statusCursor += (count / statusTotal) * 100;
      return `${statusColors[label] || '#9b9a90'} ${start}% ${statusCursor}%`;
    }).join(', ')})`
    : '#f0ece5';

  const metrics = [
    {
      label: '今日可查品項',
      value: allRows.length,
      icon: Sprout,
      status: productStatus,
      source: '/api/products',
      description: '目前行情 API 回傳的農產品數量',
    },
    {
      label: '平均市場報價',
      value: formatPrice(averagePrice),
      icon: TrendingUp,
      status: productStatus,
      source: '/api/products',
      description: '依目前可取得報價計算，非官方指數',
    },
    {
      label: '高於近期均價',
      value: aboveAverageRows.length,
      icon: AlertTriangle,
      tone: 'warning',
      status: productStatus,
      source: '/api/products',
      description: '今日報價高於該品項近期均價的筆數',
    },
    {
      label: '可比較市場',
      value: dashboard?.markets?.length || 0,
      icon: MapPinned,
      status: dashboard?.sources?.markets?.status || productStatus,
      source: '/api/markets',
      description: '可用來比較出貨市場的清單',
    },
  ];

  const columns = [
    { key: 'product_name', label: '品項' },
    { key: 'market_name', label: '市場' },
    { key: 'today_price', label: '今日報價', render: (row) => formatPrice(row.today_price) },
    { key: 'recent_average', label: '近期均價', render: (row) => formatPrice(row.recent_average) },
    { key: 'change', label: '相較均價', sortable: false, render: (row) => formatPercent(changePercent(row)) },
    { key: 'status', label: '資料狀態', render: (row) => statusLabel(row.status) },
    { key: 'trans_date', label: '行情日期', hideOnTablet: true },
  ];

  if (loading && !dashboard) {
    return <div className="dashboard-loading">正在整理今日農產行情…</div>;
  }

  if (error && !dashboard) {
    return (
      <EmptyState
        title="農民工作台暫時無法載入"
        description={error}
        action={<button type="button" onClick={() => load()}>重新載入</button>}
      />
    );
  }

  return (
    <div className="dashboard-overview farmer-dashboard">
      <header className="farmer-dashboard-hero">
        <div className="farmer-dashboard-hero-copy">
          <div className="farmer-dashboard-hero-icon" aria-hidden="true"><Sprout size={30} /></div>
          <div>
            <p className="eyebrow">FARMER WORKSPACE</p>
            <h1>農民工作台</h1>
            <p>掌握今日菜價、比較市場行情，安排採收與出貨節奏。</p>
          </div>
        </div>
        <div className="farmer-dashboard-hero-actions">
          <div className="farmer-dashboard-date">
            <span>行情日期</span>
            <strong>{latestDate || '尚未提供'}</strong>
          </div>
          <Badge tone={partial ? 'warning' : 'neutral'}>{partial ? '部分資料需留意' : '資料來源正常'}</Badge>
          <button type="button" onClick={() => load(true)} disabled={refreshing} aria-label="重新整理農民工作台">
            <RefreshCw size={17} className={refreshing ? 'spin' : ''} />
            {refreshing ? '整理中…' : '重新整理'}
          </button>
        </div>
      </header>

      {error && dashboard && <div className="dashboard-inline-warning" role="status">重新整理失敗，畫面保留上次成功資料：{error}</div>}

      <section className="dashboard-metric-grid farmer-dashboard-metrics" aria-label="農民工作台重點指標">
        {metrics.map((metric) => <DashboardMetricCard key={metric.label} {...metric} updatedAt={latestDate || fetchedAt} />)}
      </section>

      <div className="farmer-dashboard-context-strip" aria-label="農業決策背景資料">
        <div>
          <CalendarDays size={18} aria-hidden="true" />
          <span>目前節氣</span>
          <strong>{dashboard?.solarTerm?.term_name || '節氣資料尚未提供'}</strong>
          <small>來源：/api/solar-term</small>
        </div>
        <div>
          <CloudSun size={18} aria-hidden="true" />
          <span>AI 行情預測資料</span>
          <strong>{predictionCount ? `${predictionCount} 筆可參考` : '尚無預測資料'}</strong>
          <small>{sourceStatusText(predictionStatus)}；預測不是保證價格</small>
        </div>
        <div>
          <AlertTriangle size={18} aria-hidden="true" />
          <span>高風險預測</span>
          <strong>{predictionStatus === 'ready' ? `${highRiskCount} 筆` : '—'}</strong>
          <small>需搭配實際行情與生產成本判斷</small>
        </div>
      </div>

      <section className="farmer-visual-grid" aria-label="農產品行情圖表">
        <DashboardChartCard
          title="今日報價與近期均價"
          description="比較目前報價與近期均價，協助判斷出貨與採收方向。"
          source="/api/products · 計算"
          updatedAt={latestDate || fetchedAt}
          error={productStatus === 'error' ? dashboard.sources.products?.error : null}
          empty={!priceComparisonRows.length}
        >
          <div className="farmer-chart-legend" aria-label="圖表圖例">
            <span><i className="farmer-legend-dot is-average" />近期均價</span>
            <span><i className="farmer-legend-dot is-current" />今日報價</span>
          </div>
          <div className="farmer-price-comparison-chart">
            {priceComparisonRows.map((row) => {
              const today = Number(row.today_price);
              const average = Number(row.recent_average);
              const change = changePercent(row);
              return (
                <div className="farmer-price-chart-row" key={`comparison-${row.product_name}-${row.market_name || 'all'}`}>
                  <div className="farmer-price-chart-label">
                    <strong>{row.product_name}</strong>
                    <small>{row.market_name || '市場未提供'}</small>
                  </div>
                  <div className="farmer-price-chart-bars">
                    <div className="farmer-bar-line">
                      <span className="farmer-bar-track"><i className="is-average" style={{ width: `${Number.isFinite(average) ? (average / maxComparisonPrice) * 100 : 0}%` }} /></span>
                      <small>{formatPrice(row.recent_average)}</small>
                    </div>
                    <div className="farmer-bar-line">
                      <span className="farmer-bar-track"><i className={`is-current ${change > 0 ? 'is-up' : 'is-down'}`} style={{ width: `${Number.isFinite(today) ? (today / maxComparisonPrice) * 100 : 0}%` }} /></span>
                      <small>{formatPrice(row.today_price)}</small>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardChartCard>

        <DashboardChartCard
          title="各市場平均報價"
          description="依目前可取得品項計算市場平均值，不代表官方市場指數。"
          source="/api/products · 計算"
          updatedAt={latestDate || fetchedAt}
          error={productStatus === 'error' ? dashboard.sources.products?.error : null}
          empty={!marketSummary.length}
        >
          <div className="farmer-market-bar-chart">
            {marketSummary.map((item) => (
              <div className="farmer-market-bar-item" key={item.name}>
                <strong>{formatPrice(item.average)}</strong>
                <div className="farmer-market-bar-track" aria-hidden="true"><i style={{ height: `${(item.average / marketMax) * 100}%` }} /></div>
                <span title={item.name}>{item.name}</span>
                <small>{item.count} 品項</small>
              </div>
            ))}
          </div>
        </DashboardChartCard>

        <DashboardChartCard
          title="行情資料狀態"
          description="先確認資料完整度，再判讀價格差異。"
          source="/api/products"
          updatedAt={latestDate || fetchedAt}
          error={productStatus === 'error' ? dashboard.sources.products?.error : null}
          empty={!statusTotal}
        >
          <div className="farmer-status-chart">
            <div className="farmer-status-donut" style={{ background: statusGradient }} aria-label={`共 ${statusTotal} 筆行情資料`}>
              <div><strong>{statusTotal}</strong><span>品項</span></div>
            </div>
            <div className="farmer-status-legend">
              {Object.entries(statusCounts).map(([label, count]) => (
                <div key={label}>
                  <i style={{ background: statusColors[label] || '#9b9a90' }} />
                  <span>{label}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </div>
        </DashboardChartCard>
      </section>

      <div className="farmer-dashboard-panels">
        <DashboardChartCard
          title="今日值得留意的報價"
          description="依目前報價排序，價格只代表 API 回傳的觀察值。"
          source="/api/products"
          updatedAt={latestDate || fetchedAt}
          error={productStatus === 'error' ? dashboard.sources.products?.error : null}
          empty={!topRows.length}
        >
          <div className="farmer-price-rank-list">
            {topRows.map((row) => {
              const change = changePercent(row);
              return (
                <button type="button" key={`${row.product_name}-${row.market_name || 'all'}`} onClick={() => navigate(`/product/${encodeURIComponent(row.product_name)}`)}>
                  <span className="farmer-price-rank-name"><strong>{row.product_name}</strong><small>{row.market_name || '市場未提供'}</small></span>
                  <strong>{formatPrice(row.today_price)}</strong>
                  <span className={change > 0 ? 'farmer-change-up' : change < 0 ? 'farmer-change-down' : ''}>{formatPercent(change)}</span>
                </button>
              );
            })}
          </div>
        </DashboardChartCard>

        <DashboardChartCard
          title="採收與出貨提醒"
          description="由行情資料與預測資料整理出的輔助訊號。"
          source="觀察值＋計算結果"
          updatedAt={fetchedAt}
        >
          <div className="farmer-decision-card">
            <div className="farmer-decision-lead">
              <TrendingUp size={22} aria-hidden="true" />
              <strong>{aboveAverageRows.length ? `${aboveAverageRows.length} 個品項高於近期均價` : '目前沒有高於近期均價的品項'}</strong>
            </div>
            <p>{aboveAverageRows.length ? '可先比較不同市場報價，再依採收成本、品質與運輸條件安排出貨。' : '目前報價未顯示高於近期均價的品項，建議持續觀察市場變化。'}</p>
            <ul>
              <li>行情資料：{sourceStatusText(productStatus)}</li>
              <li>預測資料：{sourceStatusText(predictionStatus)}</li>
              <li>最新檢查：{fetchedAt}</li>
            </ul>
          </div>
        </DashboardChartCard>
      </div>

      <section className="dashboard-data-section farmer-price-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">MARKET PRICES</p>
            <h2>今日菜價明細</h2>
            <p>可依品項與市場比較報價；點選資料列可查看商品詳細資訊。</p>
          </div>
          <DashboardFilterBar
            query={query}
            onQueryChange={setQuery}
            market={market}
            onMarketChange={setMarket}
            marketOptions={dashboard?.markets || []}
            onClear={() => { setQuery(''); setMarket(''); }}
          />
        </div>
        <ResponsiveDataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => `${row.product_name}-${row.market_name || 'all'}-${row.trans_date || 'latest'}`}
          loading={loading && !dashboard}
          error={productStatus === 'error' && !rows.length ? dashboard.sources.products?.error : null}
          emptyTitle="目前沒有符合條件的行情資料"
          onRowClick={(row) => navigate(`/product/${encodeURIComponent(row.product_name)}`)}
          mobileCardRenderer={(row) => (
            <>
              <strong>{row.product_name}</strong>
              <span>{row.market_name || '市場未提供'} · {formatPrice(row.today_price)}</span>
              <span>相較近期均價 {formatPercent(changePercent(row))} · {statusLabel(row.status)}</span>
              <span>{row.trans_date || '行情日期未提供'}</span>
            </>
          )}
        />
      </section>
    </div>
  );
}
