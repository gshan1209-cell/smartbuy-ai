import { useState } from 'react';
import Badge from '../../components/shared/Badge';
import Card from '../../components/shared/Card';
import EmptyState from '../../components/shared/EmptyState';
import LoadingState from '../../components/shared/LoadingState';
import { dashboardMock } from '../../data/dashboardMock';

export default function DashboardOverview() {
  const [state, setState] = useState('ready');
  return <div>
    <div className="page-heading"><div><p className="eyebrow">Dashboard Overview</p><h1>營運總覽</h1><p>目前為 Demo 顯示，尚未接入管理 API。</p></div><Badge tone="warning">Demo／Mock</Badge></div>
    <div className="demo-controls" aria-label="Demo 狀態測試"><button onClick={() => setState('ready')}>資料</button><button onClick={() => setState('loading')}>載入中</button><button onClick={() => setState('empty')}>空狀態</button><button onClick={() => setState('error')}>錯誤</button></div>
    {state === 'loading' && <LoadingState label="正在載入營運資料…" />}
    {state === 'empty' && <EmptyState title="目前沒有營運資料" description="資料同步後會顯示於此。" />}
    {state === 'error' && <EmptyState title="無法載入營運資料" description="Demo 狀態：管理 API 尚未接入。" />}
    {state === 'ready' && <div className="metric-grid">{dashboardMock.metrics.map(([label, value]) => <Card className="metric-card" key={label}><Badge tone="neutral">Demo</Badge><h2>{value}</h2><strong>{label}</strong><small>資料日期：今日</small></Card>)}</div>}
  </div>;
}
