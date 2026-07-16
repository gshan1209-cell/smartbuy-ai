import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PriceCard from '../components/PriceCard';
import { get } from '../hooks/useApi';
import { loadSavedNews, removeSavedNews } from '../lib/savedNews';
import { loadSavedProducts, removeSavedProduct } from '../lib/savedProducts';
import { loadBasket, saveBasket } from '../lib/basket';
import './MyBasket.css';

function matchedBasketItems(article, basket) {
  return basket.filter(name => article.title.includes(name) || article.summary.includes(name));
}

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

function SavedNewsList({ savedNews, basket, onRemove }) {
  const [expandedId, setExpandedId] = useState(null);
  return (
    <div className="mb-grid">
      {savedNews.map(article => {
        const expanded = expandedId === article.id;
        const related = matchedBasketItems(article, basket);
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
              marginBottom: related.length ? 8 : 0,
            }}>{article.summary}</p>
            {related.length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--orange-dark)', fontWeight: 500, marginBottom: 0 }}>
                🧺 與你的菜籃相關：{related.join('、')}
              </p>
            )}
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
  const [basket,  setBasket]  = useState(loadBasket);
  const [advices, setAdvices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savedNews, setSavedNews] = useState(loadSavedNews);
  const [savedProducts, setSavedProducts] = useState(loadSavedProducts);

  function handleRemoveSavedNews(id) {
    setSavedNews(removeSavedNews(id));
  }

  function handleRemoveSavedProduct(name) {
    setSavedProducts(removeSavedProduct(name));
  }

  const fetchAdvice = useCallback(async (items) => {
    if (!items.length) { setAdvices([]); return; }
    setLoading(true);
    try {
      const data = await get(`/api/basket/advice?items=${encodeURIComponent(items.join(','))}`);
      setAdvices(data);
    } catch { setAdvices([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAdvice(basket);
  }, [basket, fetchAdvice]);

  function removeItem(name) {
    const next = basket.filter(n => n !== name);
    setBasket(next);
    saveBasket(next);
  }

  function clearBasket() {
    setBasket([]);
    saveBasket([]);
  }

  return (
    <div className="container mb-page">
      <h1 className="page-title">🧺 我的菜籃</h1>
      <p className="mb-desc">加入常買的品項，一鍵查看今日採買建議。清單儲存於本機，不會上傳。</p>

      {/* 操作列 */}
      {basket.length > 0 && (
        <div className="mb-add-row">
          <button className="btn btn-secondary" onClick={clearBasket}>清空菜籃</button>
        </div>
      )}

      {/* 已選品項 chips */}
      {basket.length > 0 && (
        <div className="mb-chips">
          {basket.map(name => (
            <span key={name} className="mb-chip">
              {name}
              <button className="mb-chip-remove" onClick={() => removeItem(name)}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* 採買建議 */}
      {basket.length === 0 && (
        <p className="empty">菜籃是空的，請從上方選擇品項</p>
      )}

      {loading && <div className="spinner" />}

      {!loading && advices.length > 0 && (
        <div className="mb-grid">
          {advices.map((item, i) => (
            <PriceCard key={i} item={item} />
          ))}
        </div>
      )}

      {/* 收藏品項（來自售價動態頁） */}
      <h2 className="page-title" style={{ fontSize: 20, marginTop: 40 }}>⭐ 收藏品項</h2>
      {savedProducts.length === 0 ? (
        <p className="empty">還沒有收藏的品項，前往<a href="/search" onClick={e => { e.preventDefault(); navigate('/search'); }} style={{ color: 'var(--green)', fontWeight: 500 }}>售價動態</a>收藏</p>
      ) : (
        <SavedProductsList savedProducts={savedProducts} onRemove={handleRemoveSavedProduct} />
      )}

      {/* 收藏文章（來自農產新知頁，獨立於品項清單） */}
      <h2 className="page-title" style={{ fontSize: 20, marginTop: 40 }}>📰 收藏文章</h2>
      {savedNews.length === 0 ? (
        <p className="empty">還沒有收藏的文章，前往<a href="/news" onClick={e => { e.preventDefault(); navigate('/news'); }} style={{ color: 'var(--green)', fontWeight: 500 }}>農產新知</a>看看</p>
      ) : (
        <SavedNewsList savedNews={savedNews} basket={basket} onRemove={handleRemoveSavedNews} />
      )}
    </div>
  );
}
