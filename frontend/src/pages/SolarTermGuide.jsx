import { useApi } from '../hooks/useApi';
import SolarTermCard from '../components/SolarTermCard';
import './SolarTermGuide.css';

const seasonEmoji = { 春: '🌸', 夏: '☀️', 秋: '🍂', 冬: '❄️' };

export default function SolarTermGuide() {
  const today  = useApi('/api/solar-term');
  const all    = useApi('/api/solar-term/all');

  return (
    <div className="container stg-page">
      <h1 className="page-title">🌿 24 節氣指南</h1>

      {today.loading && <div className="spinner" />}
      {today.data && <SolarTermCard data={today.data} />}

      <h2 className="stg-sub-title">全年節氣一覽</h2>

      {all.loading && <div className="spinner" />}

      {all.data && (
        <div className="stg-grid">
          {all.data.map((term, i) => {
            const isCurrent = today.data?.term_name === term.term_name;
            const products  = String(term.common_products || '').split(';').filter(Boolean);
            return (
              <div
                key={i}
                className={`stg-card card ${isCurrent ? 'stg-current' : ''}`}
              >
                <div className="stg-card-header">
                  <span className="stg-card-emoji">
                    {seasonEmoji[term.season] || '🌿'}
                  </span>
                  <div>
                    <p className="stg-card-name">{term.term_name}</p>
                    <p className="stg-card-season">{term.season}季</p>
                  </div>
                  {isCurrent && <span className="badge badge-green stg-now">現在</span>}
                </div>
                <p className="stg-card-desc">{term.description}</p>
                {products.length > 0 && (
                  <div className="stg-tags">
                    {products.map(p => (
                      <span key={p} className="badge badge-green">{p}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
