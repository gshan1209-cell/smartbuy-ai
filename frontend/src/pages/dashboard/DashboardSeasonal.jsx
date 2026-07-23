import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  FileCode,
  Info,
  Leaf,
  RefreshCw,
  Soup,
  Sun,
} from 'lucide-react';

import DashboardChartCard from '../../components/dashboard/DashboardChartCard';
import DashboardMetricCard from '../../components/dashboard/DashboardMetricCard';
import Badge from '../../components/shared/Badge';
import EmptyState from '../../components/shared/EmptyState';
import { loadDashboardSeasonal } from '../../lib/dashboardSeasonalAdapter';

import '../../styles/dashboard-overview.css';
import '../../styles/dashboard-seasonal.css';

const SEASON_BY_TERM = {
  立春: '春季', 雨水: '春季', 驚蟄: '春季', 春分: '春季', 清明: '春季', 穀雨: '春季',
  立夏: '夏季', 小滿: '夏季', 芒種: '夏季', 夏至: '夏季', 小暑: '夏季', 大暑: '夏季',
  立秋: '秋季', 處暑: '秋季', 白露: '秋季', 秋分: '秋季', 寒露: '秋季', 霜降: '秋季',
  立冬: '冬季', 小雪: '冬季', 大雪: '冬季', 冬至: '冬季', 小寒: '冬季', 大寒: '冬季',
};

function formatNumber(value, suffix = '') {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toLocaleString('zh-TW')}${suffix}`;
}

export default function DashboardSeasonal() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const data = await loadDashboardSeasonal(dashboard);
      setDashboard(data);
    } catch (err) {
      setError(err?.message || '節氣推薦資料載入失敗。');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dashboard]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchedAt = dashboard?.fetchedAt
    ? new Date(dashboard.fetchedAt).toLocaleString('zh-TW')
    : '尚未取得';

  const term = dashboard?.term;
  const seed = dashboard?.seed;
  const matchedRecommendations = dashboard?.matchedRecommendations || [];

  const matchedCount = matchedRecommendations.filter((item) => item.matched).length;
  const totalCount = matchedRecommendations.length;

  const seasonName = SEASON_BY_TERM[term?.term_name] || '當季';

  const metrics = [
    {
      label: '當前節氣',
      value: term?.term_name || '—',
      icon: Sun,
      status: dashboard?.sources?.solarTerm?.status || 'ready',
      source: '/api/solar-term',
      description: '天文計算即時節氣名稱 (正式 API)',
    },
    {
      label: '下個節氣',
      value: term?.next_term_name || '—',
      icon: CalendarDays,
      status: dashboard?.sources?.solarTerm?.status || 'ready',
      source: '/api/solar-term',
      description: term?.days_until_next != null ? `還有 ${term.days_until_next} 天` : '倒數天數',
    },
    {
      label: '推薦品項筆數',
      value: totalCount,
      icon: Leaf,
      status: 'ready',
      source: 'Static Seed',
      description: '當前節氣知識推薦農產品數',
    },
    {
      label: '行情比對涵蓋數',
      value: `${matchedCount} / ${totalCount}`,
      icon: CheckCircle2,
      status: dashboard?.sources?.products?.status || 'ready',
      source: '/api/products',
      description: '成功比對正式 API 行情之品項',
    },
  ];

  if (loading && !dashboard) {
    return <div className="dashboard-loading">正在載入節氣推薦資料…</div>;
  }

  if (error && !dashboard) {
    return (
      <EmptyState
        title="節氣推薦資料載入失敗"
        description={error}
        action={<button type="button" onClick={() => load()}>重新載入</button>}
      />
    );
  }

  return (
    <div className="dashboard-overview dashboard-seasonal-page">
      <header className="dashboard-overview-heading">
        <div>
          <p className="eyebrow">Seasonal Recommendation Management</p>
          <h1>節氣推薦後台</h1>
          <p>結合正式天文節氣 API 與當季推薦清單，即時比對市場行情價格。</p>
        </div>
        <div className="overview-actions">
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

      <div className="seasonal-hero-card">
        <div className="seasonal-hero-info">
          <h2>當前節氣：{term?.term_name || '當季蔬果'}</h2>
          <p>
            {seasonName} · 下一個節氣：{term?.next_term_name || '未知'}
            {term?.days_until_next != null ? `（還有 ${term.days_until_next} 天）` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge tone="success">正式 API (solar-term)</Badge>
          <Badge tone="neutral">Static Seed 推薦</Badge>
        </div>
      </div>

      <section className="dashboard-metric-grid">
        {metrics.map((metric) => (
          <DashboardMetricCard
            key={metric.label}
            {...metric}
            updatedAt={fetchedAt}
          />
        ))}
      </section>

      <DashboardChartCard
        title="當季推薦品項與即時行情比對"
        description="將節氣推薦知識與正式 /api/products 行情比對價格狀態。"
        source="Static Seed + 正式 API"
        updatedAt={fetchedAt}
      >
        <div className="seasonal-recommendations-grid">
          {matchedRecommendations.map((item) => (
            <div key={item.name} className="seasonal-item-card">
              <div className="seasonal-item-header">
                <strong>{item.name}</strong>
                <Badge
                  tone={
                    item.status === '便宜'
                      ? 'success'
                      : item.status === '偏貴'
                        ? 'danger'
                        : 'neutral'
                  }
                >
                  {item.status}
                </Badge>
              </div>

              <div className="seasonal-item-body">
                <div>今日價格：<strong>{formatNumber(item.todayPrice, ' 元')}</strong></div>
                <div>近期平均：<span>{formatNumber(item.recentAverage, ' 元')}</span></div>
                <div>採買建議：<span>{item.suggestion}</span></div>
                <div>交易日期：<span>{item.transDate}</span></div>
              </div>

              <small className="text-gray-400 text-xs">
                {item.matched ? '已成功比對正式行情' : '未在行情 API 找到該品項'}
              </small>
            </div>
          ))}
        </div>
      </DashboardChartCard>

      <div className="seasonal-info-section">
        <DashboardChartCard
          title="節氣料理與健康建議"
          description="依據當前節氣知識提供飲食調整建議。"
          source="Static Seed"
          updatedAt={fetchedAt}
        >
          <div className="grid gap-3">
            {seed?.cookingSuggestions?.map((sug) => (
              <div key={sug} className="flex items-start gap-2 text-sm">
                <Soup size={18} className="shrink-0 text-amber-600" />
                <span>{sug}</span>
              </div>
            ))}
            <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border">
              <strong>節氣小知識：</strong>
              <p className="mt-1">{seed?.knowledge}</p>
            </div>
          </div>
        </DashboardChartCard>

        <DashboardChartCard
          title="節氣規則管理 (Placeholder)"
          description="未來節氣與農產品推薦規則管理功能。"
          source="Dashboard Roadmap"
          updatedAt={fetchedAt}
        >
          <div className="seasonal-placeholder-box">
            <div className="flex items-center gap-2 text-amber-700">
              <FileCode size={20} />
              <strong>規則管理 API 尚未接入</strong>
            </div>
            <p>
              目前的節氣推薦資料來自 Static Seed (
              <code>seasonalRecommendations.js</code>
              )。
            </p>
            <p>未來將擴充後端 CRUD API，支援農民與管理員線上新增、編輯與自訂節氣推薦品項與注意事項。</p>
          </div>
        </DashboardChartCard>
      </div>
    </div>
  );
}
