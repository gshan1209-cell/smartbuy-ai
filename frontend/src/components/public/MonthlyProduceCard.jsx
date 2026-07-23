import { useNavigate } from 'react';
import { ArrowRight, Leaf, Soup } from 'lucide-react';
import Card from '../shared/Card';
import SourceBadge from './SourceBadge';

export default function MonthlyProduceCard({ produceItem, cookingSuggestion }) {
  const navigate = useNavigate();

  return (
    <Card className="monthly-produce-card">
      <div className="produce-header">
        <div className="flex items-center gap-2">
          <Leaf className="text-emerald-600" size={20} aria-hidden="true" />
          <h3>{produceItem.name}</h3>
        </div>
        <div className="flex gap-1">
          <SourceBadge type="Official API" label="行情: 正式 API" />
          <SourceBadge type="Static Seed" label="推薦: Static Seed" />
        </div>
      </div>

      <div className="produce-status-row">
        <span className={`status-pill status-pill--${produceItem.status}`}>
          {produceItem.status}
        </span>
        <span className="price-value">
          今日均價：<strong>{produceItem.todayPrice == null ? '—' : `${produceItem.todayPrice} 元`}</strong>
        </span>
      </div>

      {cookingSuggestion && (
        <div className="cooking-hint">
          <Soup size={16} className="text-amber-600 shrink-0" aria-hidden="true" />
          <p>{cookingSuggestion}</p>
        </div>
      )}

      <div className="produce-footer">
        <span className="text-xs text-gray-500">更新時間：{produceItem.transDate || '—'}</span>
        <button
          type="button"
          className="consumer-link"
          onClick={() => navigate(`/product/${encodeURIComponent(produceItem.name)}`)}
        >
          查看詳細走勢 <ArrowRight size={15} />
        </button>
      </div>
    </Card>
  );
}
