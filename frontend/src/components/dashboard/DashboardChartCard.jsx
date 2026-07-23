import Card from '../shared/Card';
import LoadingState from '../shared/LoadingState';
import EmptyState from '../shared/EmptyState';

export default function DashboardChartCard({ title, description, source, updatedAt, loading, error, empty, children }) {
  return <Card className="dashboard-chart-card"><header><div><h2>{title}</h2><p>{description}</p></div><BadgeLabel>{source}</BadgeLabel></header>{loading ? <LoadingState label="正在整理圖表資料…" /> : error ? <EmptyState title="資料載入失敗" description={error} /> : empty ? <EmptyState title="目前沒有圖表資料" description="資料來源回傳空資料。" /> : <div className="chart-container">{children}</div>}<small className="chart-meta">資料時間：{updatedAt || '未提供'}</small></Card>;
}

function BadgeLabel({ children }) { return <span className="dashboard-source-label">{children || '資料來源未提供'}</span>; }
