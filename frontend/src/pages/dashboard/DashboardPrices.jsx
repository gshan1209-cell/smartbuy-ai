import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  Database,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react';

import DashboardChartCard from '../../components/dashboard/DashboardChartCard';
import DashboardFilterBar from '../../components/dashboard/DashboardFilterBar';
import DashboardMetricCard from '../../components/dashboard/DashboardMetricCard';
import ResponsiveDataTable from '../../components/dashboard/ResponsiveDataTable';
import Drawer from '../../components/shared/Drawer';
import EmptyState from '../../components/shared/EmptyState';
import {
  loadDashboardPrices,
  loadPriceDrawerDetail,
} from '../../lib/dashboardPricesAdapter';
import '../../styles/dashboard-overview.css';
import '../../styles/dashboard-prices.css';

const STATUS_OPTIONS = [
  { value: '', label: '全部狀態' },
  { value: '便宜', label: '便宜' },
  { value: '正常', label: '正常' },
  { value: '偏貴', label: '偏貴' },
  { value: '資料不足', label: '資料不足' },
];

function latestDate(rows) {
  return rows
    .map((row) => row.trans_date)
    .filter(Boolean)
    .reduce((latest, current) => {
      if (!latest) return current;
      const latestTime = Date.parse(latest);
      const currentTime = Date.parse(current);
      if (Number.isFinite(latestTime) && Number.isFinite(currentTime)) {
        return currentTime > latestTime ? current : latest;
      }
      return String(current) > String(latest) ? current : latest;
    }, null);
}

function compareValues(left, right, direction) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const bothNumbers = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
  const result = bothNumbers
    ? leftNumber - rightNumber
    : String(left ?? '').localeCompare(String(right ?? ''), 'zh-TW');
  return direction === 'desc' ? -result : result;
}

