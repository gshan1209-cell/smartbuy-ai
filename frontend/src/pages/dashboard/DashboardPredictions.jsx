import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock,
  Database,
  Percent,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import DashboardChartCard from '../../components/dashboard/DashboardChartCard';
import DashboardFilterBar from '../../components/dashboard/DashboardFilterBar';
import DashboardMetricCard from '../../components/dashboard/DashboardMetricCard';
import ResponsiveDataTable from '../../components/dashboard/ResponsiveDataTable';
import Badge from '../../components/shared/Badge';
import Drawer from '../../components/shared/Drawer';
import EmptyState from '../../components/shared/EmptyState';
import {
  loadDashboardPredictions,
  loadPredictionDrawerDetail,
} from '../../lib/dashboardPredictionsAdapter';

import '../../styles/dashboard-overview.css';
import '../../styles/dashboard-predictions.css';

const DIRECTION_OPTIONS = [
  { value: '漲', label: '漲' },
  { value: '持平', label: '持平' },
  { value: '跌', label: '跌' },
];

const RISK_OPTIONS = [
  { value: 'high', label: '高風險 (high)' },
  { value: 'medium', label: '中風險 (medium)' },
  { value: 'normal', label: '一般 (normal)' },
];

function compareValues(left, right, direction) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const bothNumbers = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
  const result = bothNumbers
    ? leftNumber - rightNumber
    : String(left ?? '').localeCompare(String(right ?? ''), 'zh-TW');
  return direction === 'desc' ? -result : result;
}

