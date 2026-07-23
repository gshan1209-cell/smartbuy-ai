import Card from '../shared/Card';
import Badge from '../shared/Badge';

export default function DashboardMetricCard({ label, value, icon: Icon, tone = 'neutral', status = 'ready', source, updatedAt, description }) {
  const stateText = { ready: '正常', empty: '空資料', error: '載入失敗', stale: '沿用上次資料', unavailable: '尚未接入管理 API' }[status] || status;
  return <Card className={`dashboard-metric-card tone-${tone}`}><div className="metric-card-head"><span>{Icon && <Icon size={18} aria-hidden="true" />}{label}</span><Badge tone={status === 'ready' ? tone : 'neutral'}>{stateText}</Badge></div><strong className="metric-value">{status === 'unavailable' ? '—' : status === 'error' ? '無法取得' : value ?? '—'}</strong><p>{description || (status === 'unavailable' ? '尚未接入管理 API' : '目前沒有補充說明')}</p><small>來源：{source || 'Dashboard API'} · {updatedAt || '檢查時間未提供'}</small></Card>;
}
