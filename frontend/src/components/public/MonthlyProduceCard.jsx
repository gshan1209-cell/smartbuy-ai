import { useNavigate } from 'react-router-dom';
import { ArrowRight, Leaf, MapPin } from 'lucide-react';
import Card from '../shared/Card';
import SourceBadge from './SourceBadge';


export default function MonthlyProduceCard({ produceItem, cookingSuggestion }) {
  const navigate = useNavigate();
  const priceLabel = produceItem.priceSourceType === 'Official API'
    ? '行情：正式 API'
    : produceItem.priceSourceStatus === 'error'
      ? '行情：載入失敗'
      : '行情：資料不足';

  return (
    <Card className="monthly-produce-card">
      <div className="produce-header">
        <div className="flex items-center gap-2">
          <Leaf className="text-emerald-600" size={20} aria-hidden="true" />
          <h3>{produceItem.name}</h3>
        </div>
        <div className="specialty-source-badges">
          <SourceBadge
            type={produceItem.priceSourceType || 'Unavailable'}
            label={priceLabel}
          />
          <SourceBadge
            type={produceItem.recommendationSourceType || 'Static Seed'}
          />
        </div>
      </div>

      {produceItem.market_name && (
        <div className="produce-market-row">
          <MapPin size={13} aria-hidden="true" />
          <span>{produceItem.market_name}</span>
        </div>
      )}

      <div className="produce-status-row">
        {produceItem.status && produceItem.status !== '資料不足' && (
          <span className={`status-pill status-pill--${produceItem.status}`}>
            {produceItem.status}
          </span>
        )}
        <span className="price-value">
          今日均價：
          <strong>
            {produceItem.todayPrice == null ? '—' : `${produceItem.todayPrice} 元`}
          </strong>
        </span>
      </div>

      <div className="produce-footer">
        <button
          type="button"
          className="consumer-link"
          onClick={() => {
            const market = produceItem.market_name;
            const qs = market ? `?market=${encodeURIComponent(market)}` : '';
            navigate(`/product/${encodeURIComponent(produceItem.name)}${qs}`);
          }}
        >
          查看詳細走勢 <ArrowRight size={15} />
        </button>
      </div>
    </Card>
  );
}