export default function DashboardPredictions() {
  const [dashboard, setDashboard] = useState(null);
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState('');
  const [predDirection, setPredDirection] = useState('');
  const [risk, setRisk] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: 'crop_name', direction: 'asc' });
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
      const next = await loadDashboardPredictions(dashboard);
      setDashboard(next);
    } catch (error) {
      setPageError(error?.message || 'AI 預測監控資料載入失敗。');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dashboard]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, market, predDirection, risk, sort]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-TW');
    return (dashboard?.predictions || [])
      .filter((row) => {
        if (!normalizedQuery) return true;
        const searchText = `${row.crop_name} ${row.market_name || ''}`
          .toLocaleLowerCase('zh-TW');
        return searchText.includes(normalizedQuery);
      })
      .filter((row) => !market || row.market_name === market)
      .filter((row) => !predDirection || row.pred_label_name === predDirection)
      .filter((row) => !risk || row.risk_level === risk)
      .sort((left, right) =>
        compareValues(left[sort.key], right[sort.key], sort.direction),
      );
  }, [dashboard, market, predDirection, query, risk, sort]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  const predictionsSource = dashboard?.sources.predictions;
  const status = predictionsSource?.status || 'error';
  const fetchedAt = dashboard?.fetchedAt
    ? new Date(dashboard.fetchedAt).toLocaleString('zh-TW')
    : '尚未取得';

  const stats = dashboard?.stats || {
    totalCount: 0,
    latestBaseDate: null,
    directionCounts: { 漲: 0, 持平: 0, 跌: 0 },
    riskCounts: { normal: 0, medium: 0, high: 0 },
    avgConfidence: 0,
    staleOrMissingCount: 0,
    highRiskList: [],
  };

  const partialError = dashboard
    && Object.values(dashboard.sources).some((s) => s.status !== 'ready');

  const metrics = [
    {
      label: '本次取得預測樣本',
      value: stats.totalCount,
      icon: Database,
      status,
      source: '/api/predictions/direction?limit=500',
      description: 'API 目前取得的預測樣本筆數',
    },
    {
      label: '最新預測基準日',
      value: stats.latestBaseDate || '—',
      icon: CalendarDays,
      status,
      source: '/api/predictions/direction',
      description: '所有預測樣本之最新 base_date',
    },
    {
      label: '漲勢樣本數',
      value: stats.directionCounts['漲'],
      icon: TrendingUp,
      status,
      source: '/api/predictions/direction',
      description: '預測下一交易日價格上漲',
    },
    {
      label: '持平樣本數',
      value: stats.directionCounts['持平'],
      icon: CheckCircle2,
      status,
      source: '/api/predictions/direction',
      description: '預測下一交易日價格持平',
    },
    {
      label: '跌勢樣本數',
      value: stats.directionCounts['跌'],
      icon: TrendingDown,
      status,
      source: '/api/predictions/direction',
      description: '預測下一交易日價格下跌',
    },
    {
      label: '高風險樣本數',
      value: stats.riskCounts.high,
      icon: AlertTriangle,
      tone: 'warning',
      status,
      source: '/api/predictions/direction',
      description: '風險等級為 high 的樣本筆數',
    },
    {
      label: '平均信心值',
      value: `${(stats.avgConfidence * 100).toFixed(1)}%`,
      icon: Percent,
      status,
      source: '/api/predictions/direction',
      description: '本次樣本平均模型信心度',
    },
    {
      label: '資料過期/缺漏樣本',
      value: stats.staleOrMissingCount,
      icon: Clock,
      status,
      source: '/api/predictions/direction',
      description: '資料新鮮度過期或資料缺漏筆數',
    },
  ];

  const columns = [
    { key: 'crop_name', label: '品項' },
    { key: 'market_name', label: '市場' },
    {
      key: 'pred_label_name',
      label: '方向',
      render: (row) => (
        <Badge
          tone={
            row.pred_label_name === '漲'
              ? 'danger'
              : row.pred_label_name === '跌'
                ? 'success'
                : 'neutral'
          }
        >
          {row.pred_label_name}
        </Badge>
      ),
    },
    {
      key: 'pred_confidence',
      label: '信心',
      render: (row) => `${(row.pred_confidence * 100).toFixed(1)}%`,
    },
    {
      key: 'risk_level',
      label: '風險',
      render: (row) => (
        <Badge
          tone={
            row.risk_level === 'high'
              ? 'danger'
              : row.risk_level === 'medium'
                ? 'warning'
                : 'success'
          }
        >
          {row.risk_level}
        </Badge>
      ),
    },
    { key: 'base_date', label: '基準日', hideOnTablet: true },
    {
      key: 'data_staleness_days',
      label: '資料新鮮度',
      hideOnTablet: true,
      render: (row) => `${row.data_staleness_days} 天`,
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
      const res = await loadPredictionDrawerDetail(
        row.crop_name,
        row.market_name,
        row.crop_id,
        row.market_id,
      );
      setDrawerDetail(res);
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
    return <div className="dashboard-loading">正在載入 AI 預測監控資料…</div>;
  }

  if (pageError && !dashboard) {
    return (
      <EmptyState
        title="AI 預測監控暫時無法載入"
        description={pageError}
        action={<button type="button" onClick={() => load()}>重新載入</button>}
      />
    );
  }

  return (
    <div className="dashboard-overview dashboard-predictions-page">
      <header className="dashboard-overview-heading">
        <div>
          <p className="eyebrow">AI Prediction Monitoring</p>
          <h1>AI 預測監控</h1>
          <p>即時監控價格方向預測結果、模型信心與風險分布。</p>
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
            updatedAt={stats.latestBaseDate || fetchedAt}
          />
        ))}
      </section>

      <div className="dashboard-two-columns">
        <DashboardChartCard
          title="預測方向分布"
          description="統計本次取得預測樣本之跌／持平／漲占比。"
          source="/api/predictions/direction"
          updatedAt={stats.latestBaseDate || fetchedAt}
          error={status === 'error' ? predictionsSource?.error : null}
          empty={!dashboard?.predictions?.length}
        >
          <div className="prediction-distribution-grid">
            <div className="prediction-direction-up">
              <span>漲勢樣本</span>
              <strong>{stats.directionCounts['漲']}</strong>
            </div>
            <div className="prediction-direction-flat">
              <span>持平樣本</span>
              <strong>{stats.directionCounts['持平']}</strong>
            </div>
            <div className="prediction-direction-down">
              <span>跌勢樣本</span>
              <strong>{stats.directionCounts['跌']}</strong>
            </div>
          </div>
        </DashboardChartCard>

        <DashboardChartCard
          title="風險等級分布"
          description="統計本次預測樣本之風險評級 (high / medium / normal)。"
          source="/api/predictions/direction"
          updatedAt={stats.latestBaseDate || fetchedAt}
          error={status === 'error' ? predictionsSource?.error : null}
          empty={!dashboard?.predictions?.length}
        >
          <div className="prediction-distribution-grid">
            <div className="prediction-risk-high">
              <span>高風險 (high)</span>
              <strong>{stats.riskCounts.high}</strong>
            </div>
            <div className="prediction-risk-medium">
              <span>中風險 (medium)</span>
              <strong>{stats.riskCounts.medium}</strong>
            </div>
            <div className="prediction-risk-normal">
              <span>一般 (normal)</span>
              <strong>{stats.riskCounts.normal}</strong>
            </div>
          </div>
        </DashboardChartCard>
      </div>

      {stats.highRiskList.length > 0 && (
        <DashboardChartCard
          title="高風險警示預測樣本"
          description="列出 risk_level 為 high 的即時預測項目。"
          source="/api/predictions/direction"
          updatedAt={stats.latestBaseDate || fetchedAt}
        >
          <div className="high-risk-list">
            {stats.highRiskList.slice(0, 5).map((item) => (
              <div key={`${item.crop_name}-${item.market_name}`} className="high-risk-item">
                <div>
                  <strong>{item.crop_name} ({item.market_name})</strong>
                  <span>方向：{item.pred_label_name} · 信心：{(item.pred_confidence * 100).toFixed(1)}%</span>
                </div>
                <Badge tone="danger">{item.risk_level}</Badge>
              </div>
            ))}
          </div>
        </DashboardChartCard>
      )}

      <section className="dashboard-data-section">
        <div className="section-title-row dashboard-price-filter-row">
          <div>
            <h2>預測清單</h2>
            <p>本次取得最多 500 筆預測樣本，點擊列表項可開啟詳情 Drawer。</p>
          </div>
          <DashboardFilterBar
            query={query}
            onQueryChange={setQuery}
            direction={predDirection}
            onDirectionChange={setPredDirection}
            directionOptions={DIRECTION_OPTIONS}
            risk={risk}
            onRiskChange={setRisk}
            riskOptions={RISK_OPTIONS}
            market={market}
            onMarketChange={setMarket}
            marketOptions={dashboard?.markets || []}
            onClear={() => {
              setQuery('');
              setPredDirection('');
              setRisk('');
              setMarket('');
            }}
          />
        </div>

        <ResponsiveDataTable
          columns={columns}
          rows={pageRows}
          rowKey={(row) => `${row.crop_name}-${row.market_name || 'all'}-${row.base_date}`}
          loading={loading && !dashboard}
          error={status === 'error' && !dashboard?.predictions?.length
            ? predictionsSource?.error || '預測 API 載入失敗。'
            : null}
          emptyTitle="沒有符合條件的預測資料"
          sort={sort}
          onSort={handleSort}
          page={page}
          pageSize={pageSize}
          total={filteredRows.length}
          onPageChange={setPage}
          onRowClick={openDetail}
          mobileCardRenderer={(row) => (
            <>
              <strong>{row.crop_name}</strong>
              <span>{row.market_name} · 方向：{row.pred_label_name}</span>
              <span>信心：{(row.pred_confidence * 100).toFixed(1)}% · 風險：{row.risk_level}</span>
              <span>基準日：{row.base_date}</span>
            </>
          )}
        />
      </section>

      <Drawer
        open={Boolean(selected)}
        onClose={closeDetail}
        title="預測詳情"
      >
        {selected && (
          <div className="prediction-detail-drawer">
            <p className="eyebrow">AI 方向預測</p>
            <h3>{selected.crop_name}</h3>
            <p>{selected.market_name} · 方向預測：<strong>{selected.pred_label_name}</strong></p>

            <div className="prediction-detail-main-value">
              <span>信心度：{(selected.pred_confidence * 100).toFixed(1)}%</span>
              <Badge tone={selected.risk_level === 'high' ? 'danger' : 'neutral'}>
                {selected.risk_level}
              </Badge>
            </div>

            <p>{selected.display_message}</p>

            <dl>
              <dt>模型種類</dt><dd>{selected.model_type || 'LightGBM'}</dd>
              <dt>模型版本</dt>
              <dd>
                {selected.payload_version
                  ? selected.payload_version
                  : <Badge tone="neutral">尚未接入模型版本欄位</Badge>}
              </dd>
              <dt>基準日期</dt><dd>{selected.base_date || '—'}</dd>
              <dt>最新交易日</dt><dd>{selected.global_latest_trade_date || '—'}</dd>
              <dt>資料新鮮度</dt><dd>{selected.data_staleness_days} 天</dd>
              {selected.risk_note && (
                <>
                  <dt>風險說明</dt><dd>{selected.risk_note}</dd>
                </>
              )}
            </dl>

            {drawerLoading && <p>正在載入預測詳情…</p>}
            {drawerDetail?.error && (
              <p className="price-detail-error">單筆預測：{drawerDetail.error}</p>
            )}

            <Link
              className="price-detail-link"
              to={`/product/${encodeURIComponent(selected.crop_name)}`}
            >
              前往公開商品詳情
            </Link>
          </div>
        )}
      </Drawer>
    </div>
  );
}
