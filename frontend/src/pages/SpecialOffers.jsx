import { useEffect, useMemo, useState } from 'react';
import { Clock3, ExternalLink, RefreshCw, Search, Tag, TrendingDown } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import EmptyState from '../components/shared/EmptyState';
import LoadingState from '../components/shared/LoadingState';
import DemoOfferCards from '../components/public/DemoOfferCards';
import { DEMO_SPECIAL_OFFERS } from '../config/demoOfferCards';
import { getCached } from '../hooks/useApi';
import './SpecialOffers.css';

const STATUS = '\u4fbf\u5b9c';
const COPY = {
  title: '\u7279\u8ce3\u6703',
  intro: '\u5168\u7ad9\u9650\u6642\u3001\u9650\u91cf\u7279\u50f9\u8cc7\u8a0a\u96c6\u4e2d\u8868\u5217\uff0c\u6240\u6709\u597d\u5eb7\u4e00\u6b21\u770b\u5b8c\u3002',
  urgencyLabel: '\u9650\u6642\u9650\u91cf',
  urgencyTitle: '\u5373\u671f\u54c1\u51fa\u6e05\uff0c\u8d85\u4f4e\u50f9\u683c',
  urgencyDescription: '\u4fdd\u5b58\u671f\u9650\u8f03\u77ed\u7684\u7522\u54c1\u53ef\u5728\u9019\u88e1\u8d85\u4f4e\u50f9\u51fa\u6e05\uff0c\u6578\u91cf\u6709\u9650\uff0c\u552e\u5b8c\u70ba\u6b62\u3002',
  summaryLabel: '\u7279\u8ce3\u6703\u6458\u8981',
  offerCount: '\u9805\u7279\u50f9\u54c1\u9805',
  summaryHint: '\u4f9d\u5b98\u65b9\u884c\u60c5\u8cc7\u6599\u5224\u65b7\u70ba\u4fbf\u5b9c\u7684\u5546\u54c1\uff0c\u6309\u7701\u4e0b\u91d1\u984d\u6392\u5217\u3002',
  searchLabel: '\u641c\u5c0b\u7279\u50f9\u54c1\u9805',
  searchPlaceholder: '\u641c\u5c0b\u54c1\u9805\u540d\u7a31',
  sortLabel: '\u6392\u5e8f',
  sortSavings: '\u7701\u4e0b\u6bd4\u4f8b\u9ad8\u81f3\u4f4e',
  sortPrice: '\u76ee\u524d\u50f9\u683c\u4f4e\u81f3\u9ad8',
  loading: '\u6b63\u5728\u8f09\u5165\u7279\u8ce3\u8cc7\u8a0a\u2026',
  loadErrorTitle: '\u7279\u8ce3\u8cc7\u8a0a\u8f09\u5165\u5931\u6557',
  retry: '\u91cd\u65b0\u8f09\u5165',
  emptyTitle: '\u76ee\u524d\u6c92\u6709\u53ef\u986f\u793a\u7684\u7279\u50f9\u54c1\u9805',
  emptyDescription: '\u8acb\u5148\u5230\u67e5\u83dc\u50f9\u700f\u89bd\u5b8c\u6574\u884c\u60c5\uff0c\u6216\u7a0d\u5f8c\u518d\u56de\u4f86\u770b\u770b\u3002',
  browsePrices: '\u524d\u5f80\u67e5\u83dc\u50f9',
  noResultsTitle: '\u627e\u4e0d\u5230\u7b26\u5408\u7684\u7279\u50f9\u54c1\u9805',
  noResultsDescription: '\u8acb\u8abf\u6574\u641c\u5c0b\u95dc\u9375\u5b57\u3002',
  shown: '\u986f\u793a',
  items: '\u9805',
  price: '\u76ee\u524d\u50f9\u683c',
  average: '\u8fd1\u671f\u5747\u50f9',
  saved: '\u7701\u4e0b',
  market: '\u5e02\u5834',
  date: '\u4ea4\u6613\u65e5',
  product: '\u54c1\u9805',
  detail: '\u770b\u8a73\u60c5',
  unavailable: '\u672a\u63d0\u4f9b',
  savingUnit: '\u5143',
  refresh: '\u91cd\u65b0\u6574\u7406',
  refreshing: '\u66f4\u65b0\u4e2d\u2026',
  sourceNote: '\u8cc7\u6599\u4f86\u6e90\uff1a\u5b98\u65b9\u884c\u60c5 API\u3002\u7279\u50f9\u72c0\u614b\u6839\u64da\u76ee\u524d\u50f9\u683c\u8207\u8fd1\u671f\u8cc7\u6599\u63a8\u5c0e\uff0c\u50f9\u683c\u4ecd\u4ee5\u5404\u5e02\u5834\u6700\u65b0\u8cc7\u6599\u70ba\u6e96\u3002\u662f\u5426\u70ba\u5373\u671f\u54c1\uff0c\u8acb\u4ee5\u5be6\u969b\u4f9b\u61c9\u7aef\u6a19\u793a\u70ba\u6e96\u3002',
  infoTitle: '\u8cc7\u8a0a\u5206\u4eab',
  infoDescription: '\u7522\u5730\u3001\u683d\u57f9\u3001\u7522\u54c1\u8207\u63a1\u8cfc\u76f8\u95dc\u7684\u5be6\u7528\u5206\u4eab\u7e7c\u7e8c\u4fdd\u7559\uff0c\u8207\u7279\u50f9\u8cc7\u8a0a\u5206\u958b\u700f\u89bd\u3002',
  infoAction: '\u524d\u5f80\u8cc7\u8a0a\u5206\u4eab',
};

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatPrice(value) {
  const number = numberOrNull(value);
  return number == null ? COPY.unavailable : `NT$ ${number.toFixed(1)}`;
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : COPY.unavailable;
}

