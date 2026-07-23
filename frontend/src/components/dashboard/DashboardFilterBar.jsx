import { useState } from 'react';
import Drawer from '../shared/Drawer';

export default function DashboardFilterBar({ query, onQueryChange, status, onStatusChange, onClear }) {
  const [open, setOpen] = useState(false);
  const fields = <div className="dashboard-filter-fields"><label>關鍵字<input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜尋品項或市場" /></label><label>狀態<select value={status} onChange={(event) => onStatusChange(event.target.value)}><option value="">全部狀態</option><option value="high">高風險</option><option value="medium">中風險</option><option value="normal">一般</option></select></label><button onClick={onClear}>清除篩選</button></div>;
  return <><div className="dashboard-filter-bar"><div className="desktop-filter-fields">{fields}</div><button className="mobile-filter-trigger" onClick={() => setOpen(true)}>篩選</button></div><Drawer open={open} onClose={() => setOpen(false)} title="Dashboard 篩選">{fields}</Drawer></>;
}
