import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Heart,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import Chart from 'chart.js/auto';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Toast from '../components/Toast';
import Drawer from '../components/shared/Drawer';
import EmptyState from '../components/shared/EmptyState';
import LoadingState from '../components/shared/LoadingState';
import { get } from '../hooks/useApi';
import { addFavorite, fetchFavorites, removeFavorite } from '../lib/favoritesService';
import { getConsumerAdvice, getPriceStatus } from '../lib/consumerAdvice';
import './PriceSearch.css';

const DEFAULT_SORT = 'volume:desc';
const DEFAULT_PRICE_RANGE = [0, 1000];
const statusOptions = ['', '便宜', '正常', '偏貴'];
const statusIcons = {
  便宜: TrendingDown,
  正常: BarChart3,
  偏貴: TrendingUp,
};

function getItemDate(item) {
  return item.trans_date
    ?? item.latest_trade_date
    ?? item.updated_at
    ?? '資料日期未提供';
}

function getSevenDayReturn(item) {
  if (typeof item.price_return_7 === 'number') return item.price_return_7;
  if (
    typeof item.today_price !== 'number'
    || typeof item.recent_average !== 'number'
    || item.recent_average === 0
  ) {
    return null;
  }

  return (item.today_price - item.recent_average) / item.recent_average;
}

function compareNullableNumbers(a, b, direction) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === 'asc' ? a - b : b - a;
}

