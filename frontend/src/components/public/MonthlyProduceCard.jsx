import { useNavigate } from 'react-router-dom';
import { ArrowRight, Leaf, Soup } from 'lucide-react';
import Card from '../shared/Card';
import SourceBadge from './SourceBadge';

const produceIcons = { 高麗菜: '🥬', 番茄: '🍅', 青蔥: '🌿', 竹筍: '🎋', 蘿蔔: '🥕', 玉米: '🌽', 香蕉: '🍌', 芒果: '🥭', 西瓜: '🍉', 鳳梨: '🍍', 草莓: '🍓', 香菇: '🍄', 稻米: '🌾' };

export default function MonthlyProduceCard({ produceItem, cookingSuggestion }) {
  const navigate = useNavigate();
  const priceLabel = produceItem.priceSourceStatus === 'stale'
    ? '行情：上次資料'
    : produceItem.priceSourceType === 'Official API'
      ? '行情：正式 API'
      : produceItem.priceSourceStatus === 'error'
        ? '行情：載入失敗'
        : '行情：資料不足';

  return (
    <Card className="monthly-produce-card">
      <div className="produce-visual" aria-hidden="true"><span>{produceIcons[produceItem.name] || '🌱'}</span></div>
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
            label="推薦：Static Seed"
          />
        </div>
      </div>

      <div className="produce-status-row">
        <span className={`status-pill status-pill--${produceItem.status}`}>
          {produceItem.status}
        </span>
        <span className="price-value">
          今日均價：
          <strong>
            {produceItem.todayPrice == null ? '—' : `${produceItem.todayPrice} 元`}
          </strong>
        </span>
      </div>

      {cookingSuggestion && (
        <div className="cooking-hint">
          <Soup size={16} className="text-amber-600 shrink-0" aria-hidden="true" />
          <p>{cookingSuggestion}</p>
        </div>
      )}

      <div className="produce-footer">
        <span className="text-xs text-gray-500">交易日：{produceItem.transDate || '—'}</span>
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
