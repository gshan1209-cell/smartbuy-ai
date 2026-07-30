import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFavorites, removeFavorite } from '../lib/favoritesService';
import './MyBasket.css';

function SavedProductsList({ savedProducts, onRemove }) {
  const navigate = useNavigate();
  const [expandedName, setExpandedName] = useState(null);
  return (
    <div className="mb-grid">
      {savedProducts.map(name => {
        const expanded = expandedName === name;
        return (
          <div
            key={name}
            className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => setExpandedName(expanded ? null : name)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className="badge badge-green">品項</span>
              <button
                className="mb-chip-remove"
                onClick={e => { e.stopPropagation(); onRemove(name); }}
                title="取消收藏"
              >×</button>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{name}</h3>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10,
            }}>
              <button
                onClick={e => { e.stopPropagation(); navigate(`/product/${encodeURIComponent(name)}`); }}
                style={{
                  fontSize: 12, color: 'var(--green-dark)', textDecoration: 'none',
                  padding: '4px 10px', borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--cream-dark)',
                  cursor: 'pointer',
                }}
              >
                查看品項詳情 ↗
              </button>
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
    Promise.all([fetchFavorites('news'), fetchFavorites('product')])
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
    setSavedProducts(prev => prev.filter(n => n !== name));
    removeFavorite('product', name).catch(() => {});
  }

  return (
    <div className="container mb-page">
      <h1 className="page-title">⭐ 我的收藏</h1>
      <p className="mb-desc">收藏喜歡的品項與文章，登入後跨裝置同步。</p>

      {favLoading && <div className="spinner" />}

      {/* 收藏品項（來自售價動態頁） */}
      <h2 className="page-title" style={{ fontSize: 20, marginTop: 40 }}>⭐ 收藏品項</h2>
      {!favLoading && savedProducts.length === 0 ? (
        <p className="empty">還沒有收藏的品項，前往<a href="/search" onClick={e => { e.preventDefault(); navigate('/search'); }} style={{ color: 'var(--green)', fontWeight: 500 }}>售價動態</a>收藏</p>
      ) : (
        <SavedProductsList savedProducts={savedProducts} onRemove={handleRemoveSavedProduct} />
      )}

      {/* 收藏文章（來自農產新知頁，獨立於品項清單） */}
      <h2 className="page-title" style={{ fontSize: 20, marginTop: 40 }}>📰 收藏文章</h2>
      {!favLoading && savedNews.length === 0 ? (
        <p className="empty">還沒有收藏的文章，前往<a href="/news" onClick={e => { e.preventDefault(); navigate('/news'); }} style={{ color: 'var(--green)', fontWeight: 500 }}>農產新知</a>看看</p>
      ) : (
        <SavedNewsList savedNews={savedNews} onRemove={handleRemoveSavedNews} />
      )}
    </div>
  );
}
