import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CloudOff,
  CloudSun,
  Database,
  FileCode,
  Info,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

import DashboardChartCard from '../../components/dashboard/DashboardChartCard';
import DashboardMetricCard from '../../components/dashboard/DashboardMetricCard';
import Badge from '../../components/shared/Badge';
import EmptyState from '../../components/shared/EmptyState';
import { get } from '../../hooks/useApi';

import '../../styles/dashboard-overview.css';
import '../../styles/dashboard-weather.css';

export default function DashboardWeather() {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const data = await get('/api/admin/weather/status');
      setStatusData(data);
    } catch (err) {
      setError(err?.message || '天氣狀態 Endpoint 載入失敗。');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fetchedAt = new Date().toLocaleString('zh-TW');

  const metrics = [
    {
      label: '天氣資料來源',
      value: statusData?.provider || '尚未接入',
      icon: CloudSun,
      status: 'unavailable',
      source: '/api/admin/weather/status',
      description: '中央氣象署 (CWA) 資料來源',
    },
    {
      label: '縣市預報功能',
      value: statusData?.capabilities?.countyForecast ? '已啟用' : '未啟用',
      icon: Database,
      status: 'unavailable',
      source: '/api/admin/weather/status',
      description: '縣市級每日與短期氣象預報',
    },
    {
      label: '農業警報功能',
      value: statusData?.capabilities?.weatherAlerts ? '已啟用' : '未啟用',
      icon: ShieldAlert,
      status: 'unavailable',
      source: '/api/admin/weather/status',
      description: '颱風、豪雨、低溫特報等警報',
    },
    {
      label: '作物風險規則',
      value: statusData?.capabilities?.cropRiskRules ? '已啟用' : '未啟用',
      icon: FileCode,
      status: 'unavailable',
      source: '/api/admin/weather/status',
      description: '氣象對作物行情風險推算引擎',
    },
  ];

  if (loading && !statusData) {
    return <div className="dashboard-loading">正在檢查天氣資料來源狀態…</div>;
  }

  if (error && !statusData) {
    return (
      <EmptyState
        title="天氣狀態檢查失敗"
        description={error}
        action={<button type="button" onClick={() => load()}>重新檢查</button>}
      />
    );
  }

  return (
    <div className="dashboard-overview dashboard-weather-page">
      <header className="dashboard-overview-heading">
        <div>
          <p className="eyebrow">Weather Risk Management · Status Page</p>
          <h1>天氣風險後台</h1>
          <p>天氣資料來源狀態與整合準備頁，本系統嚴格使用真實氣象來源，不使用假資料。</p>
        </div>
        <div className="overview-actions">
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
          >
            <RefreshCw size={17} className={refreshing ? 'spin' : ''} />
            {refreshing ? '檢查中…' : '重新檢查狀態'}
          </button>
        </div>
      </header>

      <section className="dashboard-metric-grid">
        {metrics.map((metric) => (
          <DashboardMetricCard
            key={metric.label}
            {...metric}
            updatedAt={fetchedAt}
          />
        ))}
      </section>

      <div className="weather-status-card">
        <div className="weather-status-header">
          <div className="flex items-center gap-2">
            <CloudOff size={24} color="#0369a1" />
            <h2>產地天氣風險模組整合狀態</h2>
          </div>
          <Badge tone="neutral">Unavailable (尚未接入)</Badge>
        </div>
        <p className="weather-status-reason">
          <strong>檢查結果：</strong>
          {statusData?.reason || '尚未接入正式中央氣象署資料來源。'}
        </p>
        <small className="text-gray-500">最後檢查時間：{fetchedAt}</small>
      </div>

      <div className="dashboard-two-columns">
        <DashboardChartCard
          title="目前不可用功能清單"
          description="正式 API 接入前，以下功能暫不開放使用。"
          source="/api/admin/weather/status"
          updatedAt={fetchedAt}
        >
          <div className="weather-capabilities-grid">
            <div className="weather-capability-item">
              <h4>縣市氣象預報</h4>
              <p>缺乏氣象署開放資料 API 介接與快取機制。</p>
              <Badge tone="neutral">Unavailable</Badge>
            </div>
            <div className="weather-capability-item">
              <h4>即時災害警報</h4>
              <p>無即時特報推播與豪雨特報警示串接。</p>
              <Badge tone="neutral">Unavailable</Badge>
            </div>
            <div className="weather-capability-item">
              <h4>產地風災風險推估</h4>
              <p>無產地與批發市場映射矩陣資料庫。</p>
              <Badge tone="neutral">Unavailable</Badge>
            </div>
          </div>
        </DashboardChartCard>

        <DashboardChartCard
          title="正式串接前置條件與下一步"
          description="後續開放天氣風險功能需完成之基礎建設。"
          source="SmartBuy AI Roadmap"
          updatedAt={fetchedAt}
        >
          <ul className="weather-requirements-list">
            <li>
              <Info size={18} className="shrink-0 text-blue-600" />
              <span>1. 申請並設定中央氣象署 (CWA) 官方開放資料 API Key。</span>
            </li>
            <li>
              <Info size={18} className="shrink-0 text-blue-600" />
              <span>2. 建立主要農產產地 (縣市/鄉鎮) 與批發市場地理映射對照表。</span>
            </li>
            <li>
              <Info size={18} className="shrink-0 text-blue-600" />
              <span>3. 開發背景排程定時抓取每日氣象預報並快取至 Supabase 資料庫。</span>
            </li>
            <li>
              <Info size={18} className="shrink-0 text-blue-600" />
              <span>4. 建立葉菜類、根莖類等不同作物對暴雨/高溫之風險影響演算法 Engine。</span>
            </li>
          </ul>
        </DashboardChartCard>
      </div>
    </div>
  );
}
