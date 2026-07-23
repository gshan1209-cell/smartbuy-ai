import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CloudSun, Leaf, RefreshCw, Soup, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/shared/Card';
import EmptyState from '../components/shared/EmptyState';
import LoadingState from '../components/shared/LoadingState';
import { get } from '../hooks/useApi';
import { seasonalRecommendations } from '../data/seasonalRecommendations';
import './ConsumerPages.css';

export default function Season() {
  const navigate = useNavigate(); const [term, setTerm] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  useEffect(() => { get('/api/solar-term').then(setTerm).catch(() => setError(true)).finally(() => setLoading(false)); }, []);
  const seed = useMemo(() => seasonalRecommendations.default, []); const seasonName = term?.season || '當季';
  return <main className="consumer-page"><div className="consumer-page-inner"><header className="consumer-page-heading"><div><p className="eyebrow">Seasonal Guide</p><h1>節氣與當季推薦</h1><p>用白話了解現在的節氣，挑選適合當季的食材。</p></div></header>{loading && <LoadingState label="正在讀取目前節氣…" />}{error && <EmptyState title="節氣資料暫時無法取得" description="正式節氣 API 沒有回應，請稍後再試。" action={<button className="consumer-link" onClick={() => window.location.reload()}><RefreshCw size={16} />重新載入</button>} />}{!loading && !error && <><section className="season-hero"><Sun size={34} /><div><span>現在的節氣</span><h2>{term?.term_name || seed.solarTerm}</h2><p>{seasonName}季 · 下一個節氣：{term?.next_term_name || '資料未提供'} {term?.days_until_next != null ? `· 還有 ${term.days_until_next} 天` : ''}</p></div></section><div className="season-grid"><Card><Leaf className="season-card-icon" /><h2>適合買什麼</h2><p>這些是一般節氣知識推薦，實際價格請先查看今天菜價。</p><div className="season-tags">{seed.recommendedProducts.map((item) => <button key={item} onClick={() => navigate(`/search?q=${encodeURIComponent(item)}`)}>{item}<ArrowRight size={15} /></button>)}</div></Card><Card><CloudSun className="season-card-icon" /><h2>天氣影響提醒</h2><p>{seed.weatherRiskProducts.join('、')}可能受季節天氣影響，這裡是一般風險知識，尚未接入即時天氣 API。</p></Card><Card><Soup className="season-card-icon" /><h2>節氣料理建議</h2>{seed.cookingSuggestions.map((item) => <p key={item}>{item}</p>)}</Card><Card><h2>節氣小知識</h2><p>{seed.knowledge}</p><small>{seed.sourceNote}</small></Card></div><button className="season-price-cta" onClick={() => navigate('/search')}>查看今天菜價 <ArrowRight size={18} /></button></>}</div></main>;
}
