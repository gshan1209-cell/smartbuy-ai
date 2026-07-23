import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock3,
  Database,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import DashboardChartCard from '../../components/dashboard/DashboardChartCard';
import DashboardFilterBar from '../../components/dashboard/DashboardFilterBar';
import DashboardMetricCard from '../../components/dashboard/DashboardMetricCard';
import ResponsiveDataTable from '../../components/dashboard/ResponsiveDataTable';
import Badge from '../../components/shared/Badge';
import EmptyState from '../../components/shared/EmptyState';
import { loadDashboardOverview, unavailableSources } from '../../lib/dashboardOverviewAdapter';
import '../../styles/dashboard-overview.css';

const sourceLabel = {
  products: '行情 API',
  marketIntel: '市場情報 API',
  predictions: 'AI 預測 API',
  mutualAid: '互助網 API',
};

const riskLabel = {
  high: '高風險',
  medium: '中風險',
  normal: '一般',
};

function compareValues(left, right, direction) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const bothNumbers = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
  const result = bothNumbers
    ? leftNumber - rightNumber
    : String(left ?? '').localeCompare(String(right ?? ''), 'zh-TW');
  return direction === 'desc' ? -result : result;
}

export default function DashboardOverview() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fullError, setFullError] = useState('');
  const [query, setQuery] = useState('');
  const [risk, setRisk] = useState('high');
  const [sort, setSort] = useState({ key: 'pred_confidence', direction: 'desc' });
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const refresh = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setFullError('');

    try {
      const next = await loadDashboardOverview(dashboard);
      setDashboard((previous) => ({ ...next, previous: Boolean(previous) }));
    } catch (error) {
      setFullError(error?.message || 'Dashboard 資料整理失敗');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dashboard]);

  useEffect(() => {
    refresh();
    // Initial load only. Manual refresh uses the latest dashboard state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, risk, sort]);

  const filteredPredictions = useMemo(() => {
    const rows = dashboard?.predictions?.rows || [];
    return rows
      .filter((row) => {
        if (!query) return true;
        const text = `${row.crop_name || row.product_name || ''} ${row.market_name || ''}`;
        return text.toLocaleLowerCase('zh-TW').includes(query.toLocaleLowerCase('zh-TW'));
      })
      .filter((row) => !risk || (row.risk_level || 'normal') === risk)
      .sort((left, right) => compareValues(left[sort.key], right[sort.key], sort.direction));
  }, [dashboard, query, risk, sort]);

  const pagedPredictions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPredictions.slice(start, start + pageSize);
  }, [filteredPredictions, page]);

  const partial = dashboard
    && Object.values(dashboard.sources).some((source) => ['error', 'stale', 'empty'].includes(source.status));
  const updatedAt = dashboard?.fetchedAt
    ? new Date(dashboard.fetchedAt).toLocaleString('zh-TW')
    : '尚未檢查';

  const productStatus = dashboard?.sources.products?.status || 'error';
  const predictionStatus = dashboard?.sources.predictions?.status || 'error';
  const mutualStatus = dashboard?.sources.mutualAid?.status || 'error';
  const intelStatus = dashboard?.sources.marketIntel?.status || 'error';

  const productDescription = ['ready', 'empty', 'stale'].includes(productStatus)
    ? `${dashboard?.products?.markets ?? 0} 個市場 · 目前品項數`
    : '行情 API 未提供可用統計';

  const metrics = [
    {
      label: '可用行情品項',
      value: dashboard?.products?.count,
      icon: Database,
      status: productStatus,
      source: sourceLabel.products,
      description: productDescription,
    },
    {
      label: '最新交易日',
      value: dashboard?.products?.latestDate || '—',
      icon: Clock3,
      status: productStatus,
      source: sourceLabel.products,
      description: '由品項資料日期取最新值',
    },
    {
      label: '偏貴品項',
      value: dashboard?.products?.expensive,
      icon: AlertTriangle,
      tone: 'warning',
      status: productStatus,
      source: sourceLabel.products,
      description: '目前品項狀態為偏貴',
    },
    {
      label: '市場風險等級',
      value: dashboard?.marketIntel?.market_stability?.risk_level || '—',
      icon: ShieldAlert,
      tone: 'warning',
      status: intelStatus,
      source: sourceLabel.marketIntel,
      description: '市場情報 API 回傳值',
    },
    {
      label: '本次取得預測筆數',
      value: dashboard?.predictions?.count,
      icon: Activity,
      status: predictionStatus,
      source: sourceLabel.predictions,
      description: 'API limit=100，非全站總數',
    },
    {
      label: '高風險預測數',
      value: dashboard?.predictions?.risk?.high,
      icon: ShieldAlert,
      tone: 'danger',
      status: predictionStatus,
      source: sourceLabel.predictions,
      description: '本次取得樣本中的 high',
    },
    {
      label: '最近未結案互助貼文',
      value: dashboard?.mutualAid?.open,
      icon: Users,
      status: mutualStatus,
      source: sourceLabel.mutualAid,
      description: '最近取得範圍中的未結案數',
    },
    {
      label: '未接管理 API 模組',
      value: unavailableSources.length,
      icon: BarChart3,
      status: 'unavailable',
      source: '管理 API 狀態',
      description: '會員、收藏、任務、系統錯誤',
    },
  ];

  const predictionColumns = [
    { key: 'crop_name', label: '品項', render: (row) => row.crop_name || row.product_name || '—' },
    { key: 'market_name', label: '市場' },
    { key: 'pred_label_name', label: '方向', render: (row) => row.pred_label_name || row.direction || '—' },
    {
      key: 'pred_confidence',
      label: '信心',
      render: (row) => row.pred_confidence == null ? '—' : `${Math.round(row.pred_confidence * 100)}%`,
    },
    { key: 'risk_level', label: '風險', render: (row) => riskLabel[row.risk_level] || row.risk_level || '—' },
    { key: 'base_date', label: '基準日', hideOnTablet: true },
    { key: 'data_staleness_days', label: '資料新鮮度', hideOnTablet: true, render: (row) => row.data_staleness_days == null ? '—' : `${row.data_staleness_days} 天` },
  ];

  const aidColumns = [
    { key: 'type', label: '類型', sortable: false },
    { key: 'content', label: '內容摘要', sortable: false, render: (row) => String(row.content || '').slice(0, 38) || '—' },
    { key: 'location_city', label: '縣市', sortable: false },
    { key: 'status', label: '狀態', sortable: false },
    { key: 'like_count', label: '按讚', sortable: false },
    { key: 'created_at', label: '建立時間', sortable: false, hideOnTablet: true, render: (row) => row.created_at ? new Date(row.created_at).toLocaleString('zh-TW') : '—' },
  ];

  function handleSort(key) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  if (loading && !dashboard) {
    return <div className="dashboard-loading">正在載入 Dashboard 資料…</div>;
  }

  if (fullError && !dashboard) {
    return (
      <EmptyState
        title="Dashboard 暫時無法載入"
        description={fullError}
        action={<button type="button" className="dashboard-retry" onClick={() => refresh()}>重新載入</button>}
      />
    );
  }

  return (
    <div className="dashboard-overview">
      <header className="dashboard-overview-heading">
        <div>
          <p className="eyebrow">Dashboard Overview</p>
          <h1>營運總覽</h1>
          <p>正式 API 優先的營運資料摘要。最後檢查：{updatedAt}</p>
        </div>
        <div className="overview-actions">
          <Badge tone={partial ? 'warning' : 'neutral'}>
            {partial ? '部分資料來源異常' : '資料來源正常'}
          </Badge>
          <button
            type="button"
            onClick={() => refresh(true)}
            disabled={refreshing}
            aria-label="重新整理 Dashboard 資料"
          >
            <RefreshCw size={17} className={refreshing ? 'spin' : ''} />
            {refreshing ? '重新整理中…' : '重新整理'}
          </button>
        </div>
      </header>

      {fullError && dashboard && (
        <div className="dashboard-inline-warning" role="status">
          重新整理失敗，畫面保留上次成功資料：{fullError}
        </div>
      )}

      <section className="dashboard-metric-grid">
        {metrics.map((metric) => (
          <DashboardMetricCard key={metric.label} {...metric} updatedAt={updatedAt} />
        ))}
      </section>

      <section className="dashboard-source-health">
        <h2>資料來源健康狀態</h2>
        <div>
          {Object.values(dashboard.sources).map((source) => (
            <span className={`source-health source-${source.status}`} key={source.key}>
              <strong>{source.label}</strong>
              <Badge tone={source.status === 'ready' ? 'neutral' : 'warning'}>
                {source.status === 'ready'
                  ? '正常'
                  : source.status === 'stale'
                    ? '沿用上次資料'
                    : source.status === 'empty'
                      ? '空資料'
                      : '載入失敗'}
              </Badge>
              <small>{source.checkedAt ? new Date(source.checkedAt).toLocaleTimeString('zh-TW') : '—'}</small>
              {source.error && <small className="source-error-detail">{source.error}</small>}
            </span>
          ))}
          {unavailableSources.map(([key, label]) => (
            <span className="source-health source-unavailable" key={key}>
              <strong>{label}</strong>
              <Badge tone="neutral">尚未接入</Badge>
              <small>目前無正式管理 API</small>
            </span>
          ))}
        </div>
      </section>

      <div className="dashboard-two-columns">
        <DashboardChartCard
          title="市場情報摘要"
          description="市場風險、漲跌排行與警報，來源為正式市場情報 API。"
          source={sourceLabel.marketIntel}
          updatedAt={dashboard.marketIntel?.latest_trade_date || dashboard.sources.marketIntel?.checkedAt}
          error={intelStatus === 'error' ? '市場情報 API 載入失敗，未以低風險或 0 警報替代。' : null}
          empty={intelStatus === 'empty'}
        >
          <div className="intel-summary">
            <strong>{dashboard.marketIntel?.market_stability?.risk_level || '資料不足'}</strong>
            <span>風險指數：{dashboard.marketIntel?.market_stability?.risk_index ?? '—'}</span>
            <span>市場偏向：{dashboard.marketIntel?.market_bias?.bias || '—'}</span>
            <span>警報：{dashboard.marketIntel?.alerts?.length ?? '—'}</span>
            <span>交易日：{dashboard.marketIntel?.latest_trade_date || '—'}</span>
          </div>
          <div className="market-intel-lists">
            <div><b>漲幅排行</b><p>{(dashboard.marketIntel?.gainers || []).map((item) => item.crop_name).join('、') || '無資料'}</p></div>
            <div><b>跌幅排行</b><p>{(dashboard.marketIntel?.losers || []).map((item) => item.crop_name).join('、') || '無資料'}</p></div>
            <div><b>波動品項</b><p>{dashboard.marketIntel?.market_stability?.volatile_crops?.join('、') || '無資料'}</p></div>
            <div><b>穩定品項</b><p>{dashboard.marketIntel?.market_stability?.stable_crops?.join('、') || '無資料'}</p></div>
          </div>
        </DashboardChartCard>

        <DashboardChartCard
          title="AI 預測分布"
          description="最近一次 API limit=100 的方向與風險樣本分布。"
          source={sourceLabel.predictions}
          updatedAt={dashboard.predictions?.latestDate || dashboard.sources.predictions?.checkedAt}
          error={predictionStatus === 'error' ? 'AI 預測 API 載入失敗。' : null}
          empty={predictionStatus === 'empty' || !dashboard.predictions?.count}
        >
          <div className="distribution-section">
            <h3>方向分布</h3>
            <div className="distribution-bars">
              {Object.entries(dashboard.predictions?.direction || {}).map(([label, count]) => (
                <div key={label}>
                  <span>{label}</span>
                  <div><i style={{ width: `${dashboard.predictions.count ? (count / dashboard.predictions.count) * 100 : 0}%` }} /></div>
                  <b>{count}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="distribution-section">
            <h3>風險分布</h3>
            <div className="distribution-bars">
              {Object.entries(dashboard.predictions?.risk || {}).map(([label, count]) => (
                <div key={label}>
                  <span>{riskLabel[label] || label}</span>
                  <div><i style={{ width: `${dashboard.predictions.count ? (count / dashboard.predictions.count) * 100 : 0}%` }} /></div>
                  <b>{count}</b>
                </div>
              ))}
            </div>
          </div>
        </DashboardChartCard>
      </div>

      <section className="dashboard-data-section">
        <div className="section-title-row">
          <div>
            <h2>{risk ? `AI ${riskLabel[risk] || risk}預測` : 'AI 預測清單'}</h2>
            <p>預設顯示本次取得樣本中的高風險項目，可切換其他風險。</p>
          </div>
          <DashboardFilterBar
            query={query}
            onQueryChange={setQuery}
            status={risk}
            onStatusChange={setRisk}
            onClear={() => {
              setQuery('');
              setRisk('high');
            }}
          />
        </div>
        <ResponsiveDataTable
          columns={predictionColumns}
          rows={pagedPredictions}
          rowKey={(row) => `${row.crop_id || row.crop_name}-${row.market_id || row.market_name}-${row.base_date}`}
          emptyTitle="目前沒有符合的預測資料"
          sort={sort}
          onSort={handleSort}
          page={page}
          pageSize={pageSize}
          total={filteredPredictions.length}
          onPageChange={setPage}
          mobileCardRenderer={(row) => (
            <>
              <strong>{row.crop_name || row.product_name || '—'}</strong>
              <span>{row.market_name || '市場未提供'} · {riskLabel[row.risk_level] || row.risk_level || '風險未提供'}</span>
              <span>{row.pred_label_name || row.direction || '—'} · {row.base_date || '日期未提供'}</span>
            </>
          )}
        />
      </section>

      <section className="dashboard-data-section">
        <div className="section-title-row">
          <div>
            <h2>最近未結案互助貼文</h2>
            <p>僅代表最近 API 取得範圍，不代表全站總數。</p>
          </div>
        </div>
        <ResponsiveDataTable
          columns={aidColumns}
          rows={dashboard.mutualAid?.rows || []}
          rowKey={(row) => row.id}
          emptyTitle="最近沒有未結案貼文"
          onRowClick={(row) => navigate(`/mutual-aid?post=${row.id}`)}
          mobileCardRenderer={(row) => (
            <>
              <strong>{row.type || '類型未提供'}</strong>
              <span>{row.location_city || '地區未提供'} · {row.status || '狀態未提供'}</span>
              <span>{String(row.content || '').slice(0, 50)}</span>
            </>
          )}
        />
      </section>
    </div>
  );
}
