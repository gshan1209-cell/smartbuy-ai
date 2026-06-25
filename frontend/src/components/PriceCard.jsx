import { Badge } from './ui/badge';
import { Card } from './ui/card';

const badgeVariantMap = {
  '便宜':    'green',
  '正常':    'gray',
  '偏貴':    'orange',
  '資料不足': 'gray',
};

const recVariantMap = {
  '推薦購買':   'green',
  '可少量購買': 'orange',
  '改買替代品': 'red',
  '建議觀望':   'red',
  '資料不足':   'gray',
};

export default function PriceCard({ item, onClick }) {
  const priceStatus = item.price_status || item.status;
  const rec         = item.recommendation;

  return (
    <Card
      onClick={onClick}
      className={onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-[var(--green-dark)] text-base">{item.product_name}</span>
        <Badge variant={badgeVariantMap[priceStatus] || 'gray'}>{priceStatus}</Badge>
      </div>

      <div className="mb-2">
        {item.today_price != null ? (
          <>
            <span className="text-2xl font-extrabold text-[var(--orange-dark)]">${item.today_price}</span>
            <span className="text-sm text-[var(--text-muted)] ml-1">元/公斤</span>
          </>
        ) : (
          <span className="text-sm text-[var(--text-muted)]">暫無報價</span>
        )}
      </div>

      {item.advice && (
        <p className="text-sm text-[var(--text-muted)] mb-2 leading-relaxed">{item.advice}</p>
      )}

      {rec && (
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <Badge variant={recVariantMap[rec] || 'gray'}>{rec}</Badge>
          {item.weather_risk && item.weather_risk !== '資料不足' && (
            <span className="text-xs text-[var(--text-muted)]">☁ 產地天氣：{item.weather_risk}</span>
          )}
        </div>
      )}

      {item.alternatives?.length > 0 && (
        <p className="text-xs text-[var(--text-muted)] mt-2">替代品：{item.alternatives.join('、')}</p>
      )}
    </Card>
  );
}