function formatNumber(value, suffix = '') {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toLocaleString('zh-TW')}${suffix}`;
}

export default function DashboardPrices() {
  const [dashboard, setDashboard] = useState(null);
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: 'product_name', direction: 'asc' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState('');
  const [selected, setSelected] = useState(null);
  const [drawerDetail, setDrawerDetail] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const pageSize = 20;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setPageError('');

    try {
      const next = await loadDashboardPrices(dashboard);
      setDashboard(next);
    } catch (error) {
      setPageError(error?.message || '行情管理資料整理失敗。');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dashboard]);

  useEffect(() => {
    load();
    // Initial load only. Manual refresh keeps the previous successful data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, market, status, sort]);

  const counts = useMemo(() => {
    const result = { 便宜: 0, 正常: 0, 偏貴: 0, 資料不足: 0 };
    (dashboard?.products || []).forEach((row) => {
      const key = row.status in result ? row.status : '資料不足';
      result[key] += 1;
    });
    return result;
  }, [dashboard]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-TW');
    return (dashboard?.products || [])
      .filter((row) => {
        if (!normalizedQuery) return true;
        const searchText = `${row.product_name} ${row.market_name || ''}`
          .toLocaleLowerCase('zh-TW');
        return searchText.includes(normalizedQuery);
      })
      .filter((row) => !market || row.market_name === market)
      .filter((row) => !status || row.status === status)
      .sort((left, right) =>
        compareValues(left[sort.key], right[sort.key], sort.direction),
      );
  }, [dashboard, market, query, sort, status]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  const productSource = dashboard?.sources.products;
  const marketSource = dashboard?.sources.markets;
  const intelSource = dashboard?.sources.intel;
  const productsStatus = productSource?.status || 'error';
  const intelStatus = intelSource?.status || 'error';
  const fetchedAt = dashboard?.fetchedAt
    ? new Date(dashboard.fetchedAt).toLocaleString('zh-TW')
    : '尚未取得';
  const currentLatestDate = latestDate(dashboard?.products || []);
  const marketCount = dashboard?.markets?.length
    || new Set((dashboard?.products || []).map((row) => row.market_name).filter(Boolean)).size;
  const partialError = dashboard
    && Object.values(dashboard.sources).some((source) => source.status !== 'ready');

  const metrics = [
    {
      label: '可用行情品項',
      value: dashboard?.products?.length,
      icon: Database,
      status: productsStatus,
      source: '/api/products',
      description: '目前 API 回傳的品項狀態數',
    },
    {
      label: '便宜品項',
      value: counts.便宜,
      icon: TrendingDown,
      status: productsStatus,
      source: '/api/products',
      description: '目前狀態為便宜',
    },
    {
      label: '正常品項',
      value: counts.正常,
      icon: ShieldCheck,
      status: productsStatus,
      source: '/api/products',
      description: '目前狀態為正常',
    },
    {
      label: '偏貴品項',
      value: counts.偏貴,
      icon: AlertTriangle,
      tone: 'warning',
      status: productsStatus,
      source: '/api/products',
      description: '目前狀態為偏貴',
    },
    {
      label: '資料不足品項',
      value: counts.資料不足,
      icon: CircleDollarSign,
      status: productsStatus,
      source: '/api/products',
      description: '近期樣本不足或無行情',
    },
    {
      label: '最新交易日',
      value: currentLatestDate || '—',
      icon: CalendarDays,
      status: productsStatus,
      source: '/api/products',
      description: '由行情品項日期取最新值',
    },
    {
      label: '市場數',
      value: marketCount,
      icon: MapPinned,
      status: marketSource?.status || productsStatus,
      source: '/api/markets',
      description: '市場 API 或行情資料去重',
    },
    {
      label: '市場風險',
      value: dashboard?.intel?.market_stability?.risk_level || '—',
      icon: AlertTriangle,
      tone: 'warning',
      status: intelStatus,
      source: '/api/market-intel',
      description: '市場情報 API 正式回傳值',
    },
  ];

  const columns = [
    { key: 'product_name', label: '品項' },
    { key: 'market_name', label: '市場' },
    {
      key: 'today_price',
      label: '今日價格',
      render: (row) => formatNumber(row.today_price, ' 元'),
    },
    {
      key: 'recent_average',
      label: '近期平均',
      render: (row) => formatNumber(row.recent_average, ' 元'),
    },
    { key: 'status', label: '狀態' },
    {
      key: 'suggestion',
      label: '採買建議',
      sortable: false,
      hideOnTablet: true,
    },
    { key: 'trans_date', label: '交易日', hideOnTablet: true },
    {
      key: 'volume',
      label: '成交量',
      hideOnTablet: true,
      render: (row) => formatNumber(row.volume),
    },
  ];

  function handleSort(key) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  async function openDetail(row) {
    setSelected(row);
    setDrawerDetail(null);
    setDrawerLoading(true);
    try {
      const detail = await loadPriceDrawerDetail(row.product_name, row.market_name || '');
      setDrawerDetail(detail);
    } finally {
      setDrawerLoading(false);
    }
  }

  function closeDetail() {
    setSelected(null);
    setDrawerDetail(null);
    setDrawerLoading(false);
  }

  if (loading && !dashboard) {
    return <div className="dashboard-loading">正在載入行情管理資料…</div>;
  }

  if (pageError && !dashboard) {
    return (
      <EmptyState
        title="行情管理暫時無法載入"
        description={pageError}
        action={<button type="button" onClick={() => load()}>重新載入</button>}
      />
    );
  }

  return (
    <div className="dashboard-overview dashboard-prices-page">
      <header className="dashboard-overview-heading">
        <div>
          <p className="eyebrow">Price Management · Read only</p>
          <h1>行情管理</h1>
          <p>唯讀監控正式行情資料，不提供人工修改、刪除或覆寫。</p>
        </div>
        <div className="overview-actions">
          {partialError && <span className="dashboard-partial-badge">部分來源異常</span>}
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
          >
            <RefreshCw size={17} className={refreshing ? 'spin' : ''} />
            {refreshing ? '重新整理中…' : '重新整理'}
          </button>
        </div>
      </header>

      {pageError && dashboard && (
        <div className="dashboard-inline-warning" role="status">
          重新整理失敗，保留上一版成功資料：{pageError}
        </div>
      )}

      <section className="dashboard-metric-grid">
        {metrics.map((metric) => (
          <DashboardMetricCard
            key={metric.label}
            {...metric}
            updatedAt={currentLatestDate || fetchedAt}
          />
        ))}
      </section>

      <div className="dashboard-two-columns">
        <DashboardChartCard
          title="市場健康摘要"
          description="使用正式市場情報 API 顯示風險、偏向與警報。"
          source="/api/market-intel"
          updatedAt={dashboard?.intel?.latest_trade_date || fetchedAt}
          error={intelStatus === 'error' ? intelSource?.error : null}
          empty={intelStatus === 'empty'}
        >
          <div className="intel-summary">
            <strong>{dashboard?.intel?.market_stability?.risk_level || '資料不足'}</strong>
            <span>風險指數：{dashboard?.intel?.market_stability?.risk_index ?? '—'}</span>
            <span>市場偏向：{dashboard?.intel?.market_bias?.bias || '—'}</span>
            <span>異常警報：{dashboard?.intel?.alerts?.length ?? '—'}</span>
            <span>交易日：{dashboard?.intel?.latest_trade_date || '—'}</span>
          </div>
        </DashboardChartCard>

        <DashboardChartCard
          title="行情狀態分布"
          description="依目前 API 回傳的品項狀態統計。"
          source="/api/products"
          updatedAt={currentLatestDate || fetchedAt}
          error={productsStatus === 'error' ? productSource?.error : null}
          empty={!dashboard?.products?.length}
        >
          <div className="price-status-distribution">
            {Object.entries(counts).map(([label, count]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </DashboardChartCard>
      </div>

      <section className="dashboard-data-section">
        <div className="section-title-row dashboard-price-filter-row">
          <div>
            <h2>行情品項清單</h2>
            <p>資料只代表目前 API 回傳範圍，點擊品項可開啟詳情。</p>
          </div>
          <DashboardFilterBar
            query={query}
            onQueryChange={setQuery}
            status={status}
            onStatusChange={setStatus}
            statusOptions={STATUS_OPTIONS}
            market={market}
            onMarketChange={setMarket}
            marketOptions={dashboard?.markets || []}
            onClear={() => {
              setQuery('');
              setStatus('');
              setMarket('');
            }}
          />
        </div>

        <ResponsiveDataTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => `${row.product_name}-${row.market_name || 'all'}-${row.trans_date || 'latest'}`}
          loading={loading && !dashboard}
          error={productsStatus === 'error' && !dashboard?.products?.length
            ? productSource?.error || '行情 API 載入失敗。'
            : null}
          emptyTitle="沒有符合目前篩選條件的行情"
          sort={sort}
          onSort={handleSort}
          page={page}
          pageSize={pageSize}
          total={filteredRows.length}
          onPageChange={setPage}
          onRowClick={openDetail}
          mobileCardRenderer={(row) => (
            <>
              <strong>{row.product_name}</strong>
              <span>{row.market_name || '市場未提供'} · {row.status}</span>
              <span>{formatNumber(row.today_price, ' 元')} · {row.trans_date || '日期未提供'}</span>
              <span>{row.suggestion}</span>
            </>
          )}
        />
      </section>

      <Drawer
        open={Boolean(selected)}
        onClose={closeDetail}
        title="行情詳情"
      >
        {selected && (
          <div className="price-detail-drawer">
            <p className="eyebrow">唯讀行情</p>
            <h3>{selected.product_name}</h3>
            <p>{selected.market_name || '市場未提供'} · {selected.status}</p>
            <strong className="price-detail-main-value">
              {formatNumber(selected.today_price, ' 元')}
            </strong>
            <p>{selected.suggestion}</p>

            <dl>
              <dt>高價</dt><dd>{formatNumber(selected.upper_price)}</dd>
              <dt>中價</dt><dd>{formatNumber(selected.middle_price)}</dd>
              <dt>低價</dt><dd>{formatNumber(selected.lower_price)}</dd>
              <dt>近期平均</dt><dd>{formatNumber(selected.recent_average)}</dd>
              <dt>成交量</dt><dd>{formatNumber(selected.volume)}</dd>
              <dt>交易日</dt><dd>{selected.trans_date || '—'}</dd>
            </dl>

            {drawerLoading && <p>正在載入商品詳情與歷史行情…</p>}
            {drawerDetail?.detailError && (
              <p className="price-detail-error">商品詳情：{drawerDetail.detailError}</p>
            )}
            {drawerDetail?.historyError && (
              <p className="price-detail-error">歷史行情：{drawerDetail.historyError}</p>
            )}
            {drawerDetail?.history?.length > 0 && (
              <div className="price-history-summary">
                <strong>近 30 日歷史資料</strong>
                <span>{drawerDetail.history.length} 個交易日</span>
                <span>最新：{drawerDetail.history.at(-1)?.date || '—'}</span>
              </div>
            )}

            <Link
              className="price-detail-link"
              to={`/product/${encodeURIComponent(selected.product_name)}${selected.market_name ? `?market=${encodeURIComponent(selected.market_name)}` : ''}`}
            >
              前往公開商品詳情
            </Link>
          </div>
        )}
      </Drawer>
    </div>
  );
}
