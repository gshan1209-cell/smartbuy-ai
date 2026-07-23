import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Search,
  ShoppingBasket,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import Card from '../shared/Card';
import SourceBadge from './SourceBadge';

const statusIcons = {
  便宜: TrendingDown,
  正常: ShoppingBasket,
  偏貴: TrendingUp,
  資料不足: Search,
  載入失敗: Search,
};

const produceIcons = {
  高麗菜: '🥬', 番茄: '🍅', 青蔥: '🌿', 竹筍: '🎋', 蘿蔔: '🥕', 胡蘿蔔: '🥕',
  玉米: '🌽', 香蕉: '🍌', 芒果: '🥭', 西瓜: '🍉', 鳳梨: '🍍', 草莓: '🍓',
  香菇: '🍄', 茶: '🍵', 稻米: '🌾',
};

export default function LocalSpecialtyCard({ item }) {
  const navigate = useNavigate();
  const Icon = statusIcons[item.status] || Search;
  const produceIcon = produceIcons[item.name] || '🌱';
  const statusClass = {
    便宜: 'specialty-status--cheap',
    正常: 'specialty-status--normal',
    偏貴: 'specialty-status--expensive',
  }[item.status] || 'specialty-status--unknown';
  const priceSourceLabel = item.priceSourceStatus === 'stale'
    ? '行情：上次資料'
    : item.priceSourceType === 'Official API'
      ? '行情：正式 API'
      : '行情：尚無資料';

  return (
    <Card className={`local-specialty-card ${statusClass}`}>
      <div className="produce-visual" aria-hidden="true"><span>{produceIcon}</span></div>
      <div className="specialty-card-header">
        <span className="specialty-name">{item.name}</span>
        <div className="specialty-source-badges">
          <SourceBadge
            type={item.metadataSourceType || 'Unavailable'}
            label={item.metadataSourceType === 'Demo' ? '特色：示範' : '特色：尚未接入'}
          />
          <SourceBadge
            type={item.priceSourceType || 'Unavailable'}
            label={priceSourceLabel}
          />
        </div>
      </div>

      <p className="specialty-desc">
        {item.description || '正式縣市農產資料尚未接入。'}
      </p>

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
