import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  Heart,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
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
const RECOMMENDATION_PAGE_SIZE = 9;
const STATUS_OPTIONS = ['', '便宜', '正常', '偏貴'];
const STATUS_ICONS = {
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

function normalizeRange(range) {
  const min = Number(range[0]);
  const max = Number(range[1]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
    return null;
  }
  return [min, max];
}

function getPageItems(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const sorted = [...pages].filter((page) => page > 0 && page <= totalPages).sort((a, b) => a - b);
  return sorted.flatMap((page, index) => {
    const previous = sorted[index - 1];
    return index > 0 && page - previous > 1
      ? [`ellipsis-${previous}`, page]
      : [page];
  });
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
          {STATUS_OPTIONS.map((value) => (
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

function PriceResultCard({ item, saved, onToggleSaved, onOpen }) {
  const currentStatus = getPriceStatus(item);
  const Icon = STATUS_ICONS[currentStatus] || Search;
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
  const requestedPage = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);

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
  useEffect(() => setInput(query), [query]);

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
    updateSearchParams({ [paramKey]: value, page: '' });
  }

  function handleDesktopPriceChange(nextRange) {
    setPriceRange(nextRange);
    const normalized = normalizeRange(nextRange);
    if (!normalized) return;
    setPriceRange(normalized);
  }

  function openDrawer() {
    setDraftFilters({ market, status, sort });
    setDraftPriceRange([...priceRange]);
    setDrawerOpen(true);
  }

  function applyMobileFilters() {
    const normalized = normalizeRange(draftPriceRange);
    if (!normalized) {
      showToast('請確認價格範圍，最高價格需大於或等於最低價格');
      return;
    }

    setPriceRange(normalized);
    updateSearchParams({
      market: draftFilters.market,
      filter: draftFilters.status,
      sort: draftFilters.sort,
      page: '',
    });
    setDrawerOpen(false);
  }

  function submitSearch(event) {
    event.preventDefault();
    updateSearchParams({ q: input.trim(), page: '' });
  }

  const visibleItems = useMemo(() => {
    const [sortColumn, sortDirection] = sort.split(':');
    const normalizedQuery = query.trim();
    const normalizedRange = normalizeRange(priceRange) || DEFAULT_PRICE_RANGE;

    return items
      .filter((item) => !normalizedQuery || item.product_name?.includes(normalizedQuery))
      .filter((item) => !status || getPriceStatus(item) === status)
      .filter((item) => (
        item.today_price == null
        || (
          item.today_price >= normalizedRange[0]
          && item.today_price <= normalizedRange[1]
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

  const totalPages = Math.max(1, Math.ceil(visibleItems.length / RECOMMENDATION_PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageItems = getPageItems(currentPage, totalPages);
  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * RECOMMENDATION_PAGE_SIZE;
    return visibleItems.slice(start, start + RECOMMENDATION_PAGE_SIZE);
  }, [currentPage, visibleItems]);

  useEffect(() => {
    if (visibleItems.length > 0 && requestedPage > totalPages) {
      updateSearchParams({ page: totalPages === 1 ? '' : String(totalPages) });
    }
  }, [requestedPage, totalPages, visibleItems.length]);

  function changePage(nextPage) {
    const page = Math.min(Math.max(1, nextPage), totalPages);
    updateSearchParams({ page: page === 1 ? '' : String(page) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

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
    || Number(priceRange[0]) !== DEFAULT_PRICE_RANGE[0]
    || Number(priceRange[1]) !== DEFAULT_PRICE_RANGE[1]
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
              placeholder="例如：甘藍"
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
            onPriceChange={handleDesktopPriceChange}
          />
        </div>

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
              {pagedItems.map((item) => {
                const detailParams = params.toString();
                const detailUrl = `/product/${encodeURIComponent(item.product_name)}${detailParams ? `?${detailParams}` : ''}`;
                return (
                  <PriceResultCard
                    key={`${item.market_name || ''}:${item.product_name}`}
                    item={item}
                    saved={savedProducts.includes(item.product_name)}
                    onToggleSaved={() => toggleSavedProduct(item.product_name)}
                    onOpen={() => navigate(detailUrl)}
                  />
                );
              })}
            </div>
          )}
          {!loading && !error && visibleItems.length > RECOMMENDATION_PAGE_SIZE && (
            <nav className="result-pagination" aria-label="推薦品項分頁">
              <button
                type="button"
                className="result-page-arrow"
                onClick={() => changePage(currentPage - 1)}
                disabled={currentPage === 1}
              >上一頁</button>
              <div className="result-page-numbers">
                {pageItems.map((page) => (
                  typeof page === 'string'
                    ? <span className="result-page-ellipsis" key={page}>…</span>
                    : (
                      <button
                        type="button"
                        key={page}
                        className={page === currentPage ? 'active' : ''}
                        aria-label={`第 ${page} 頁`}
                        aria-current={page === currentPage ? 'page' : undefined}
                        onClick={() => changePage(page)}
                      >{page}</button>
                    )
                ))}
              </div>
              <button
                type="button"
                className="result-page-arrow"
                onClick={() => changePage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >下一頁</button>
            </nav>
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
