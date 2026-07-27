import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Search,
  ShoppingBasket,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/shared/Card';
import EmptyState from '../components/shared/EmptyState';
import LoadingState from '../components/shared/LoadingState';
import { getCached } from '../hooks/useApi';
import { getConsumerAdvice } from '../lib/consumerAdvice';
import {
  loadConsumerHome,
  normalizeHomeItem,
  selectConsumerHomeItems,
} from '../lib/consumerHomeAdapter';
import HomeAgricultureExplorer from '../components/public/HomeAgricultureExplorer';
import AiRecommendModal from '../components/public/AiRecommendModal';
import './Home.css';


const statusIcons = {
  便宜: TrendingDown,
  正常: ShoppingBasket,
  偏貴: TrendingUp,
  資料不足: Search,
};

// 台灣市場依地理位置分北中南東（以後端實際回傳名稱為準）
const MARKET_REGION_ORDER = [
  {
    label: '北部',
    markets: ['台北一', '台北二', '台北市場', '板橋區', '三重區', '桃農', '宜蘭市'],
  },
  {
    label: '中部',
    markets: ['台中市', '台中市場', '豐原區', '彰化市場', '東勢鎮', '溪湖鎮', '永靖鄉', '西螺鎮', '南投市'],
  },
  {
    label: '南部',
    markets: ['台南市場', '嘉義市', '高雄市', '高雄市場', '鳳山區', '屏東市'],
  },
  {
    label: '東部',
    markets: ['台東市', '花蓮市'],
  },
];

function buildRegionGroups(apiMarkets) {
  const assigned = new Set();
  const groups = MARKET_REGION_ORDER.map(({ label, markets: order }) => {
    const matched = order.filter((m) => apiMarkets.includes(m));
    matched.forEach((m) => assigned.add(m));
    return { label, markets: matched };
  }).filter((g) => g.markets.length > 0);

  const others = apiMarkets.filter((m) => !assigned.has(m));
  if (others.length > 0) groups.push({ label: '其他', markets: others });
  return groups;
}

function HomeSearchForm({ markets, onSearch, onOpenAiRecommend }) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [market, setMarket] = useState('');
  const regionGroups = buildRegionGroups(markets);

  const currentRegionMarkets = region
    ? (regionGroups.find((g) => g.label === region)?.markets ?? [])
    : [];

  function handleRegionChange(e) {
    setRegion(e.target.value);
    setMarket(''); // 切換區域時清掉已選市場
  }

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
        <div className="consumer-market-selects">
          <select
            aria-label="選擇區域"
            value={region}
            onChange={handleRegionChange}
          >
            <option value="">全部地區</option>
            {regionGroups.map(({ label }) => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
          <select
            aria-label="選擇市場"
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            disabled={!region}
          >
            <option value="">{region ? '全部市場' : '先選地區'}</option>
            {currentRegionMarkets.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="consumer-search-actions">
          <button type="submit" className="search-submit-btn">查今天菜價</button>
          <button
            type="button"
            className="search-ai-btn"
            onClick={onOpenAiRecommend}
          >
            <Sparkles size={16} aria-hidden="true" />
            AI 推薦
          </button>
        </div>
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

export default function Home() {
  const navigate = useNavigate();
  const [markets, setMarkets] = useState([]);
  const [items, setItems] = useState([]);
  const [solarTerm, setSolarTerm] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [aiRecommendOpen, setAiRecommendOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      getCached('/api/markets').catch(() => ({ markets: [] })),
      loadConsumerHome(getCached),
      getCached('/api/solar-term').catch(() => null),
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
          <HomeSearchForm
            markets={markets}
            onSearch={submitSearch}
            onOpenAiRecommend={() => setAiRecommendOpen(true)}
          />
        </div>
      </section>

      <main className="consumer-content">
        <section className="today-section" id="today-section">
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

        <HomeAgricultureExplorer />

      </main>
      <AiRecommendModal
        open={aiRecommendOpen}
        onClose={() => setAiRecommendOpen(false)}
        markets={markets}
      />
    </div>
  );
}
