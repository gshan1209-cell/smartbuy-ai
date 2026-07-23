import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CloudSun,
  Newspaper,
  Search,
  ShoppingBasket,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/shared/Card';
import EmptyState from '../components/shared/EmptyState';
import LoadingState from '../components/shared/LoadingState';
import { get } from '../hooks/useApi';
import { getConsumerAdvice } from '../lib/consumerAdvice';
import {
  loadConsumerHome,
  normalizeHomeItem,
  selectConsumerHomeItems,
} from '../lib/consumerHomeAdapter';
import './Home.css';

const statusIcons = {
  便宜: TrendingDown,
  正常: ShoppingBasket,
  偏貴: TrendingUp,
  資料不足: Search,
};

function HomeSearchForm({ markets, onSearch }) {
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    onSearch({ query, market });
  }

  return (
    <form className="consumer-search" onSubmit={handleSubmit}>
      <label htmlFor="home-search">搜尋蔬菜或水果</label>
      <div className="consumer-search-grid">
        <Search size={20} aria-hidden="true" />
        <input
          id="home-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="例如：高麗菜、番茄"
        />
        <select
          aria-label="選擇市場"
          value={market}
          onChange={(event) => setMarket(event.target.value)}
        >
          <option value="">全部市場</option>
          {markets.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <button type="submit">查今天菜價</button>
      </div>
    </form>
  );
}

function RecommendationCard({ item, onOpen }) {
  const advice = getConsumerAdvice(item.status, item.prediction_direction);
  const Icon = statusIcons[item.status] || Search;
  const statusClass = {
    便宜: 'home-recommendation--cheap',
    正常: 'home-recommendation--normal',
    偏貴: 'home-recommendation--expensive',
  }[item.status] || 'home-recommendation--unknown';

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  }

  return (
    <Card
      className={`recommendation-card ${statusClass}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      <div className="recommendation-top">
        <span className="status-icon"><Icon size={19} aria-hidden="true" /></span>
        <span className="status-label">{item.status}</span>
      </div>
      <h3>{item.product_name}</h3>
      <p className="recommendation-price">
        {item.today_price == null ? '—' : `${item.today_price} 元`}
        <small>／今日均價</small>
      </p>
      <strong>{advice.label}</strong>
      <p>{advice.text}</p>
      <small className="updated">更新：{item.updatedAt}</small>
    </Card>
  );
}

function QuickLinkCard({ icon: Icon, title, description, actionLabel, onClick }) {
  return (
    <Card className="home-quick-link-card">
      <div className="reminder-icon"><Icon size={20} aria-hidden="true" /></div>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <button className="consumer-link" onClick={onClick}>
        {actionLabel} <ArrowRight size={16} />
      </button>
    </Card>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [markets, setMarkets] = useState([]);
  const [items, setItems] = useState([]);
  const [solarTerm, setSolarTerm] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      get('/api/markets').catch(() => ({ markets: [] })),
      loadConsumerHome(get),
      get('/api/solar-term').catch(() => null),
    ])
      .then(([marketData, homeData, termData]) => {
        const normalized = homeData.items.map(normalizeHomeItem);
        setMarkets(marketData.markets || []);
        setItems(selectConsumerHomeItems(normalized));
        setSolarTerm(termData && !termData.error ? termData : null);
        setIsDemo(homeData.isDemo);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  function submitSearch({ query, market }) {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (market) params.set('market', market);
    const queryString = params.toString();
    navigate(queryString ? `/search?${queryString}` : '/search');
  }

  return (
    <div className="consumer-home">
      <section className="consumer-hero">
        <div className="consumer-hero-inner">
          <div>
            <p className="consumer-kicker">SmartBuy AI · 買菜小幫手</p>
            <h1>今天買什麼？</h1>
            <p className="consumer-lead">
              快速看看哪些菜比較划算，讓今天的採買更輕鬆。
            </p>
            {solarTerm && (
              <button
                type="button"
                className="solar-term-chip"
                onClick={() => navigate('/season')}
              >
                現在節氣：<strong>{solarTerm.term_name}</strong>
                {solarTerm.next_term_name && (
                  <span>
                    下一個是 {solarTerm.next_term_name}
                    {solarTerm.days_until_next != null
                      ? `，還有 ${solarTerm.days_until_next} 天`
                      : ''}
                  </span>
                )}
              </button>
            )}
          </div>
          <HomeSearchForm markets={markets} onSearch={submitSearch} />
        </div>
      </section>

      <main className="consumer-content">
        <section className="today-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Today&apos;s picks</p>
              <h2>今日採買建議</h2>
            </div>
            {isDemo && <span className="demo-note">示範資料</span>}
          </div>

          {loading && <LoadingState label="正在整理今天的菜價…" />}
          {error && (
            <EmptyState
              title="暫時無法取得菜價"
              description="你可以先到查價頁搜尋，稍後再回來看看。"
              action={(
                <button className="consumer-link" onClick={() => navigate('/search')}>
                  前往查價 <ArrowRight size={16} />
                </button>
              )}
            />
          )}
          {!loading && !error && !items.length && (
            <EmptyState
              title="今天還沒有推薦品項"
              description="搜尋想買的菜，查看目前價格。"
            />
          )}
          {!loading && !error && items.length > 0 && (
            <div className="recommendation-grid">
              {items.map((item) => (
                <RecommendationCard
                  key={item.product_name}
                  item={item}
                  onOpen={() => navigate(`/product/${encodeURIComponent(item.product_name)}`)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="home-quick-links" aria-label="其他服務">
          <QuickLinkCard
            icon={Bell}
            title="收藏與天氣提醒"
            description="登入後可收到收藏品項的價格變化與天氣風險提醒。"
            actionLabel="查看設定"
            onClick={() => navigate('/settings')}
          />
          <QuickLinkCard
            icon={CloudSun}
            title="節氣與當季推薦"
            description={solarTerm
              ? `目前是${solarTerm.term_name}，查看適合採買的當季食材。`
              : '查看現在節氣、當季食材與料理建議。'}
            actionLabel="查看節氣"
            onClick={() => navigate('/season')}
          />
          <QuickLinkCard
            icon={Newspaper}
            title="農產新知"
            description="掌握與日常採買有關的農產、食材與市場資訊。"
            actionLabel="逛逛新知"
            onClick={() => navigate('/news')}
          />
          <QuickLinkCard
            icon={Users}
            title="互助網"
            description="查看農產急售、求助與在地資訊分享。"
            actionLabel="前往互助網"
            onClick={() => navigate('/mutual-aid')}
          />
        </section>
      </main>
    </div>
  );
}
