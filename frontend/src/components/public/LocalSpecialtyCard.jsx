import { useNavigate } from 'react';
import { ArrowRight, Search, ShoppingBasket, TrendingDown, TrendingUp } from 'lucide-react';
import Card from '../shared/Card';
import SourceBadge from './SourceBadge';

const statusIcons = {
  便宜: TrendingDown,
  正常: ShoppingBasket,
  偏貴: TrendingUp,
  資料不足: Search,
};

export default function LocalSpecialtyCard({ item }) {
  const navigate = useNavigate();
  const Icon = statusIcons[item.status] || Search;

  const statusClass = {
    便宜: 'specialty-status--cheap',
    正常: 'specialty-status--normal',
    偏貴: 'specialty-status--expensive',
  }[item.status] || 'specialty-status--unknown';

  return (
    <Card className={`local-specialty-card ${statusClass}`}>
      <div className="specialty-card-header">
        <span className="specialty-name">{item.name}</span>
        <SourceBadge type={item.sourceType || 'Static Seed'} />
      </div>

      <p className="specialty-desc">{item.description || '在地優質農特產品，盛產期品質極佳。'}</p>

      <div className="specialty-price-info">
        <div className="price-tag">
          <Icon size={16} aria-hidden="true" />
          <span>{item.status}</span>
        </div>
        <strong className="today-price">
          {item.todayPrice == null ? '—' : `${item.todayPrice} 元`}
          <small>／均價</small>
        </strong>
      </div>

      <div className="specialty-card-footer">
        <span className="updated-text">交易日：{item.transDate || '—'}</span>
        <button
          type="button"
          className="consumer-link"
          onClick={() => navigate(`/search?q=${encodeURIComponent(item.name)}`)}
        >
          查菜價 <ArrowRight size={14} />
        </button>
      </div>
    </Card>
  );
}
