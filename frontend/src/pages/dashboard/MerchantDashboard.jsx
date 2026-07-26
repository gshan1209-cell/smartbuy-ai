import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgePercent,
  Boxes,
  CalendarDays,
  ExternalLink,
  MapPinned,
  RefreshCw,
  ShoppingBag,
  Store,
  TrendingUp,
} from 'lucide-react';

import DashboardChartCard from '../../components/dashboard/DashboardChartCard';
import DashboardFilterBar from '../../components/dashboard/DashboardFilterBar';
import DashboardMetricCard from '../../components/dashboard/DashboardMetricCard';
import ResponsiveDataTable from '../../components/dashboard/ResponsiveDataTable';
import Badge from '../../components/shared/Badge';
import EmptyState from '../../components/shared/EmptyState';
import { loadMerchantDashboard } from '../../lib/merchantDashboardAdapter';
import '../../styles/dashboard-overview.css';
import '../../styles/dashboard-farmer.css';
import '../../styles/dashboard-merchant.css';

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

function unwrapRows(value) {
  if (Array.isArray(value)) return value;
  return value?.items || value?.data || [];
}

export default function MerchantDashboard() {
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
      setDashboard(await loadMerchantDashboard(dashboard));
    } catch (loadError) {
      setError(loadError?.message || '商家工作台資料載入失敗');
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

  const allRows = dashboard?.prices?.products || [];
  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-TW');
    return allRows
      .filter((row) => {
        if (!normalizedQuery) return true;
        return `${row.product_name} ${row.market_name || ''}`
          .toLocaleLowerCase('zh-TW')
          .includes(normalizedQuery);
      })
      .filter((row) => !market || row.market_name === market)
      .sort((left, right) => (Number(right.today_price) || -Infinity) - (Number(left.today_price) || -Infinity));
  }, [allRows, market, query]);

  const pricedRows = allRows.filter((row) => Number.isFinite(Number(row.today_price)));
  const averagePrice = pricedRows.length
    ? pricedRows.reduce((sum, row) => sum + Number(row.today_price), 0) / pricedRows.length
    : null;
  const latestDate = allRows.map((row) => row.trans_date).filter(Boolean).sort().at(-1);
  const productStatus = dashboard?.sources?.products?.status || 'error';
  const marketStatus = dashboard?.sources?.markets?.status || productStatus;
  const fetchedAt = dashboard?.fetchedAt ? new Date(dashboard.fetchedAt).toLocaleString('zh-TW') : '尚未檢查';
  const offerTemplates = dashboard?.offerTemplates || [];
  const aboveAverageRows = pricedRows.filter((row) => (changePercent(row) || 0) > 0);
  const pricedMarketCount = new Set(pricedRows.map((row) => row.market_name).filter(Boolean)).size;

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

  const maxChartPrice = Math.max(
    1,
    ...allRows.flatMap((row) => [Number(row.today_price), Number(row.recent_average)]).filter(Number.isFinite),
  );
  const marketMax = Math.max(1, ...marketSummary.map((item) => item.average));
  const ratioGradient = (ratio, primary, secondary = '#edf1ef') => `conic-gradient(${primary} 0 ${ratio * 100}%, ${secondary} ${ratio * 100}% 100%)`;

  const metrics = [
    {
      label: '可參考行情品項',
      value: allRows.length,
      icon: Boxes,
      status: productStatus,
      source: '/api/products',
      description: '提供商家採購與定價參考的行情品項',
      visual: {
        gradient: ratioGradient(allRows.length ? pricedRows.length / allRows.length : 0, '#1d9e75'),
        centerValue: pricedRows.length,
        centerLabel: '有報價',
        segments: [
          { label: '目前有報價', value: pricedRows.length, color: '#1d9e75' },
          { label: '待補行情', value: Math.max(0, allRows.length - pricedRows.length), color: '#edf1ef' },
        ],
      },
    },
    {
      label: '平均市場報價',
      value: formatPrice(averagePrice),
      icon: TrendingUp,
      status: productStatus,
      source: '/api/products',
      description: '依目前可取得報價計算，非官方市場指數',
      visual: {
        gradient: ratioGradient(averagePrice == null ? 0 : Math.min(1, averagePrice / maxChartPrice), '#378add'),
        centerValue: averagePrice == null ? '—' : Number(averagePrice).toFixed(1),
        centerLabel: '元',
        segments: [
          { label: '相對最高報價', value: `${Math.round((averagePrice == null ? 0 : averagePrice / maxChartPrice) * 100)}%`, color: '#378add' },
          { label: '與最高報價差距', value: `${Math.round((averagePrice == null ? 1 : 1 - averagePrice / maxChartPrice) * 100)}%`, color: '#edf1ef' },
        ],
      },
    },
    {
      label: '可比較市場',
      value: dashboard?.markets?.length || 0,
      icon: MapPinned,
      status: marketStatus,
      source: '/api/markets',
      description: '可用來比較採購成本與銷售策略的市場清單',
      visual: {
        gradient: ratioGradient(dashboard?.markets?.length ? Math.min(1, pricedMarketCount / dashboard.markets.length) : 0, '#1d9e75'),
        centerValue: dashboard?.markets?.length || 0,
        centerLabel: '市場',
        segments: [
          { label: '目前有報價市場', value: pricedMarketCount, color: '#1d9e75' },
          { label: '尚待行情市場', value: Math.max(0, (dashboard?.markets?.length || 0) - pricedMarketCount), color: '#edf1ef' },
        ],
      },
    },
    {
      label: '促銷素材範本',
      value: offerTemplates.length,
      icon: BadgePercent,
      status: 'demo',
      source: 'DEMO_SPECIAL_OFFERS',
      description: '促銷版位展示資料，非實際上架與銷售統計',
      visual: {
        gradient: ratioGradient(1, '#ba7517'),
        centerValue: offerTemplates.length,
        centerLabel: '範本',
        segments: [
          { label: '展示版位', value: offerTemplates.length, color: '#ba7517' },
        ],
      },
    },
  ];

  const topRows = rows.slice(0, 8);
  const partial = dashboard && Object.values(dashboard.sources).some((source) => ['error', 'stale', 'empty'].includes(source.status));
  const columns = [
    { key: 'product_name', label: '品項' },
    { key: 'market_name', label: '市場' },
    { key: 'today_price', label: '今日報價', render: (row) => formatPrice(row.today_price) },
    { key: 'recent_average', label: '近期均價', render: (row) => formatPrice(row.recent_average) },
    { key: 'change', label: '相較均價', sortable: false, render: (row) => formatPercent(changePercent(row)) },
    { key: 'trans_date', label: '行情日期', hideOnTablet: true },
  ];

  if (loading && !dashboard) {
    return <div className="dashboard-loading">正在載入商家工作台資料…</div>;
  }

  if (error && !dashboard) {
    return <EmptyState title="商家工作台暫時無法載入" description={error} action={<button type="button" onClick={() => load()}>重新載入</button>} />;
  }

  return (
    <div className="dashboard-overview farmer-dashboard merchant-dashboard">
      <header className="farmer-dashboard-hero merchant-dashboard-hero">
        <div className="farmer-dashboard-hero-copy">
          <div className="farmer-dashboard-hero-icon merchant-dashboard-hero-icon" aria-hidden="true"><Store size={30} /></div>
          <div>
            <p className="eyebrow">MERCHANT WORKSPACE</p>
            <h1>商家工作台</h1>
            <p>掌握農產品行情、採購成本與促銷版位，讓商品定價更有依據。</p>
          </div>
        </div>
        <div className="farmer-dashboard-hero-actions">
          <div className="farmer-dashboard-date">
            <span>最新行情日期</span>
            <strong>{latestDate || '尚未提供'}</strong>
          </div>
          <Badge tone={partial ? 'warning' : 'neutral'}>{partial ? '部分資料需留意' : '資料狀態正常'}</Badge>
          <button type="button" onClick={() => load(true)} disabled={refreshing} aria-label="重新整理商家工作台">
            <RefreshCw size={17} className={refreshing ? 'spin' : ''} />
            {refreshing ? '更新中…' : '重新整理'}
          </button>
        </div>
      </header>

      {error && dashboard && <div className="dashboard-inline-warning" role="status">重新整理失敗，畫面保留上次成功資料：{error}</div>}

      <section className="dashboard-metric-grid farmer-dashboard-metrics" aria-label="商家工作台重點指標">
        {metrics.map((metric) => <DashboardMetricCard key={metric.label} {...metric} hideSource updatedAt={latestDate || fetchedAt} />)}
      </section>

      <div className="farmer-dashboard-context-strip merchant-dashboard-context-strip" aria-label="商家決策背景資料">
        <div>
          <ShoppingBag size={18} aria-hidden="true" />
          <span>採購行情提醒</span>
          <strong>{aboveAverageRows.length ? `${aboveAverageRows.length} 項高於近期均價` : '目前沒有高於均價品項'}</strong>
          <small>請搭配進貨成本與庫存判斷</small>
        </div>
        <div>
          <CalendarDays size={18} aria-hidden="true" />
          <span>行情資料日期</span>
          <strong>{latestDate || '尚未提供'}</strong>
          <small>來源：/api/products</small>
        </div>
        <div>
          <BadgePercent size={18} aria-hidden="true" />
          <span>促銷內容狀態</span>
          <strong>展示素材預覽</strong>
          <small>實際上架統計 API 尚未提供</small>
        </div>
      </div>

      <section className="farmer-visual-grid merchant-dashboard-visual-grid" aria-label="商家行情圖表">
        <DashboardChartCard
          title="商品採購價差"
          description="比較今日報價與近期均價，協助規劃採購與售價。"
          source="/api/products · 計算"
          updatedAt={latestDate || fetchedAt}
          error={productStatus === 'error' ? dashboard.sources.products?.error : null}
          empty={!topRows.length}
        >
          <div className="farmer-chart-legend"><span><i className="farmer-legend-dot is-average" />近期均價</span><span><i className="farmer-legend-dot is-current" />今日報價</span></div>
          <div className="farmer-price-comparison-chart">
            {topRows.map((row) => {
              const today = Number(row.today_price);
              const average = Number(row.recent_average);
              const change = changePercent(row);
              return (
                <div className="farmer-price-chart-row" key={`merchant-comparison-${row.product_name}-${row.market_name || 'all'}`}>
                  <div className="farmer-price-chart-label"><strong>{row.product_name}</strong><small>{row.market_name || '市場未提供'}</small></div>
                  <div className="farmer-price-chart-bars">
                    <div className="farmer-bar-line"><span className="farmer-bar-track"><i className="is-average" style={{ width: `${Number.isFinite(average) ? (average / maxChartPrice) * 100 : 0}%` }} /></span><small>{formatPrice(row.recent_average)}</small></div>
                    <div className="farmer-bar-line"><span className="farmer-bar-track"><i className={`is-current ${change > 0 ? 'is-up' : 'is-down'}`} style={{ width: `${Number.isFinite(today) ? (today / maxChartPrice) * 100 : 0}%` }} /></span><small>{formatPrice(row.today_price)}</small></div>
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardChartCard>

        <DashboardChartCard
          title="各市場平均報價"
          description="依目前可取得品項計算，協助比較採購市場。"
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
          title="促銷版位預覽"
          description="沿用好康卡片形式提供商家內容設計參考。"
          source="DEMO_SPECIAL_OFFERS · 展示資料"
          updatedAt="靜態展示"
          empty={!offerTemplates.length}
        >
          <div className="merchant-offer-preview-grid">
            {offerTemplates.map((offer) => (
              <article className="merchant-offer-preview-card" key={offer.id}>
                <div className="merchant-offer-preview-icon" aria-hidden="true">{offer.merchantIcon}</div>
                <div className="merchant-offer-preview-copy">
                  <span>{offer.badge}</span>
                  <strong>{offer.title}</strong>
                  <small>{offer.merchantName} · {offer.offerNote}</small>
                </div>
                {offer.websiteUrl && <a href={offer.websiteUrl} target="_blank" rel="noreferrer" aria-label={`開啟${offer.merchantName}官網`}><ExternalLink size={16} /></a>}
              </article>
            ))}
          </div>
        </DashboardChartCard>
      </section>

      <section className="dashboard-data-section farmer-price-section merchant-price-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">MERCHANT MARKET VIEW</p>
            <h2>採購行情明細</h2>
            <p>使用官方行情觀察值比較品項與市場，實際售價仍請搭配成本與庫存評估。</p>
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
          emptyTitle="目前沒有可比較的行情資料"
          onRowClick={(row) => navigate(`/product/${encodeURIComponent(row.product_name)}`)}
          mobileCardRenderer={(row) => (
            <>
              <strong>{row.product_name}</strong>
              <span>{row.market_name || '市場未提供'} · {formatPrice(row.today_price)}</span>
              <span>相較近期均價 {formatPercent(changePercent(row))}</span>
              <span>{row.trans_date || '行情日期未提供'}</span>
            </>
          )}
        />
      </section>
    </div>
  );
}
