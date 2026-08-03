import { useNavigate } from 'react-router-dom';
import { ArrowRight, Leaf } from 'lucide-react';
import Card from '../shared/Card';
import SourceBadge from './SourceBadge';

const produceIcons = {
  高麗菜: '🥬', 甘藍: '🥬',
  番茄: '🍅', 小番茄: '🍅',
  青蔥: '🌿', 蕹菜: '🌿', 芥菜: '🥬', 菠菜: '🥬', 小白菜: '🥬', 萵苣菜: '🥬', 芥藍菜: '🥦', 包心白: '🥬', 甘薯葉: '🌿', 韭菜: '🌿', 芹菜: '🌿', 九層塔: '🌿', 莧菜: '🌿', 紅鳳菜: '🌿',
  竹筍: '🎋', 茭白筍: '🎋', 蘆筍: '🎋',
  蘿蔔: '🥕', 胡蘿蔔: '🥕',
  玉米: '🌽',
  香蕉: '🍌',
  芒果: '🥭',
  西瓜: '🍉',
  鳳梨: '🍍',
  草莓: '🍓',
  香菇: '🍄', 杏鮑菇: '🍄', 秀珍菇: '🍄', 金絲菇: '🍄', 鴻喜菇: '🍄', 柳松菇: '🍄',
  稻米: '🌾',
  苦瓜: '🫑', 甜椒: '🫑', 辣椒: '🌶',
  絲瓜: '🥒', 胡瓜: '🥒', 越瓜: '🥒', 扁蒲: '🥒', 隼人瓜: '🥒',
  南瓜: '🎃',
  龍眼: '🍇', 荔枝: '🍇', 葡萄: '🍇',
  柿子: '🍊', 雜柑: '🍊', 橄欖: '🫒',
  蘋果: '🍎',
  梨: '🍐',
  桃子: '🍑', 李: '🍑',
  火龍果: '🐉', 紅龍果: '🐉',
  木瓜: '🍈', 番石榴: '🍈', 楊桃: '🍈', 洋香瓜: '🍈', 甜瓜: '🍈', 蓮霧: '🍈',
  奇異果: '🥝',
  藍莓: '🫐',
  酪梨: '🥑',
  椰子: '🥥',
  甜橙: '🍊',
  蓮藕: '🪷', 蓮蓬: '🪷',
  芋: '🫙', 甘薯: '🍠', 馬鈴薯: '🥔',
  大蒜: '🧄', 洋蔥: '🧅',
  薑: '🫚',
  菱角: '🌰',
  冬瓜: '🫒',
  敏豆: '🫘', 菜豆: '🫘', 毛豆: '🫘', 豌豆: '🫘',
};

export default function MonthlyProduceCard({ produceItem, cookingSuggestion }) {
  const navigate = useNavigate();
  const priceLabel = produceItem.priceSourceType === 'Official API'
    ? '行情：正式 API'
    : produceItem.priceSourceStatus === 'error'
      ? '行情：載入失敗'
      : '行情：資料不足';

  return (
    <Card className="monthly-produce-card">
      <div
        className="produce-visual"
        data-category={produceItem.category || 'other'}
        aria-hidden="true"
      >
        <span>{produceIcons[produceItem.name] || '🌱'}</span>
      </div>
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
