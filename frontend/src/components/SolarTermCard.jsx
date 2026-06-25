import { Badge } from './ui/badge';
import { Card } from './ui/card';

const seasonEmoji = { 春: '🌸', 夏: '☀️', 秋: '🍂', 冬: '❄️' };

export default function SolarTermCard({ data }) {
  if (!data) return null;
  const emoji = seasonEmoji[data.season] || '🌿';
  return (
    <Card className="mb-4">
      <div className="flex items-center gap-4 mb-3">
        <span className="text-4xl">{emoji}</span>
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-0.5">現在節氣</p>
          <h2 className="text-xl font-bold text-[var(--green-dark)]">{data.term_name}</h2>
          <Badge variant="green" className="mt-1">{data.season}季</Badge>
        </div>
      </div>

      <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-3">{data.description}</p>

      <div className="space-y-1.5">
        {data.shopping_tip && (
          <div className="flex items-start gap-2 text-sm">
            <span>🛒</span><span>{data.shopping_tip}</span>
          </div>
        )}
        {data.health_tip && (
          <div className="flex items-start gap-2 text-sm">
            <span>💚</span><span>{data.health_tip}</span>
          </div>
        )}
        {data.risk_note && (
          <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            <span>⚠️</span><span>{data.risk_note}</span>
          </div>
        )}
      </div>

      {data.recommended_products?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)] mb-2">本節氣推薦食材</p>
          <div className="flex flex-wrap gap-1.5">
            {data.recommended_products.map(p => (
              <Badge key={p} variant="green">{p}</Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
