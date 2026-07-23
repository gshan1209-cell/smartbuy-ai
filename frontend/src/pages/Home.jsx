import { useEffect, useState } from 'react';
import { ArrowRight, Bell, CloudSun, Search, ShoppingBasket, TrendingDown, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/shared/Card';
import EmptyState from '../components/shared/EmptyState';
import LoadingState from '../components/shared/LoadingState';
import { get } from '../hooks/useApi';
import { getConsumerAdvice } from '../lib/consumerAdvice';
import { loadConsumerHome, normalizeHomeItem } from '../lib/consumerHomeAdapter';
import './Home.css';

const statusIcons = { 便宜: TrendingDown, 正常: ShoppingBasket, 偏貴: TrendingUp, 資料不足: Search };

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState('');
  const [markets, setMarkets] = useState([]);
  const [items, setItems] = useState([]);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([get('/api/markets').catch(() => ({ markets: [] })), loadConsumerHome(get)])
      .then(([marketData, homeData]) => { setMarkets(marketData.markets || []); setItems(homeData.items.map(normalizeHomeItem)); setIsDemo(homeData.isDemo); })
      .catch(() => setError(true)).finally(() => setLoading(false));
  }, []);

  const submitSearch = (event) => { event.preventDefault(); const params = new URLSearchParams(); if (query.trim()) params.set('q', query.trim()); if (market) params.set('market', market); navigate(`/search?${params}`); };

  return <div className="consumer-home">
    <section className="consumer-hero"><div className="consumer-hero-inner">
      <div><p className="consumer-kicker">SmartBuy AI · 買菜小幫手</p><h1>今天買什麼？</h1><p className="consumer-lead">快速看看哪些菜比較划算，讓今天的採買更輕鬆。</p></div>
      <form className="consumer-search" onSubmit={submitSearch}><label htmlFor="home-search">搜尋蔬菜或水果</label><div><Search size={20} aria-hidden="true" /><input id="home-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：高麗菜、番茄" /><select aria-label="選擇市場" value={market} onChange={(event) => setMarket(event.target.value)}><option value="">全部市場</option>{markets.map((name) => <option key={name} value={name}>{name}</option>)}</select><button type="submit">查今天菜價</button></div></form>
    </div></section>
    <main className="consumer-content">
      <section className="today-section"><div className="section-heading"><div><p className="eyebrow">Today&apos;s picks</p><h2>今日採買建議</h2></div>{isDemo && <span className="demo-note">示範資料</span>}</div>
        {loading && <LoadingState label="正在整理今天的菜價…" />}
        {error && <EmptyState title="暫時無法取得菜價" description="你可以先到查價頁搜尋，稍後再回來看看。" action={<button className="consumer-link" onClick={() => navigate('/search')}>前往查價 <ArrowRight size={16} /></button>} />}
        {!loading && !error && !items.length && <EmptyState title="今天還沒有推薦品項" description="搜尋想買的菜，查看目前價格。" />}
        {!loading && !error && <div className="recommendation-grid">{items.map((item) => { const advice = getConsumerAdvice(item.status, item.prediction_direction); const Icon = statusIcons[item.status] || Search; return <Card className={`recommendation-card status-${item.status}`} key={item.product_name} onClick={() => navigate(`/product/${encodeURIComponent(item.product_name)}`)}><div className="recommendation-top"><span className="status-icon"><Icon size={19} aria-hidden="true" /></span><span className="status-label">{item.status}</span></div><h3>{item.product_name}</h3><p className="recommendation-price">{item.today_price == null ? '—' : `${item.today_price} 元`}<small>／今日均價</small></p><strong>{advice.label}</strong><p>{advice.text}</p><small className="updated">更新：{item.updatedAt}</small></Card>; })}</div>}
      </section>
      <section className="consumer-reminders"><Card><div className="reminder-icon"><Bell size={20} /></div><div><h2>收藏與天氣提醒</h2><p>登入後可收到收藏品項的價格變化；天氣與節氣資訊也會在需要時提醒你。</p></div><button className="consumer-link" onClick={() => navigate('/settings')}>查看設定 <ArrowRight size={16} /></button></Card><Card><div className="reminder-icon"><CloudSun size={20} /></div><div><h2>想知道更多？</h2><p>查看農產新知與互助網，掌握生活中有用的農產資訊。</p></div><button className="consumer-link" onClick={() => navigate('/news')}>逛逛新知 <ArrowRight size={16} /></button></Card></section>
    </main>
  </div>;
}
