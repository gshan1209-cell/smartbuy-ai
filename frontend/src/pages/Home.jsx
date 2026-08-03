import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CloudSun,
  MapPin,
  Newspaper,
  Search,
  Sparkles,
  ShoppingBasket,
  Store,
  Tag,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/shared/Card';
import EmptyState from '../components/shared/EmptyState';
import LoadingState from '../components/shared/LoadingState';
import { get, getCached } from '../hooks/useApi';
import { getConsumerAdvice } from '../lib/consumerAdvice';
import {
  loadConsumerHome,
  normalizeHomeItem,
  selectConsumerHomeItems,
} from '../lib/consumerHomeAdapter';
import HomeAgricultureExplorer from '../components/public/HomeAgricultureExplorer';
import './Home.css';


const statusIcons = {
  便宜: TrendingDown,
  正常: ShoppingBasket,
  偏貴: TrendingUp,
  資料不足: Search,
};

const LIVE_DATA_REFRESH_MS = 15 * 60 * 1000;

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
          placeholder="例如：甘藍"
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
      {item.market_name && (
        <span className="recommendation-market">
          <MapPin size={11} aria-hidden="true" />
          {item.market_name}
        </span>
      )}
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
  const [selectedMarket, setSelectedMarket] = useState('');
  const [items, setItems] = useState([]);
  const [solarTerm, setSolarTerm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const refreshMarkets = () => get('/api/markets')
      .then((marketData) => {
        if (active) setMarkets(marketData.markets || []);
      })
      .catch(() => {
        if (active) setMarkets([]);
      });

    refreshMarkets();
    const intervalId = window.setInterval(refreshMarkets, LIVE_DATA_REFRESH_MS);
    window.addEventListener('focus', refreshMarkets);

    getCached('/api/solar-term').catch(() => null).then((termData) => {
      if (!active) return;
      setSolarTerm(termData && !termData.error ? termData : null);
    });

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshMarkets);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const refreshItems = () => {
      if (inFlight) return;
      inFlight = true;
      setLoading(true);
      setError(false);
      loadConsumerHome(get, selectedMarket)
        .then((homeData) => {
          if (!active) return;
          const normalized = homeData.items.map(normalizeHomeItem);
          setItems(selectConsumerHomeItems(normalized));
        })
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          inFlight = false;
          if (active) setLoading(false);
        });
    };

    refreshItems();
    const intervalId = window.setInterval(refreshItems, LIVE_DATA_REFRESH_MS);
    window.addEventListener('focus', refreshItems);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshItems);
    };
  }, [selectedMarket]);

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
            <button
              type="button"
              className="home-ai-recommendation-cta"
              onClick={() => navigate('/recommendations')}
            >
              <Sparkles size={18} aria-hidden="true" />
              開啟 AI 推薦
              <ArrowRight size={16} aria-hidden="true" />
            </button>
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
          </div>

          {markets.length > 0 && (
            <div className="market-filter">
              <label htmlFor="recommendation-market" className="market-filter-label">
                <Store size={14} aria-hidden="true" />
                選擇市場
              </label>
              <select
                id="recommendation-market"
                className="market-select"
                value={selectedMarket}
                onChange={(e) => setSelectedMarket(e.target.value)}
              >
                <option value="">全部市場</option>
                {markets.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          )}

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
              title={selectedMarket ? `${selectedMarket} 目前沒有行情資料` : '今天還沒有推薦品項'}
              description={selectedMarket ? '請選擇其他市場，或切換到全部市場查看。' : '搜尋想買的菜，查看目前價格。'}
            />
          )}
          {!loading && !error && items.length > 0 && (
            <div className="recommendation-grid">
              {items.map((item) => (
                <RecommendationCard
                  key={item.product_name}
                  item={item}
                  onOpen={() => {
                    const qs = item.market_name ? `?market=${encodeURIComponent(item.market_name)}` : '';
                    navigate(`/product/${encodeURIComponent(item.product_name)}${qs}`);
                  }}
                />
              ))}
            </div>
          )}
        </section>

        <HomeAgricultureExplorer markets={markets} />

        <section className="home-quick-links" aria-label="其他服務">
          <QuickLinkCard
            icon={Bell}
            title="一週天氣預報"
            description="到天氣頁面確認當週天氣溫度與雨量狀況。"
            actionLabel="查看設定"
            onClick={() => navigate('/weather')}
          />
          <QuickLinkCard
            icon={CloudSun}
            title="AI推薦農產品"
            description={solarTerm
              ? `目前是${solarTerm.term_name}，查看適合採買的當季食材。`
              : '查看現在市場、當季農產建議。'}
            actionLabel="查看推薦"
            onClick={() => navigate('/recommendations')}
          />
          <QuickLinkCard
            icon={Newspaper}
            title="新知與資訊分享"
            description="掌握農產新知，也能查看產地、採購與好物分享。"
            actionLabel="逛逛內容中心"
            onClick={() => navigate('/news')}
          />
          <QuickLinkCard
            icon={Tag}
            title="特賣會"
            description="全站特價訊息集中表列，所有好康一次看完。"
            actionLabel="逛特賣會"
            onClick={() => navigate('/special-offers')}
          />
        </section>
      </main>
    </div>
  );
}
