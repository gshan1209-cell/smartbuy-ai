import { useApi } from '../hooks/useApi';
import SolarTermCard from '../components/SolarTermCard';
import AlertCard from '../components/AlertCard';
import PriceCard from '../components/PriceCard';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const { data, loading, error } = useApi('/api/home');
  const navigate = useNavigate();

  if (loading) return <div className="spinner" />;
  if (error)   return <p className="empty">⚠ 無法連線到後端，請先啟動 FastAPI 伺服器。</p>;

  const { solar_term, typhoon, weather_alerts = [], recommendations = [] } = data;

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#E8F5EE] via-[#FFF8F0] to-[#FEF3C7] py-16 text-center border-b border-[var(--border)]">
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="inline-block bg-[#52B788]/15 text-[var(--green-dark)] text-xs font-semibold px-4 py-1 rounded-full mb-5 tracking-wide">
            🌱 農業科技 × 即時行情
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--green-dark)] leading-tight mb-4">
            今天，讓數據<br />幫你買到好價錢
          </h1>
          <p className="text-base text-[var(--text-muted)] max-w-md mx-auto leading-relaxed mb-8">
            整合 24 節氣、產地天氣、市場行情，給你最即時的採買建議
          </p>
          <div className="flex justify-center gap-10 mb-8">
            {[['24','節氣追蹤'],['即時','產地天氣'],['AI','採買建議']].map(([strong, label]) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <strong className="text-2xl font-extrabold text-[var(--orange-dark)]">{strong}</strong>
                <span className="text-xs text-[var(--text-muted)]">{label}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-3">
            <Button onClick={() => navigate('/search')}>搜尋菜價 →</Button>
            <Button variant="secondary" onClick={() => navigate('/solar-term')}>今日節氣</Button>
          </div>
        </div>
      </section>

      <div className="max-w-[1100px] mx-auto px-6 py-9 pb-16">
        <SolarTermCard data={solar_term} />

        {typhoon?.active && (
          <AlertCard title="颱風提醒" message={typhoon.message} riskLevel="很高" />
        )}

        {weather_alerts.map((w, i) => (
          <AlertCard key={i} title={`${w.product_name}｜產地天氣`} message={w.message} riskLevel={w.risk_level} />
        ))}

        <section className="mt-8">
          <h2 className="text-xl font-bold text-[var(--green-dark)] mb-4 pb-2.5 border-b-2 border-[var(--cream-dark)]">
            今日採買參考
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {recommendations.map((item, i) => (
              <PriceCard
                key={i}
                item={item}
                onClick={() => navigate(`/search?q=${item.product_name}`)}
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-[var(--text-muted)] text-center">
            點擊卡片或前往「搜尋菜價」查看更多品項
          </p>
        </section>
      </div>
    </div>
  );
}