function FilterFields({ values, markets, priceRange, onChange, onPriceChange }) {
  return (
    <div className="filter-fields">
      <label>
        市場
        <select
          value={values.market}
          onChange={(event) => onChange('market', event.target.value)}
        >
          <option value="">全部市場</option>
          {markets.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </label>

      <label>
        價格範圍
        <div className="price-range">
          <input
            type="number"
            min="0"
            inputMode="numeric"
            aria-label="最低價格"
            value={priceRange[0]}
            onChange={(event) => onPriceChange([event.target.value, priceRange[1]])}
          />
          <span>–</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            aria-label="最高價格"
            value={priceRange[1]}
            onChange={(event) => onPriceChange([priceRange[0], event.target.value])}
          />
        </div>
      </label>

      <label>
        排序
        <select
          value={values.sort}
          onChange={(event) => onChange('sort', event.target.value)}
        >
          <option value="volume:desc">熱門程度</option>
          <option value="price:asc">價格由低到高</option>
          <option value="price:desc">價格由高到低</option>
          <option value="diff7:desc">近期漲幅</option>
          <option value="diff7:asc">近期跌幅</option>
        </select>
      </label>

      <fieldset>
        <legend>價格狀態</legend>
        <div className="status-filters">
          {statusOptions.map((value) => (
            <button
              type="button"
              key={value || 'all'}
              className={values.status === value ? 'selected' : ''}
              onClick={() => onChange('status', value)}
            >
              {value || '全部'}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function AdvancedMarketIntel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!open || data || loading) return;

    setLoading(true);
    setError(false);
    get('/api/market-intel')
      .then((response) => {
        if (!response || Object.keys(response).length === 0) {
          throw new Error('empty market intel');
        }
        setData(response);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [data, loading, open]);

  useEffect(() => {
    if (!open || !data || !canvasRef.current) return undefined;

    const gainers = [...(data.gainers || [])].reverse();
    const losers = [...(data.losers || [])];
    const chartItems = [...gainers, ...losers];

    if (!chartItems.length) return undefined;

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: chartItems.map((item) => item.crop_name),
        datasets: [{
          label: '近 7 日漲跌',
          data: chartItems.map((item) => Math.round((item.price_return_7 || 0) * 1000) / 10),
          backgroundColor: chartItems.map((item) => (
            item.price_return_7 >= 0
              ? 'rgba(220, 38, 38, 0.75)'
              : 'rgba(22, 163, 74, 0.75)'
          )),
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${context.raw > 0 ? '+' : ''}${context.raw}%`,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              callback: (value) => `${value > 0 ? '+' : ''}${value}%`,
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [data, open]);

  const stability = data?.market_stability;
  const bias = data?.market_bias;
  const alerts = data?.alerts || [];

  return (
    <section className="advanced-intel">
      <button
        type="button"
        className="advanced-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span><BarChart3 size={18} />進階市場資訊</span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {open && (
        <div className="advanced-content">
          {loading && <LoadingState label="正在載入全台市場資訊…" />}
          {error && (
            <EmptyState
              title="目前無法取得進階市場資訊"
              description="一般菜價查詢仍可正常使用，稍後再查看市場分析。"
            />
          )}
          {!loading && !error && data && (
            <>
              <div className="market-intel-heading">
                <div>
                  <strong>全台批發市場綜合分析</strong>
                  <p>資料日：{data.latest_trade_date || data.generated_at || '未提供'}</p>
                </div>
                <span className="market-intel-source">正式市場情報 API</span>
              </div>

              <div className="market-intel-summary">
                <div className="market-intel-card">
                  <Activity size={20} aria-hidden="true" />
                  <span>市場風險</span>
                  <strong>{stability?.risk_level || '資料不足'}</strong>
                  <small>指數 {stability?.risk_index ?? '—'}</small>
                </div>
                <div className="market-intel-card">
                  <TrendingUp size={20} aria-hidden="true" />
                  <span>本週漲跌偏向</span>
                  <strong>{bias?.bias || '資料不足'}</strong>
                  <small>
                    看漲 {bias?.bullish_count ?? '—'}／看跌 {bias?.bearish_count ?? '—'}
                  </small>
                </div>
                <div className="market-intel-card">
                  <AlertTriangle size={20} aria-hidden="true" />
                  <span>異常警報</span>
                  <strong>{alerts.length} 項</strong>
                  <small>{alerts.length ? alerts.slice(0, 3).map((item) => item.crop_name).join('、') : '目前無異常警報'}</small>
                </div>
              </div>

              <div className="advanced-chart"><canvas ref={canvasRef} /></div>
              <p className="market-intel-note">
                此區保留原有市場風險、漲跌偏向與異常資料，提供需要進階分析的使用者查看。
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function PriceResultCard({ item, saved, onToggleSaved, onOpen }) {
  const currentStatus = getPriceStatus(item);
  const Icon = statusIcons[currentStatus] || Search;
  const advice = getConsumerAdvice(currentStatus, item.prediction_direction);
  const return7 = getSevenDayReturn(item);
  const statusClass = {
    便宜: 'price-result-status--cheap',
    正常: 'price-result-status--normal',
    偏貴: 'price-result-status--expensive',
  }[currentStatus] || 'price-result-status--unknown';

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  }

  return (
    <article
      className="price-result-card"
      tabIndex={0}
      role="link"
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      <div className="result-card-head">
        <div>
          <h3>{item.product_name}</h3>
          <small>{item.market_name || '市場資料未提供'}</small>
        </div>
        <button
          type="button"
          className={`favorite-button ${saved ? 'saved' : ''}`}
          aria-label={saved ? `取消收藏 ${item.product_name}` : `收藏 ${item.product_name}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSaved();
          }}
        >
          <Heart size={20} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="result-price">
        <span>{item.today_price == null ? '資料不足' : `${item.today_price} 元`}</span>
        <span className={`result-status ${statusClass}`}>
          <Icon size={15} />{currentStatus}
        </span>
      </div>

      <p className="result-advice">{advice.label}：{advice.text}</p>
      {return7 != null && (
        <p className={`result-trend ${return7 > 0 ? 'up' : return7 < 0 ? 'down' : ''}`}>
          近 7 日 {return7 > 0 ? '+' : ''}{Math.round(return7 * 100)}%
        </p>
      )}
      <small className="result-updated">更新：{getItemDate(item)}</small>
      <button
        type="button"
        className="detail-link"
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        查看詳情 <ChevronDown size={15} />
      </button>
    </article>
  );
}

export default function PriceSearch() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const market = params.get('market') || '';
  const status = params.get('filter') || '';
  const sort = params.get('sort') || DEFAULT_SORT;

  const [input, setInput] = useState(query);
  const [markets, setMarkets] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [priceRange, setPriceRange] = useState(DEFAULT_PRICE_RANGE);
  const [draftFilters, setDraftFilters] = useState({ market, status, sort });
  const [draftPriceRange, setDraftPriceRange] = useState(DEFAULT_PRICE_RANGE);
  const [savedProducts, setSavedProducts] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  useEffect(() => {
    get('/api/markets')
      .then((data) => setMarkets(data.markets || []))
      .catch(() => setMarkets([]));

    fetchFavorites('product')
      .then(setSavedProducts)
      .catch(() => setSavedProducts([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(false);
    const productParams = new URLSearchParams();
    if (market) productParams.set('market', market);

    get(`/api/products${productParams.toString() ? `?${productParams}` : ''}`)
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => {
        setItems([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [market]);

  function showToast(message) {
    window.clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(''), 2600);
  }

  function updateSearchParams(changes) {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      if (value && !(key === 'sort' && value === DEFAULT_SORT)) next.set(key, value);
      else next.delete(key);
    });
    setParams(next);
  }

  function handleDesktopFilterChange(key, value) {
    const paramKey = key === 'status' ? 'filter' : key;
    updateSearchParams({ [paramKey]: value });
  }

  function openDrawer() {
    setDraftFilters({ market, status, sort });
    setDraftPriceRange([...priceRange]);
    setDrawerOpen(true);
  }

  function applyMobileFilters() {
    const minPrice = Number(draftPriceRange[0]);
    const maxPrice = Number(draftPriceRange[1]);

    if (
      !Number.isFinite(minPrice)
      || !Number.isFinite(maxPrice)
      || minPrice < 0
      || maxPrice < minPrice
    ) {
      showToast('請確認價格範圍，最高價格需大於或等於最低價格');
      return;
    }

    setPriceRange([minPrice, maxPrice]);
    updateSearchParams({
      market: draftFilters.market,
      filter: draftFilters.status,
      sort: draftFilters.sort,
    });
    setDrawerOpen(false);
  }

  function submitSearch(event) {
    event.preventDefault();
    updateSearchParams({ q: input.trim() });
  }

  const visibleItems = useMemo(() => {
    const [sortColumn, sortDirection] = sort.split(':');
    const normalizedQuery = query.trim();

    return items
      .filter((item) => !normalizedQuery || item.product_name?.includes(normalizedQuery))
      .filter((item) => !status || getPriceStatus(item) === status)
      .filter((item) => (
        item.today_price == null
        || (
          item.today_price >= Number(priceRange[0])
          && item.today_price <= Number(priceRange[1])
        )
      ))
      .sort((a, b) => {
        if (sortColumn === 'price') {
          return compareNullableNumbers(a.today_price, b.today_price, sortDirection);
        }
        if (sortColumn === 'diff7') {
          return compareNullableNumbers(
            getSevenDayReturn(a),
            getSevenDayReturn(b),
            sortDirection,
          );
        }
        return compareNullableNumbers(a.volume, b.volume, sortDirection);
      });
  }, [items, priceRange, query, sort, status]);

  async function toggleSavedProduct(name) {
    const wasSaved = savedProducts.includes(name);

    if (wasSaved) {
      setSavedProducts((current) => current.filter((item) => item !== name));
      try {
        await removeFavorite('product', name);
        showToast('已從我的菜籃移除');
      } catch {
        setSavedProducts((current) => [...current, name]);
        showToast('移除失敗，請稍後再試');
      }
      return;
    }

    setSavedProducts((current) => [...current, name]);
    try {
      await addFavorite('product', name);
      showToast('已加入我的菜籃');
    } catch {
      setSavedProducts((current) => current.filter((item) => item !== name));
      showToast('收藏失敗，請稍後再試');
    }
  }

  const hasFilters = (
    market
    || status
    || sort !== DEFAULT_SORT
    || priceRange[0] !== DEFAULT_PRICE_RANGE[0]
    || priceRange[1] !== DEFAULT_PRICE_RANGE[1]
  );

  return (
    <div className="price-search-page">
      <div className="price-search-inner">
        <header className="search-heading">
          <div>
            <p className="eyebrow">Price Search</p>
            <h1>今天菜價</h1>
            <p>找找看，哪些菜現在比較划算。</p>
          </div>
          <button type="button" className="filter-trigger" onClick={openDrawer}>
            <SlidersHorizontal size={18} />
            篩選{hasFilters ? ' · 已套用' : ''}
          </button>
        </header>

        <form className="price-search-form" onSubmit={submitSearch}>
          <label htmlFor="price-query">搜尋品項</label>
          <div>
            <Search size={19} aria-hidden="true" />
            <input
              id="price-query"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="例如：高麗菜"
            />
            <button type="submit">搜尋</button>
          </div>
        </form>

        <div className="desktop-filters">
          <FilterFields
            values={{ market, status, sort }}
            markets={markets}
            priceRange={priceRange}
            onChange={handleDesktopFilterChange}
            onPriceChange={setPriceRange}
          />
        </div>

        <AdvancedMarketIntel />

        <section className="results-section">
          <div className="results-heading">
            <h2>{query ? `「${query}」的結果` : '推薦品項'}</h2>
            <span>{loading ? '載入中…' : `${visibleItems.length} 項`}</span>
          </div>

          {loading && <LoadingState label="正在查詢菜價…" />}
          {error && (
            <EmptyState
              title="目前無法取得菜價"
              description="請確認服務已啟動，或稍後再試。"
              action={(
                <button className="consumer-link" onClick={() => window.location.reload()}>
                  重新整理
                </button>
              )}
            />
          )}
          {!loading && !error && !visibleItems.length && (
            <EmptyState
              title="找不到符合的品項"
              description="試試看清除篩選或搜尋其他蔬果。"
            />
          )}
          {!loading && !error && visibleItems.length > 0 && (
            <div className="price-result-grid">
              {visibleItems.map((item) => {
                const detailParams = params.toString();
                const detailUrl = `/product/${encodeURIComponent(item.product_name)}${detailParams ? `?${detailParams}` : ''}`;
                return (
                  <PriceResultCard
                    key={item.product_name}
                    item={item}
                    saved={savedProducts.includes(item.product_name)}
                    onToggleSaved={() => toggleSavedProduct(item.product_name)}
                    onOpen={() => navigate(detailUrl)}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="篩選菜價">
        <FilterFields
          values={draftFilters}
          markets={markets}
          priceRange={draftPriceRange}
          onChange={(key, value) => setDraftFilters((current) => ({
            ...current,
            [key]: value,
          }))}
          onPriceChange={setDraftPriceRange}
        />
        <button type="button" className="apply-filters" onClick={applyMobileFilters}>
          套用篩選
        </button>
      </Drawer>

      <Toast message={toastMessage} />
    </div>
  );
}
