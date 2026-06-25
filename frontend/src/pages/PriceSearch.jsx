import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PriceCard from '../components/PriceCard';
import { get } from '../hooks/useApi';
import './PriceSearch.css';

export default function PriceSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query,   setQuery]   = useState(searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detail,   setDetail]   = useState(null);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q);
    doSearch(q);
  }, []); // eslint-disable-line

  async function doSearch(q = query) {
    setLoading(true);
    setSelected(null);
    setDetail(null);
    try {
      const data = await get(`/api/products?q=${encodeURIComponent(q)}`);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(name) {
    setSelected(name);
    setDetail(null);
    try {
      const d = await get(`/api/products/${encodeURIComponent(name)}`);
      setDetail(d);
    } catch {
      setDetail({ error: true });
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSearchParams(query ? { q: query } : {});
    doSearch();
  }

  return (
    <div className="container ps-page">
      <h1 className="page-title">🔍 搜尋菜價</h1>

      <form className="ps-search-row" onSubmit={handleSubmit}>
        <input
          className="input ps-input"
          placeholder="輸入品項名稱，例如：高麗菜"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">搜尋</button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => { setQuery(''); doSearch(''); }}
        >
          全部品項
        </button>
      </form>

      {loading && <div className="spinner" />}

      {!loading && results.length === 0 && (
        <p className="empty">查無結果，請試試其他關鍵字</p>
      )}

      <div className="ps-layout">
        <div className="ps-list">
          {results.map((item, i) => (
            <PriceCard
              key={i}
              item={item}
              onClick={() => openDetail(item.product_name)}
            />
          ))}
        </div>

        {selected && (
          <div className="ps-detail card">
            {!detail && <div className="spinner" />}
            {detail?.error && <p className="empty">無法取得詳細資料</p>}
            {detail && !detail.error && (
              <>
                <h2 className="detail-name">{detail.product_name}</h2>
                <div className="detail-grid">
                  <DetailRow label="今日均價" value={detail.today_price != null ? `$${detail.today_price} 元/公斤` : '暫無'} />
                  <DetailRow label="價格狀態" value={detail.price_status} />
                  <DetailRow label="採買建議" value={detail.recommendation} />
                  <DetailRow label="節氣狀態" value={detail.solar_term_status} />
                  <DetailRow label="產地天氣" value={detail.weather_risk} />
                </div>
                <p className="detail-advice">{detail.advice}</p>
                {detail.alternatives?.length > 0 && (
                  <p className="detail-alt">🔄 替代品：{detail.alternatives.join('、')}</p>
                )}
                {detail.price_detail?.reason && (
                  <p className="detail-reason">📊 {detail.price_detail.reason}</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value ?? '—'}</span>
    </div>
  );
}
