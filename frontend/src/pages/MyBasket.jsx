import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchFavoriteProducts, fetchFavorites, removeFavorite } from '../lib/favoritesService';
import { get } from '../hooks/useApi';
import { getConsumerAdvice, getPriceStatus } from '../lib/consumerAdvice';
import LoadingState from '../components/shared/LoadingState';
import EmptyState from '../components/shared/EmptyState';
import './MyBasket.css';

async function loadSavedProductDetail({ name, market }) {
  let selectedMarket = market;
  let summary = null;

  // 舊收藏沒有保存市場，先從正式行情清單找回可用的展示市場。
  if (!selectedMarket) {
    try {
      const matches = await get(`/api/products?q=${encodeURIComponent(name)}`);
      summary = Array.isArray(matches)
        ? matches.find((item) => item.product_name === name) || null
        : null;
      selectedMarket = summary?.market_name || '';
    } catch {
      // 詳情請求仍會依既有錯誤狀態呈現，不把整個菜籃頁打成失敗。
    }
  }

  if (selectedMarket) {
    try {
      return await get(
        `/api/products/${encodeURIComponent(name)}?market=${encodeURIComponent(selectedMarket)}`,
      );
    } catch {
      // API 暫時沒有完整詳情時，保留已取得的行情摘要與市場連結。
    }
  }

  if (summary) {
    return { ...summary, price_detail: summary, error: true };
  }
  return { error: true, market_name: selectedMarket };
}

function SavedProductsList({ savedProducts, onRemove }) {
  const navigate = useNavigate();
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = {};
      for (const favorite of savedProducts) {
        const name = favorite.name;
        next[name] = await loadSavedProductDetail(favorite);
      }
      if (!cancelled) { setDetails(next); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [savedProducts]);
  if (loading) return <LoadingState label="正在更新收藏品項…" />;
  if (!savedProducts.length) return <EmptyState title="還沒有收藏的品項" description="前往查價頁收藏想追蹤的蔬果。" action={<button className="consumer-link" onClick={() => navigate('/search')}>前往查價</button>} />;
  return (
    <div className="mb-grid">
      {savedProducts.map(({ name, market }) => {
        const detail = details[name];
        const status = getPriceStatus(detail);
        const advice = getConsumerAdvice(status, detail?.prediction_direction);
        const detailMarket = detail?.price_detail?.market_name || detail?.market_name || market;
        const detailPath = `/product/${encodeURIComponent(name)}${detailMarket ? `?market=${encodeURIComponent(detailMarket)}` : ''}`;
        return (
          <div key={name} className="card basket-product-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className="badge badge-green">{status}</span>
              <button
                className="mb-chip-remove"
                onClick={e => { e.stopPropagation(); onRemove(name); }}
                title="取消收藏" aria-label={`移除 ${name} 收藏`}
              >×</button>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{name}</h3>
            <p className="basket-price">{detail?.today_price == null ? '資料不足' : `${detail.today_price} 元`} <small>{detailMarket || '市場資料未提供'}</small></p>
            <p className="basket-advice"><strong>{advice.label}</strong>：{advice.text}</p>
            <small className="basket-updated">更新：{detail?.price_detail?.trans_date || '資料日期未提供'}</small>
            <Link
              to={detailPath}
              className="basket-product-detail-link"
              aria-label={`查看 ${name} 品項詳情`}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10,
                color: 'inherit', textDecoration: 'none',
              }}
            >
              <span style={{
                fontSize: 12, color: 'var(--green-dark)', textDecoration: 'none',
                padding: '4px 10px', borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--cream-dark)',
              }}>
                查看品項詳情 ↗
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                查看詳情 →
              </span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function SavedNewsList({ savedNews, onRemove }) {
  const [expandedId, setExpandedId] = useState(null);
  return (
    <div className="mb-grid">
      {savedNews.map(article => {
        const expanded = expandedId === article.id;
        return (
          <div
            key={article.id}
            className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => setExpandedId(expanded ? null : article.id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className="badge badge-green">{article.source || article.tag}</span>
              <button
                className="mb-chip-remove"
                onClick={e => { e.stopPropagation(); onRemove(article.id); }}
                title="取消收藏"
              >×</button>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{article.title}</h3>
            <p style={{
              fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6,
              display: '-webkit-box', WebkitBoxOrient: 'vertical',
              WebkitLineClamp: expanded ? 'unset' : 3,
              overflow: expanded ? 'visible' : 'hidden',
              marginBottom: 0,
            }}>{article.summary}</p>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10,
            }}>
              {article.url ? (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{
                    fontSize: 12, color: 'var(--green-dark)', textDecoration: 'none',
                    padding: '4px 10px', borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--cream-dark)',
                    display: 'inline-block',
                  }}
                >
                  閱讀原文 ↗
                </a>
              ) : <span />}
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                {expanded ? '收合 ↑' : '展開 →'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MyBasket() {
  const navigate = useNavigate();
  const [savedNews, setSavedNews] = useState([]);
  const [savedProducts, setSavedProducts] = useState([]);
  const [favLoading, setFavLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchFavorites('news'), fetchFavoriteProducts()])
      .then(([news, products]) => {
        if (cancelled) return;
        setSavedNews(news);
        setSavedProducts(products);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFavLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function handleRemoveSavedNews(id) {
    setSavedNews(prev => prev.filter(a => String(a.id) !== String(id)));
    removeFavorite('news', id).catch(() => {});
  }

  function handleRemoveSavedProduct(name) {
    if (!window.confirm(`確定要移除 ${name} 的收藏嗎？`)) return;
    setSavedProducts(prev => prev.filter(favorite => favorite.name !== name));
    removeFavorite('product', name).catch(() => setSavedProducts(prev => [...prev, { name, market: '' }]));
  }

  return (
    <div className="container mb-page">
      <h1 className="page-title">⭐ 我的收藏</h1>
      <p className="mb-desc">收藏喜歡的品項與文章，登入後跨裝置同步。</p>

      {favLoading && <div className="spinner" />}

      {/* 收藏品項（來自售價動態頁） */}
        <h2 id="saved-products" className="page-title" style={{ fontSize: 20, marginTop: 40 }}>⭐ 收藏品項</h2>
      {!favLoading && savedProducts.length === 0 ? (
        <p className="empty">還沒有收藏的品項，前往<a href="/search" onClick={e => { e.preventDefault(); navigate('/search'); }} style={{ color: 'var(--green)', fontWeight: 500 }}>售價動態</a>收藏</p>
      ) : (
        <SavedProductsList savedProducts={savedProducts} onRemove={handleRemoveSavedProduct} />
      )}

      {/* 收藏文章（來自農產新知頁，獨立於品項清單） */}
        <h2 id="saved-news" className="page-title" style={{ fontSize: 20, marginTop: 40 }}>📰 收藏文章</h2>
      {!favLoading && savedNews.length === 0 ? (
        <p className="empty">還沒有收藏的文章，前往<a href="/news" onClick={e => { e.preventDefault(); navigate('/news'); }} style={{ color: 'var(--green)', fontWeight: 500 }}>新知與資訊分享</a>看看</p>
      ) : (
        <SavedNewsList savedNews={savedNews} onRemove={handleRemoveSavedNews} />
      )}
    </div>
  );
}