function getSavings(item) {
  const today = numberOrNull(item.today_price);
  const average = numberOrNull(item.recent_average);
  if (today == null || average == null || average <= today) return null;
  return {
    amount: average - today,
    percent: ((average - today) / average) * 100,
  };
}

export default function SpecialOffers() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchParamString = searchParams.toString();
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [sort, setSort] = useState(() => searchParams.get('sort') === 'price' ? 'price' : 'savings');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setQuery(searchParams.get('q') || '');
    setSort(searchParams.get('sort') === 'price' ? 'price' : 'savings');
  }, [searchParamString]);

  function loadOffers(forceRefresh = false) {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    getCached('/api/products', {
      ttlMs: 5 * 60 * 1000,
      forceRefresh,
      timeoutMs: 4000,
    })
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch((err) => setError(err?.message || '\u7121\u6cd5\u53d6\u5f97\u7279\u8ce3\u8cc7\u8a0a'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }

  useEffect(() => {
    loadOffers();
  }, []);

  const allOffers = useMemo(
    () => products.filter((item) => item.status === STATUS && numberOrNull(item.today_price) != null),
    [products],
  );

  const visibleOffers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allOffers
      .filter((item) => !normalizedQuery || String(item.product_name || '').toLowerCase().includes(normalizedQuery))
      .sort((left, right) => {
        const leftSavings = getSavings(left);
        const rightSavings = getSavings(right);
        if (sort === 'price') {
          return (numberOrNull(left.today_price) ?? Infinity) - (numberOrNull(right.today_price) ?? Infinity);
        }
        return (rightSavings?.percent ?? -Infinity) - (leftSavings?.percent ?? -Infinity)
          || (numberOrNull(left.today_price) ?? Infinity) - (numberOrNull(right.today_price) ?? Infinity);
      });
  }, [allOffers, query, sort]);

  return (
    <main className="special-offers-page">
      <div className="special-offers-inner">
        <header className="special-offers-heading">
          <div>
            <p className="eyebrow">Special Offers</p>
            <h1><Tag size={30} aria-hidden="true" />{COPY.title}</h1>
            <p>{COPY.intro}</p>
          </div>
          <button type="button" className="special-offers-refresh" onClick={() => loadOffers(true)} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            {refreshing ? COPY.refreshing : COPY.refresh}
          </button>
        </header>

        <DemoOfferCards
          title="特賣卡片"
          description="先用卡片快速看懂商家、商品、優惠與限時資訊。"
          cards={DEMO_SPECIAL_OFFERS}
        />
      </div>
    </main>
  );
}
